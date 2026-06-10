// src/components/GroupCallPanel.tsx
import React, { useState, useEffect } from 'react';
import { Video, Calendar, PhoneOff, Loader2 } from 'lucide-react';
import { doc, getDoc, type Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import {
  type GroupCall,
  listenToGroupCalls,
  startGroupCall,
  scheduleGroupCall,
  endGroupCall,
} from '../services/groupCallService';
import { CallScheduleModal } from './CallScheduleModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(ts: Timestamp | null): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface GroupCallPanelProps {
  groupId: string;
  groupName: string;
  /**
   * Optional callback fired once a new live call is created and its Firestore
   * document has been read back.  When provided the panel will NOT open a new
   * browser tab — the caller is responsible for embedding the call in-portal.
   * When omitted the previous behaviour (window.open) is preserved.
   */
  onCallStarted?: (call: GroupCall) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GroupCallPanel({ groupId, groupName, onCallStarted }: GroupCallPanelProps) {
  const { currentUser, advisorProfile } = useAuth();

  const [calls, setCalls]               = useState<GroupCall[]>([]);
  const [modal, setModal]               = useState<'instant' | 'scheduled' | null>(null);
  const [loadingCallId, setLoadingCallId] = useState<string | null>(null);
  const [starting, setStarting]         = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Real-time listener for this group's calls
  useEffect(() => {
    const unsub = listenToGroupCalls(groupId, setCalls);
    return unsub;
  }, [groupId]);

  const liveCalls      = calls.filter((c) => c.status === 'live');
  const scheduledCalls = calls.filter((c) => c.status === 'scheduled');

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Reads the newly created GroupCall doc back from Firestore and fires onCallStarted. */
  async function notifyCallStarted(callGroupId: string, callId: string): Promise<void> {
    const callRef  = doc(db, 'peer_groups', callGroupId, 'groupCalls', callId);
    const callSnap = await getDoc(callRef);
    if (callSnap.exists() && onCallStarted) {
      onCallStarted({ id: callSnap.id, ...callSnap.data() } as GroupCall);
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleStartCall(title: string) {
    if (!currentUser || !advisorProfile) return;
    setModal(null);
    setStarting(true);
    setError(null);
    try {
      const { callId } = await startGroupCall(
        groupId,
        currentUser.uid,
        advisorProfile.name,
        title,
      );
      // Always embed in-portal via ZegoCallPanel — read the doc back to get
      // server-set timestamps before notifying the parent component.
      await notifyCallStarted(groupId, callId);
    } catch (err) {
      console.error('[GroupCallPanel] startGroupCall failed:', err);
      setError('Failed to start the call. Please try again.');
    } finally {
      setStarting(false);
    }
  }

  async function handleScheduleCall(title: string, date?: Date) {
    if (!currentUser || !advisorProfile || !date) return;
    setModal(null);
    setError(null);
    try {
      await scheduleGroupCall(
        groupId,
        currentUser.uid,
        advisorProfile.name,
        title,
        date,
      );
    } catch (err) {
      console.error('[GroupCallPanel] scheduleGroupCall failed:', err);
      setError('Failed to schedule the call. Please try again.');
    }
  }

  async function handleStartScheduled(call: GroupCall) {
    if (!currentUser || !advisorProfile) return;
    setLoadingCallId(call.id);
    setError(null);
    try {
      // Create a new live call (fresh room ID), then retire the scheduled doc
      const { callId } = await startGroupCall(
        groupId,
        currentUser.uid,
        advisorProfile.name,
        call.title,
      );
      await endGroupCall(groupId, call.id);
      // Always embed in-portal via ZegoCallPanel
      await notifyCallStarted(groupId, callId);
    } catch (err) {
      console.error('[GroupCallPanel] handleStartScheduled failed:', err);
      setError('Failed to start the call. Please try again.');
    } finally {
      setLoadingCallId(null);
    }
  }

  async function handleEndCall(call: GroupCall) {
    setLoadingCallId(call.id);
    setError(null);
    try {
      await endGroupCall(groupId, call.id);
    } catch (err) {
      console.error('[GroupCallPanel] endGroupCall failed:', err);
      setError('Failed to end the call. Please try again.');
    } finally {
      setLoadingCallId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="glass-card p-5 shrink-0">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Video className="text-indigo-600" size={18} />
          <h4 className="font-bold text-slate-800 text-sm">Group Calls</h4>
          {liveCalls.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModal('scheduled')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 border border-indigo-300 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            <Calendar size={13} />
            Schedule
          </button>
          <button
            onClick={() => setModal('instant')}
            disabled={starting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-green-500 rounded-xl hover:bg-green-600 transition-colors shadow-sm shadow-green-200 disabled:opacity-60"
          >
            {starting ? <Loader2 size={13} className="animate-spin" /> : <Video size={13} />}
            Start Call
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-3">
          {error}
        </p>
      )}

      {/* ── Active (live) calls ─────────────────────────────────────────── */}
      {liveCalls.map((call) => (
        <div key={call.id} className="mb-3 p-3.5 bg-red-50 border border-red-200 rounded-2xl">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">
                  Live now
                </span>
                <p className="text-sm font-semibold text-slate-800 truncate">{call.title}</p>
                <p className="text-[10px] text-slate-500">
                  Started by {call.advisorName}
                  {call.startedAt && ` · ${formatDateTime(call.startedAt)}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Rejoin via embedded ZegoCallPanel — handled by the parent component */}
              <button
                onClick={() => handleEndCall(call)}
                disabled={loadingCallId === call.id}
                className="flex items-center gap-1 text-[10px] font-bold text-white bg-red-500 px-2.5 py-1.5 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {loadingCallId === call.id
                  ? <Loader2 size={11} className="animate-spin" />
                  : <PhoneOff size={11} />}
                End
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* ── Upcoming (scheduled) calls ──────────────────────────────────── */}
      {scheduledCalls.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Upcoming
          </p>
          {scheduledCalls.map((call) => (
            <div key={call.id} className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Calendar className="text-amber-500 shrink-0 mt-0.5" size={14} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{call.title}</p>
                    <p className="text-[10px] text-slate-500">{formatDateTime(call.scheduledAt)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleStartScheduled(call)}
                    disabled={loadingCallId === call.id}
                    className="flex items-center gap-1 text-[10px] font-bold text-white bg-green-500 px-2.5 py-1.5 rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    {loadingCallId === call.id
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Video size={11} />}
                    Start now
                  </button>
                  <button
                    onClick={() => handleEndCall(call)}
                    disabled={loadingCallId === call.id}
                    className="flex items-center gap-1 text-[10px] font-bold text-red-600 border border-red-200 bg-white px-2.5 py-1.5 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {liveCalls.length === 0 && scheduledCalls.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-1.5">
          No active or scheduled calls for <span className="font-semibold">{groupName}</span>.
        </p>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {modal === 'instant' && (
        <CallScheduleModal
          mode="instant"
          onConfirm={handleStartCall}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'scheduled' && (
        <CallScheduleModal
          mode="scheduled"
          onConfirm={handleScheduleCall}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
