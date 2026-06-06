import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Headphones, Search, Users, CheckCircle2, XCircle, Clock, AlertCircle, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useListenerChat } from '../context/ListenerChatContext';
import { AdvisorConnection } from '../types';
import {
  listenToListenerRequests,
  acceptListenerRequest,
  declineListenerRequest,
  fetchAcceptedTodayCount,
} from '../lib/advisorConnections';

function formatTimestamp(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const d = new Date((value as { seconds: number }).seconds * 1000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const s = String(value);
  return s === 'undefined' || s === 'null' || s === '' ? '—' : s;
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}

// ── Request Card ──────────────────────────────────────────────────────────────
interface RequestCardProps {
  request: AdvisorConnection;
  processing: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onOpenChat: () => void;
}

function RequestCard({ request, processing, onAccept, onDecline, onOpenChat }: RequestCardProps) {
  const displayName = request.nickName || request.userName || 'Unknown';
  const initial = displayName.charAt(0).toUpperCase();
  const isAccepted = request.status === 'accepted';

  const cardContent = (
    <div
      className={[
        'glass-card p-5 border-l-4 hover:shadow-md transition-all',
        isAccepted
          ? 'border-l-emerald-400 cursor-pointer hover:ring-2 hover:ring-emerald-200'
          : 'border-l-blue-400',
      ].join(' ')}
      onClick={isAccepted ? onOpenChat : undefined}
    >
      {/* User row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={[
            'w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0',
            isAccepted ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600',
          ].join(' ')}>
            {initial}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-slate-800 leading-tight truncate">{displayName}</h4>
            {request.userEmail && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">{request.userEmail}</p>
            )}
          </div>
        </div>
        {isAccepted ? (
          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 shrink-0 ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Accepted
          </span>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 shrink-0 ml-2">
            Pending
          </span>
        )}
      </div>

      {/* Category */}
      {request.userMentalHealthCategory && (
        <div className={[
          'flex items-center gap-2 text-xs font-medium mb-3 px-3 py-1.5 rounded-lg',
          isAccepted ? 'bg-emerald-50' : 'bg-blue-50',
        ].join(' ')}>
          <span className="text-slate-400">Category:</span>
          <span className={`capitalize ${isAccepted ? 'text-emerald-700' : 'text-blue-700'}`}>
            {request.userMentalHealthCategory}
          </span>
        </div>
      )}

      {/* Reason */}
      <div className="bg-slate-50 rounded-xl p-3 mb-3 flex items-start gap-2.5">
        <AlertCircle size={15} className="text-slate-400 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-700">Reason: </span>
          {request.reason || 'No reason provided'}
        </p>
      </div>

      {/* Timestamp */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
        <Clock size={12} />
        <span>Requested {formatTimestamp(request.createdAt)}</span>
      </div>

      {/* Actions — only for pending */}
      {!isAccepted && (
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={(e) => { e.stopPropagation(); onAccept(); }}
            disabled={processing}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-60 px-4 py-2 rounded-xl transition-colors flex-1 justify-center"
          >
            {processing ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            {processing ? 'Accepting…' : 'Accept'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDecline(); }}
            disabled={processing}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 px-4 py-2 rounded-xl transition-colors flex-1 justify-center"
          >
            <XCircle size={14} />
            Decline
          </button>
        </div>
      )}

      {/* Open chat hint — only for accepted */}
      {isAccepted && (
        <div className="flex items-center justify-center gap-1.5 pt-3 border-t border-slate-100 text-xs text-emerald-600 font-semibold">
          <MessageCircle size={13} />
          Click to open chat
        </div>
      )}
    </div>
  );

  return cardContent;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ListenerRequests() {
  const { currentUser } = useAuth();
  const { openListenerChat } = useListenerChat();

  const [requests, setRequests] = useState<AdvisorConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [acceptedToday, setAcceptedToday] = useState(0);
  const [activeTab, setActiveTab] = useState<'pending' | 'in_progress' | 'accepted_today' | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(t: Toast) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(t);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // Load pending requests
  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    setLoading(true);
    const unsub = listenToListenerRequests(
      currentUser.uid,
      (reqs) => { setRequests(reqs); setLoading(false); setError(null); },
      () => { setError('Could not load listener requests. Check Firestore permissions.'); setLoading(false); }
    );
    return unsub;
  }, [currentUser]);

  // Load accepted-today count (re-fetches after each accept)
  const refreshTodayCount = useCallback(async () => {
    if (!currentUser) return;
    const count = await fetchAcceptedTodayCount(currentUser.uid);
    setAcceptedToday(count);
  }, [currentUser]);

  useEffect(() => { refreshTodayCount(); }, [refreshTodayCount]);

  const handleAccept = useCallback(
    async (r: AdvisorConnection) => {
      if (!currentUser || processingId) return;
      const displayName = r.nickName || r.userName || 'Unknown';
      setProcessingId(r.id);
      const ok = await acceptListenerRequest(r.id, r.userId, currentUser.uid);
      setProcessingId(null);
      if (ok) {
        showToast({ type: 'success', message: `Accepted — ${displayName} can now chat with you` });
        refreshTodayCount();
        setTimeout(() => openListenerChat(r.id), 1200);
      } else {
        showToast({ type: 'error', message: 'Failed to accept — please try again.' });
      }
    },
    [currentUser, processingId, openListenerChat, refreshTodayCount]
  );

  const handleDecline = useCallback(
    async (r: AdvisorConnection) => {
      if (!currentUser || processingId) return;
      if (!window.confirm('Decline this request?')) return;
      setProcessingId(r.id);
      const ok = await declineListenerRequest(r.id);
      setProcessingId(null);
      if (!ok) showToast({ type: 'error', message: 'Failed to decline — please try again.' });
    },
    [currentUser, processingId]
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartSec = todayStart.getTime() / 1000;

  const tabFiltered = requests.filter((r) => {
    if (activeTab === 'pending') return r.status === 'pending';
    if (activeTab === 'in_progress') return r.status === 'accepted';
    if (activeTab === 'accepted_today') {
      const sec = (r.acceptedAt as { seconds?: number })?.seconds ?? 0;
      return r.status === 'accepted' && sec >= todayStartSec;
    }
    return true;
  });

  const filtered = tabFiltered.filter((r) =>
    (r.nickName ?? r.userName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={[
              'fixed top-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold',
              toast.type === 'success'
                ? 'bg-emerald-500 text-white'
                : 'bg-red-500 text-white',
            ].join(' ')}
          >
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Headphones className="text-blue-500" size={32} />
            Listener Requests
          </h1>
          <p className="text-slate-500 mt-1">
            Routine support requests from students who chose to talk to an expert.
            These are not critical cases.
          </p>
        </div>
        <button
          onClick={() => openListenerChat()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors shrink-0"
        >
          <MessageCircle size={15} />
          Open Chats
        </button>
      </header>

      {/* ── Filter tabs ── */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setActiveTab(activeTab === 'pending' ? null : 'pending')}
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all',
            activeTab === 'pending'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-200'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
          ].join(' ')}
        >
          Pending
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'pending' ? 'bg-amber-400/50' : 'bg-amber-100'}`}>
            {requests.filter((r) => r.status === 'pending').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab(activeTab === 'in_progress' ? null : 'in_progress')}
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all',
            activeTab === 'in_progress'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
          ].join(' ')}
        >
          Accepted
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'in_progress' ? 'bg-emerald-400/50' : 'bg-emerald-100'}`}>
            {requests.filter((r) => r.status === 'accepted').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab(activeTab === 'accepted_today' ? null : 'accepted_today')}
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all',
            activeTab === 'accepted_today'
              ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100',
          ].join(' ')}
        >
          Hold
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'accepted_today' ? 'bg-blue-400/50' : 'bg-blue-100'}`}>
            {acceptedToday}
          </span>
        </button>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by nickname…"
          className="pl-9 pr-4 py-2 w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-300 rounded-xl outline-none text-sm transition-all"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Content ── */}
      {!currentUser ? (
        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200">
          <Users size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">Sign in to view listener requests.</p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
          <Headphones size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-semibold text-slate-500">
            {search
              ? 'No requests match your search.'
              : activeTab === 'pending'
              ? 'No pending requests.'
              : activeTab === 'in_progress'
              ? 'No accepted chats.'
              : activeTab === 'accepted_today'
              ? 'No requests on hold.'
              : 'No listener requests right now.'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {search
              ? 'Try adjusting your search.'
              : activeTab
              ? 'Try selecting a different tab.'
              : 'Requests from students choosing expert support will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              processing={processingId === r.id}
              onAccept={() => handleAccept(r)}
              onDecline={() => handleDecline(r)}
              onOpenChat={() => openListenerChat(r.id)}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
