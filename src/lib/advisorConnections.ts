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
  await updateDoc(doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile'), {
    userStatus: 'normal',
    advisorConnectionStatus: 'approved',
    approvedByAdvisorId: advisorId,
    approvedCategory: selectedApprovedCategory,
    baselineRecommendationCategory: selectedApprovedCategory,
    activeRecommendationCategory: selectedApprovedCategory,
    peerGroupRecommendationCategory: selectedApprovedCategory,
    resourceRecommendationCategory: selectedApprovedCategory,
    recommendationSource: 'advisor_approval',
    advisorApprovedAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  });
}

export async function approveUserForNormalAccess(
  connectionId: string,
  userId: string,
  advisorId: string,
  selectedApprovedCategory: string,
  advisorNote?: string
): Promise<void> {
  await updateDoc(doc(db, 'advisorConnections', connectionId), {
    status: 'approved',
    approvedAt: serverTimestamp(),
    approvedBy: advisorId,
    approvedCategory: selectedApprovedCategory,
    ...(advisorNote ? { advisorNote } : {}),
    updatedAt: serverTimestamp(),
  });
  await updateUserMentalHealthAfterApproval(userId, advisorId, selectedApprovedCategory);
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
    (snap) => {
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

      onUpdate(Array.from(byUser.values()));
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
