// src/services/groupCallService.ts
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  collectionGroup,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GroupCall {
  id: string;
  groupId: string;
  advisorId: string;
  advisorName: string;
  title: string;
  roomUrl: string;
  status: 'live' | 'scheduled' | 'ended';
  scheduledAt: Timestamp | null;
  startedAt: Timestamp | null;
  endedAt: Timestamp | null;
  createdAt: Timestamp;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUPS_COLLECTION = 'peer_groups';
const CALLS_SUBCOLLECTION = 'groupCalls';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function docToGroupCall(id: string, data: Record<string, unknown>): GroupCall {
  return {
    id,
    groupId: (data.groupId as string) ?? '',
    advisorId: (data.advisorId as string) ?? '',
    advisorName: (data.advisorName as string) ?? '',
    title: (data.title as string) ?? '',
    roomUrl: (data.roomUrl as string) ?? '',
    status: (data.status as 'live' | 'scheduled' | 'ended') ?? 'ended',
    scheduledAt: (data.scheduledAt as Timestamp | null) ?? null,
    startedAt: (data.startedAt as Timestamp | null) ?? null,
    endedAt: (data.endedAt as Timestamp | null) ?? null,
    createdAt: data.createdAt as Timestamp,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Starts a live group call immediately.
 * Generates a ZEGOCLOUD-compatible room ID (numbers, letters, underscores only)
 * and stores it in the roomUrl field for backward-compatible field naming.
 * Returns the roomID and the new Firestore document ID.
 */
export async function startGroupCall(
  groupId: string,
  advisorId: string,
  advisorName: string,
  title: string,
): Promise<{ roomID: string; callId: string }> {
  // ZEGOCLOUD room IDs: only numbers, letters, underscores
  const roomID = `mindmates_${groupId}_${Date.now()}`.replace(/-/g, '_');
  const docRef = await addDoc(
    collection(db, GROUPS_COLLECTION, groupId, CALLS_SUBCOLLECTION),
    {
      groupId,
      advisorId,
      advisorName,
      title: title.trim() || 'Group call',
      roomUrl: roomID,   // field name kept for backward compat; value is now a ZEGO room ID
      status: 'live',
      startedAt: serverTimestamp(),
      scheduledAt: null,
      endedAt: null,
      createdAt: serverTimestamp(),
    },
  );
  return { roomID, callId: docRef.id };
}

/**
 * Creates a scheduled group call.
 * The room ID is generated using scheduledAt timestamp so it stays stable.
 * Stored in the roomUrl field for backward-compatible field naming.
 */
export async function scheduleGroupCall(
  groupId: string,
  advisorId: string,
  advisorName: string,
  title: string,
  scheduledAt: Date,
): Promise<void> {
  // ZEGOCLOUD room IDs: only numbers, letters, underscores
  const roomID = `mindmates_${groupId}_${scheduledAt.getTime()}`.replace(/-/g, '_');
  await addDoc(collection(db, GROUPS_COLLECTION, groupId, CALLS_SUBCOLLECTION), {
    groupId,
    advisorId,
    advisorName,
    title: title.trim() || 'Group call',
    roomUrl: roomID,   // field name kept for backward compat; value is now a ZEGO room ID
    status: 'scheduled',
    scheduledAt: Timestamp.fromDate(scheduledAt),
    startedAt: null,
    endedAt: null,
    createdAt: serverTimestamp(),
  });
}

/**
 * Ends a call by setting status → "ended" and recording endedAt.
 */
export async function endGroupCall(groupId: string, callId: string): Promise<void> {
  const callRef = doc(db, GROUPS_COLLECTION, groupId, CALLS_SUBCOLLECTION, callId);
  await updateDoc(callRef, {
    status: 'ended',
    endedAt: serverTimestamp(),
  });
}

/**
 * Real-time listener for live + scheduled calls in a peer group.
 * Returns an unsubscribe function.
 */
export function listenToGroupCalls(
  groupId: string,
  callback: (calls: GroupCall[]) => void,
): () => void {
  const q = query(
    collection(db, GROUPS_COLLECTION, groupId, CALLS_SUBCOLLECTION),
    where('status', 'in', ['live', 'scheduled']),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) =>
        docToGroupCall(d.id, d.data() as Record<string, unknown>),
      ),
    );
  });
}

/**
 * One-shot fetch of all active / scheduled calls for an advisor
 * across every peer group (collectionGroup query).
 */
export async function fetchAdvisorActiveCalls(
  advisorId: string,
): Promise<GroupCall[]> {
  const q = query(
    collectionGroup(db, CALLS_SUBCOLLECTION),
    where('advisorId', '==', advisorId),
    where('status', 'in', ['live', 'scheduled']),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    docToGroupCall(d.id, d.data() as Record<string, unknown>),
  );
}
