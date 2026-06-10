/**
 * useUserDiagnosticData — establishes ALL Firestore onSnapshot listeners
 * for a single user's mental health detail panel.
 *
 * All listeners are set up once when uid is provided and torn down cleanly
 * when uid changes or the consuming component unmounts.
 * Missing subcollections return empty arrays, never throw.
 */

import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import {
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import type {
  UserDiagnosticData,
  UserDiagnosticProfile,
  MentalHealthProfileData,
  MLHistoryEntry,
  JournalMetaEntry,
  FeedbackEntry,
  AdvisorConnectionData,
  WellnessHistoryEntry,
} from '../types/userDiagnostic';

const EMPTY_STATE: UserDiagnosticData = {
  profile: null,
  mentalHealthProfile: null,
  journalEntries: [],
  mlHistory: [],
  wellnessHistory: [],
  feedback: [],
  advisorConnection: null,
  loading: false,
  error: null,
};

export function useUserDiagnosticData(uid: string | null): UserDiagnosticData {
  const [state, setState] = useState<UserDiagnosticData>({ ...EMPTY_STATE });

  useEffect(() => {
    if (!uid) {
      setState({ ...EMPTY_STATE });
      return;
    }

    // Start loading; reset error
    setState((s) => ({ ...s, loading: true, error: null }));

    const subs: Array<() => void> = [];

    // ── 1. users/{uid} ────────────────────────────────────────────────────────
    subs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          const data = snap.exists()
            ? (snap.data() as Omit<UserDiagnosticProfile, 'uid'>)
            : {};
          setState((s) => ({
            ...s,
            profile: { uid, ...data },
            loading: false,
          }));
        },
        (err) => {
          console.error('[useUserDiagnosticData] users:', err);
          setState((s) => ({
            ...s,
            loading: false,
            error: 'Failed to load user profile.',
          }));
        },
      ),
    );

    // ── 2. users/{uid}/mentalHealthProfile/currentProfile ────────────────────
    subs.push(
      onSnapshot(
        doc(db, 'users', uid, 'mentalHealthProfile', 'currentProfile'),
        (snap) => {
          setState((s) => ({
            ...s,
            mentalHealthProfile: snap.exists()
              ? (snap.data() as MentalHealthProfileData)
              : null,
          }));
        },
        (err) => console.error('[useUserDiagnosticData] mentalHealthProfile:', err),
      ),
    );

    // ── 3. users/{uid}/journal_entries  (latest 15) ──────────────────────────
    // NOTE: journal entries use 'date' as the primary timestamp field
    subs.push(
      onSnapshot(
        query(
          collection(db, 'users', uid, 'journal_entries'),
          orderBy('date', 'desc'),
          limit(15),
        ),
        (snap) => {
          setState((s) => ({
            ...s,
            journalEntries: snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<JournalMetaEntry, 'id'>),
            })),
          }));
        },
        (err) => console.error('[useUserDiagnosticData] journal_entries:', err),
      ),
    );

    // ── 4. users/{uid}/mlAnalysisHistory  (latest 30) ───────────────────────
    // NOTE: mlAnalysisHistory uses 'createdAt' as the primary timestamp field
    subs.push(
      onSnapshot(
        query(
          collection(db, 'users', uid, 'mlAnalysisHistory'),
          orderBy('createdAt', 'desc'),
          limit(30),
        ),
        (snap) => {
          setState((s) => ({
            ...s,
            mlHistory: snap.docs.map((d) => {
              const raw = d.data() as Omit<MLHistoryEntry, 'id'>;
              return {
                id: d.id,
                ...raw,
                // Normalise alternative field names so all consumers work uniformly
                prediction: raw.prediction ?? raw.label,
                confidence: raw.confidence ?? raw.score,
                // Expose createdAt as the canonical timestamp
                timestamp:  raw.createdAt ?? raw.timestamp,
              };
            }),
          }));
        },
        (err) => console.error('[useUserDiagnosticData] mlAnalysisHistory:', err),
      ),
    );

    // ── 5. users/{uid}/wellnessScoreHistory  (latest 30) ─────────────────────
    subs.push(
      onSnapshot(
        query(
          collection(db, 'users', uid, 'wellnessScoreHistory'),
          orderBy('createdAt', 'desc'),
          limit(30),
        ),
        (snap) => {
          setState((s) => ({
            ...s,
            wellnessHistory: snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<WellnessHistoryEntry, 'id'>),
            })),
          }));
        },
        (err) => console.error('[useUserDiagnosticData] wellnessScoreHistory:', err),
      ),
    );

    // ── 6. users/{uid}/feedback  (latest 5) ──────────────────────────────────
    subs.push(
      onSnapshot(
        query(
          collection(db, 'users', uid, 'feedback'),
          orderBy('createdAt', 'desc'),
          limit(5),
        ),
        (snap) => {
          setState((s) => ({
            ...s,
            feedback: snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<FeedbackEntry, 'id'>),
            })),
          }));
        },
        (err) => console.error('[useUserDiagnosticData] feedback:', err),
      ),
    );

    // ── 7. advisorConnections where userId == uid ─────────────────────────────
    subs.push(
      onSnapshot(
        query(
          collection(db, 'advisorConnections'),
          where('userId', '==', uid),
          limit(1),
        ),
        (snap) => {
          if (!snap.empty) {
            const d = snap.docs[0];
            setState((s) => ({
              ...s,
              advisorConnection: {
                id: d.id,
                ...(d.data() as Omit<AdvisorConnectionData, 'id'>),
              },
            }));
          } else {
            setState((s) => ({ ...s, advisorConnection: null }));
          }
        },
        (err) => console.error('[useUserDiagnosticData] advisorConnections:', err),
      ),
    );

    // Cleanup: unsubscribe ALL listeners when uid changes or unmounts
    return () => {
      subs.forEach((fn) => fn());
    };
  }, [uid]);

  return state;
}
