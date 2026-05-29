import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  addDoc,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { AdvisorConnection, CaseMessage } from '../types';

export const APPROVED_CATEGORIES = [
  'Wellness - Thriving',
  'Wellness - Stress Aware',
  'Wellness - Emotionally Aware',
  'Recovery & Improvement',
  'Mild Support',
  'Moderate Support',
] as const;

export type ApprovedCategory = (typeof APPROVED_CATEGORIES)[number];

export async function updateUserMentalHealthAfterApproval(
  userId: string,
  advisorId: string,
  selectedApprovedCategory: string
): Promise<void> {
  console.log('[AdvisorApproval] Updating user profile to normal');

  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');
  const snap = await getDoc(profileRef);
  const currentScore = snap.exists() ? (snap.data()?.wellnessScore as number | undefined) : undefined;
  const safeWellnessScore = Math.max(typeof currentScore === 'number' ? currentScore : 0, 20);

  await updateDoc(profileRef, {
    userStatus: 'normal',
    advisorConnectionStatus: 'approved',
    approvedByAdvisorId: advisorId,
    approvedCategory: selectedApprovedCategory,
    baselineRecommendationCategory: selectedApprovedCategory,
    activeRecommendationCategory: selectedApprovedCategory,
    peerGroupRecommendationCategory: selectedApprovedCategory,
    dashboardCategory: selectedApprovedCategory,
    resourceRecommendationCategory: selectedApprovedCategory,
    recommendationSource: 'advisor_approval',
    approvalMessageSeen: false,
    advisorApprovedAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
    wellnessScore: safeWellnessScore,
  });

  console.log('[AdvisorApproval] approvalMessageSeen set to false');
}

export async function updateUserWellnessScoreByAdvisor(
  userId: string,
  advisorId: string,
  newScore: number,
  previousScore: number | null,
  note?: string
): Promise<void> {
  const profileRef = doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile');

  const profileUpdate: Record<string, unknown> = {
    wellnessScore: newScore,
    wellnessScoreUpdatedBy: advisorId,
    wellnessScoreUpdatedByRole: 'advisor',
    wellnessScoreUpdatedAt: serverTimestamp(),
    recommendationSource: 'advisor_update',
    lastUpdated: serverTimestamp(),
  };

  if (newScore < 10) {
    profileUpdate.userStatus = 'restricted';
    profileUpdate.restrictedReason = 'Low wellness score confirmed by advisor';
  }

  await updateDoc(profileRef, profileUpdate);

  const historyEntry: Record<string, unknown> = {
    previousScore,
    newScore,
    source: 'advisor_update',
    updatedBy: advisorId,
    updatedByRole: 'advisor',
    createdAt: serverTimestamp(),
  };
  if (previousScore !== null) historyEntry.changeAmount = newScore - previousScore;
  if (note) historyEntry.note = note;

  await addDoc(collection(db, 'users', userId, 'wellnessScoreHistory'), historyEntry);
}

export async function approveUserForNormalAccess(
  connectionId: string,
  userId: string,
  advisorId: string,
  selectedApprovedCategory: string,
  advisorNote?: string
): Promise<void> {
  console.log('[AdvisorApproval] Approve clicked');
  console.log('[AdvisorApproval] Updating advisorConnections status to approved');

  await updateDoc(doc(db, 'advisorConnections', connectionId), {
    status: 'approved',
    approvedAt: serverTimestamp(),
    approvedBy: advisorId,
    approvedCategory: selectedApprovedCategory,
    advisorNote: advisorNote || '',
    updatedAt: serverTimestamp(),
  });

  await updateUserMentalHealthAfterApproval(userId, advisorId, selectedApprovedCategory);

  console.log('[AdvisorApproval] Approval update completed');
}

export function listenToCriticalCases(
  advisorId: string,
  onUpdate: (connections: AdvisorConnection[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'advisorConnections'),
    where('advisorId', '==', advisorId),
    where('caseType', '==', 'critical_case')
  );

  return onSnapshot(
    q,
    async (snap) => {
      const all = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AdvisorConnection, 'id'>),
      }));

      const active = all.filter((c) => c.status === 'pending' || c.status === 'accepted');

      // Deduplicate by userId — keep the latest connection per user
      const byUser = new Map<string, AdvisorConnection>();
      for (const conn of active) {
        const existing = byUser.get(conn.userId);
        const existingTs = (existing?.createdAt as { seconds?: number })?.seconds ?? 0;
        const connTs = (conn.createdAt as { seconds?: number })?.seconds ?? 0;
        if (!existing || connTs > existingTs) {
          byUser.set(conn.userId, conn);
        }
      }

      const deduped = Array.from(byUser.values());

      // Fetch nickname from users collection for each connection
      const enriched = await Promise.all(
        deduped.map(async (conn) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', conn.userId));
            const nickname = userSnap.exists()
              ? (userSnap.data()?.nickname as string | undefined)
              : undefined;
            return { ...conn, nickName: nickname || conn.nickName };
          } catch {
            return conn;
          }
        })
      );

      onUpdate(enriched);
    },
    (err) => onError?.(err as Error)
  );
}

export async function acceptAdvisorConnection(
  connectionId: string,
  userId: string,
  advisorId: string
): Promise<void> {
  await updateDoc(doc(db, 'advisorConnections', connectionId), {
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile'), {
    connectedAdvisorId: advisorId,
    advisorConnectionStatus: 'accepted',
    userStatus: 'under_review',
  });
}

export async function markCaseReviewed(
  connectionId: string,
  userId: string
): Promise<void> {
  await updateDoc(doc(db, 'advisorConnections', connectionId), {
    status: 'reviewed',
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile'), {
    advisorConnectionStatus: 'reviewed',
    userStatus: 'normal',
  });
}

export async function fetchUserMentalHealthProfile(
  userId: string
): Promise<Record<string, unknown>> {
  try {
    const snap = await getDoc(
      doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile')
    );
    return snap.exists() ? (snap.data() as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function fetchCaseUserProfile(userId: string): Promise<{
  user: Record<string, unknown>;
  profile: Record<string, unknown>;
}> {
  const [userSnap, profileSnap] = await Promise.all([
    getDoc(doc(db, 'users', userId)).catch(() => null),
    getDoc(doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile')).catch(() => null),
  ]);
  return {
    user: userSnap?.exists() ? (userSnap.data() as Record<string, unknown>) : {},
    profile: profileSnap?.exists() ? (profileSnap.data() as Record<string, unknown>) : {},
  };
}

export async function approveUserCase(
  connectionId: string,
  userId: string,
  advisorId: string
): Promise<void> {
  await updateDoc(doc(db, 'advisorConnections', connectionId), {
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile'), {
    connectedAdvisorId: advisorId,
    advisorConnectionId: connectionId,
    advisorConnectionStatus: 'accepted',
    userStatus: 'under_review',
  });
}

export function listenToListenerRequests(
  advisorId: string,
  onUpdate: (requests: AdvisorConnection[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'advisorConnections'),
    where('advisorId', '==', advisorId),
    where('caseType', '==', 'listener_support')
  );

  return onSnapshot(
    q,
    async (snap) => {
      const all = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AdvisorConnection, 'id'>),
      }));

      // Show pending AND accepted (in-progress) — reviewed/declined are hidden
      const visible = all.filter(
        (c) => c.status === 'pending' || c.status === 'accepted'
      );

      const sorted = [...visible].sort((a, b) => {
        const aTs = (a.createdAt as { seconds?: number })?.seconds ?? 0;
        const bTs = (b.createdAt as { seconds?: number })?.seconds ?? 0;
        return bTs - aTs;
      });

      const enriched = await Promise.all(
        sorted.map(async (conn) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', conn.userId));
            const nickname = userSnap.exists()
              ? (userSnap.data()?.nickname as string | undefined)
              : undefined;
            return { ...conn, nickName: nickname || conn.nickName };
          } catch {
            return conn;
          }
        })
      );

      onUpdate(enriched);
    },
    (err) => onError?.(err as Error)
  );
}

export async function acceptListenerRequest(
  connectionId: string,
  userId: string,
  advisorId: string
): Promise<boolean> {
  void userId; // user's access level is unchanged — do NOT touch mentalHealthProfile
  try {
    await updateDoc(doc(db, 'advisorConnections', connectionId), {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      acceptedByAdvisorId: advisorId,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('[ListenerRequest] acceptListenerRequest failed:', err);
    return false;
  }
}

export async function declineListenerRequest(
  connectionId: string,
  reason?: string
): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'advisorConnections', connectionId), {
      status: 'declined',
      declinedAt: serverTimestamp(),
      declineReason: reason ?? '',
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('[ListenerRequest] declineListenerRequest failed:', err);
    return false;
  }
}

export function listenToActiveListenerChats(
  advisorId: string,
  onUpdate: (chats: AdvisorConnection[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(
    collection(db, 'advisorConnections'),
    where('advisorId', '==', advisorId),
    where('caseType', '==', 'listener_support')
  );

  return onSnapshot(
    q,
    async (snap) => {
      const all = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AdvisorConnection, 'id'>),
      }));

      const active = all.filter((c) => c.status === 'accepted' || c.status === 'approved');

      const sorted = [...active].sort((a, b) => {
        const aTs =
          (a.acceptedAt as { seconds?: number })?.seconds ??
          (a.createdAt as { seconds?: number })?.seconds ?? 0;
        const bTs =
          (b.acceptedAt as { seconds?: number })?.seconds ??
          (b.createdAt as { seconds?: number })?.seconds ?? 0;
        return bTs - aTs;
      });

      const enriched = await Promise.all(
        sorted.map(async (conn) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', conn.userId));
            const nickname = userSnap.exists()
              ? (userSnap.data()?.nickname as string | undefined)
              : undefined;
            return { ...conn, nickName: nickname || conn.nickName };
          } catch {
            return conn;
          }
        })
      );

      onUpdate(enriched);
    },
    (err) => onError?.(err as Error)
  );
}

export async function fetchAcceptedTodayCount(advisorId: string): Promise<number> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'advisorConnections'),
        where('advisorId', '==', advisorId),
        where('caseType', '==', 'listener_support')
      )
    );
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const midnightSecs = Math.floor(midnight.getTime() / 1000);
    return snap.docs.filter((d) => {
      const data = d.data();
      return (
        data.status === 'accepted' &&
        typeof data.acceptedAt === 'object' &&
        data.acceptedAt !== null &&
        'seconds' in data.acceptedAt &&
        (data.acceptedAt as { seconds: number }).seconds >= midnightSecs
      );
    }).length;
  } catch {
    return 0;
  }
}

export function listenToCaseMessages(
  connectionId: string,
  onUpdate: (messages: CaseMessage[]) => void
): () => void {
  const q = query(
    collection(db, 'advisorConnections', connectionId, 'messages'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    onUpdate(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CaseMessage, 'id'>),
      }))
    );
  });
}

export async function sendAdvisorCaseMessage(
  connectionId: string,
  advisorId: string,
  userId: string,
  text: string
): Promise<void> {
  await addDoc(collection(db, 'advisorConnections', connectionId, 'messages'), {
    senderId: advisorId,
    senderRole: 'advisor',
    receiverId: userId,
    messageText: text,
    messageType: 'text',
    createdAt: serverTimestamp(),
    isRead: false,
  });
  await updateDoc(doc(db, 'advisorConnections', connectionId), {
    lastMessage: text,
    lastMessageSenderId: advisorId,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function markUserMessagesAsRead(connectionId: string): Promise<void> {
  const q = query(
    collection(db, 'advisorConnections', connectionId, 'messages'),
    where('senderRole', '==', 'user'),
    where('isRead', '==', false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { isRead: true })));
}
