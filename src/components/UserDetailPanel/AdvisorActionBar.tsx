import React, { useState } from 'react';
import { ClipboardList, Link2, AlertTriangle, MessageSquare, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { getUserDisplayName } from '../../types/userDiagnostic';
import type { UserDiagnosticData } from '../../types/userDiagnostic';
import { cn } from '../../lib/utils';

interface Props {
  userId: string;
  data: UserDiagnosticData;
}

export default function AdvisorActionBar({ userId, data }: Props) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { profile, mentalHealthProfile, advisorConnection } = data;

  // ── Add Note inline state ────────────────────────────────────────────────────
  const [noteOpen, setNoteOpen]       = useState(false);
  const [noteText, setNoteText]       = useState('');
  const [noteSaving, setNoteSaving]   = useState(false);

  // ── Flag Critical confirm dialog ─────────────────────────────────────────────
  const [flagConfirm, setFlagConfirm] = useState(false);
  const [flagging, setFlagging]       = useState(false);

  // ── Connect loading ─────────────────────────────────────────────────────────
  const [connecting, setConnecting]   = useState(false);

  // Whether already connected
  const connStatus = (advisorConnection?.status ?? (mentalHealthProfile?.advisorConnectionStatus ?? '')).toLowerCase();
  const isConnected = connStatus === 'accepted' || connStatus === 'approved';

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async function ensureConnectionDoc(): Promise<string> {
    if (advisorConnection?.id) return advisorConnection.id;
    const displayName = getUserDisplayName(profile);
    const ref = await addDoc(collection(db, 'advisorConnections'), {
      userId,
      advisorId: currentUser?.uid ?? '',
      status: 'accepted',
      caseType: 'advisor_initiated',
      reason: 'Advisor initiated from monitoring panel',
      userMentalHealthCategory: '',
      userName: displayName,
      userEmail: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  async function handleSaveNote() {
    if (!noteText.trim() || noteSaving) return;
    setNoteSaving(true);
    try {
      const docId = await ensureConnectionDoc();
      const timestamp = new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      });
      const existing = advisorConnection?.notes ?? '';
      const appended = existing
        ? `${existing}\n---\n[${timestamp}] ${noteText.trim()}`
        : `[${timestamp}] ${noteText.trim()}`;
      await updateDoc(doc(db, 'advisorConnections', docId), {
        notes: appended,
        updatedAt: serverTimestamp(),
      });
      setNoteText('');
      setNoteOpen(false);
    } catch (err) {
      console.error('[AdvisorActionBar] save note:', err);
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleConnect() {
    if (isConnected || connecting || !currentUser) return;
    setConnecting(true);
    try {
      if (advisorConnection?.id) {
        await updateDoc(doc(db, 'advisorConnections', advisorConnection.id), {
          status: 'accepted',
          advisorId: currentUser.uid,
          acceptedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const displayName = getUserDisplayName(profile);
        await addDoc(collection(db, 'advisorConnections'), {
          userId,
          advisorId: currentUser.uid,
          status: 'accepted',
          caseType: 'advisor_initiated',
          reason: 'Advisor initiated from monitoring panel',
          userMentalHealthCategory: '',
          userName: displayName,
          userEmail: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      // Update user's mental health profile
      await updateDoc(
        doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile'),
        {
          connectedAdvisorId: currentUser.uid,
          advisorConnectionStatus: 'accepted',
          userStatus: 'under_review',
        },
      );
    } catch (err) {
      console.error('[AdvisorActionBar] connect:', err);
    } finally {
      setConnecting(false);
    }
  }

  async function handleFlagCritical() {
    if (flagging || !currentUser) return;
    setFlagging(true);
    try {
      // Update user status
      await updateDoc(doc(db, 'users', userId), {
        userStatus: 'under_review',
      });
      // Also update mental health profile for live listener
      await updateDoc(
        doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile'),
        { userStatus: 'under_review' },
      );
      // Write audit log
      const docId = await ensureConnectionDoc();
      await addDoc(collection(db, 'advisorConnections', docId, 'auditLog'), {
        action: 'flagged_critical',
        advisorId: currentUser.uid,
        timestamp: serverTimestamp(),
      });
      setFlagConfirm(false);
    } catch (err) {
      console.error('[AdvisorActionBar] flag critical:', err);
    } finally {
      setFlagging(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="shrink-0 border-t border-slate-200 bg-white">
      {/* Inline note editor */}
      {noteOpen && (
        <div className="px-4 pt-3 pb-1 border-b border-slate-100">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add advisor note… (appended with timestamp)"
            rows={3}
            className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-brand-300 focus:bg-white resize-none transition-all"
          />
          <div className="flex items-center justify-end gap-2 mt-2 mb-1">
            <button
              onClick={() => { setNoteOpen(false); setNoteText(''); }}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNote}
              disabled={!noteText.trim() || noteSaving}
              className="px-4 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-bold hover:bg-brand-600 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <Check size={12} />
              {noteSaving ? 'Saving…' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* Flag confirmation */}
      {flagConfirm && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100">
          <p className="text-sm font-semibold text-red-800 mb-2">
            ⚠ Flag this user as Critical? Their status will be set to "Under Review".
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFlagConfirm(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleFlagCritical}
              disabled={flagging}
              className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <AlertTriangle size={12} />
              {flagging ? 'Flagging…' : 'Confirm Flag'}
            </button>
          </div>
        </div>
      )}

      {/* Action buttons row */}
      <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
        {/* Add Note */}
        <button
          onClick={() => setNoteOpen((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
            noteOpen
              ? 'bg-brand-500 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700',
          )}
        >
          <ClipboardList size={14} />
          Add Note
        </button>

        {/* Connect */}
        <button
          onClick={handleConnect}
          disabled={isConnected || connecting}
          title={isConnected ? 'Already connected' : 'Connect as advisor'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all',
            isConnected
              ? 'bg-emerald-100 text-emerald-700 cursor-default'
              : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50',
          )}
        >
          <Link2 size={14} />
          {connecting ? 'Connecting…' : isConnected ? 'Connected ✓' : 'Connect'}
        </button>

        {/* Flag Critical */}
        <button
          onClick={() => setFlagConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700 transition-all"
        >
          <AlertTriangle size={14} />
          Flag Critical
        </button>

        {/* Open Chat */}
        <button
          onClick={() => navigate('/chat')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-all"
        >
          <MessageSquare size={14} />
          Open Chat
        </button>
      </div>
    </div>
  );
}
