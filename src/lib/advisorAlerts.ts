/**
 * advisorAlerts.ts
 *
 * Read-only helpers for the Advisor Portal to consume backend-created alert
 * documents stored at:  advisors/{advisorId}/alerts/{alertId}
 *
 * The Advisor Portal MUST NOT:
 *  - Create alert documents
 *  - Send emails
 *  - Write to emailStatus, connectionId, userId, severity, or createdAt
 *
 * Safe write operations:  status, readAt, updatedAt  (mark-as-read only)
 */

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdvisorAlert {
  id: string;
  advisorId: string;
  connectionId: string;
  userId: string;

  userName?: string;
  userEmail?: string | null;

  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'advisor_connection';
  status: 'unread' | 'read';

  userMentalHealthCategory?: string | null;
  riskLevel?: string | null;
  reason?: string | null;

  emailStatus?: 'pending' | 'sent' | 'failed' | 'skipped';
  createdAt?: Date;
  updatedAt?: Date;
  readAt?: Date | null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Safely convert a Firestore Timestamp / plain seconds-object / Date to Date. */
function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return undefined;
}

function docToAlert(id: string, data: Record<string, unknown>, advisorId: string): AdvisorAlert {
  return {
    id,
    advisorId: (data.advisorId ?? advisorId) as string,
    connectionId: (data.connectionId ?? '') as string,
    userId: (data.userId ?? '') as string,
    userName: data.userName as string | undefined,
    userEmail: data.userEmail as string | null | undefined,
    title: (data.title ?? 'Critical Case Alert') as string,
    message: (data.message ?? '') as string,
    severity: (data.severity ?? 'critical') as AdvisorAlert['severity'],
    type: 'advisor_connection' as const,
    status: (data.status ?? 'unread') as AdvisorAlert['status'],
    userMentalHealthCategory: data.userMentalHealthCategory as string | null | undefined,
    riskLevel: data.riskLevel as string | null | undefined,
    reason: data.reason as string | null | undefined,
    emailStatus: data.emailStatus as AdvisorAlert['emailStatus'],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    readAt: toDate(data.readAt) ?? null,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Subscribe to an advisor's alert sub-collection in real time.
 *
 * - Orders by createdAt descending.
 * - Limits to the 50 most recent alerts.
 * - Normalises Firestore Timestamps to JavaScript Date objects.
 * - Returns an unsubscribe function.
 */
export function listenToAdvisorAlerts(
  advisorId: string,
  callback: (alerts: AdvisorAlert[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(
    collection(db, 'advisors', advisorId, 'alerts'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );

  return onSnapshot(
    q,
    (snap) => {
      const alerts: AdvisorAlert[] = snap.docs.map((d) =>
        docToAlert(d.id, d.data() as Record<string, unknown>, advisorId),
      );
      callback(alerts);
    },
    (err) => onError?.(err as Error),
  );
}

/**
 * Mark a single advisor alert as read.
 *
 * Only writes the three safe fields:  status, readAt, updatedAt.
 * All other fields (emailStatus, connectionId, userId, severity, createdAt)
 * are left untouched — Firestore rules should enforce this too.
 */
export async function markAdvisorAlertAsRead(
  advisorId: string,
  alertId: string,
): Promise<void> {
  await updateDoc(doc(db, 'advisors', advisorId, 'alerts', alertId), {
    status: 'read',
    readAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
