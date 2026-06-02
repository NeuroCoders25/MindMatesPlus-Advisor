import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Clock,
  LogOut,
  Search,
  User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { AvailabilityStatus } from '../context/AuthContext';
import { subscribeAlertCount } from './FlaggedMessageAlert';
import { AdvisorConnection } from '../types';
import { listenToCriticalCases } from '../lib/advisorConnections';
import { availabilityDotClass, availabilityLabel } from './AvailabilitySelector';

const AVAILABILITY_OPTIONS: { value: AvailabilityStatus; label: string; dot: string }[] = [
  { value: 'online', label: 'Auto', dot: 'bg-emerald-500' },
  { value: 'busy', label: 'Busy', dot: 'bg-amber-500' },
  { value: 'away', label: 'Away', dot: 'bg-slate-400' },
];

// ── Tiny local helpers ────────────────────────────────────────────────────────

function fmtTime(value: unknown): string {
  if (!value) return '';
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'object' && value !== null && 'seconds' in value) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  } else {
    return '';
  }
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Navbar() {
  // ── Flagged-message badge (existing) ───────────────────────────────────────
  const [flaggedCount, setFlaggedCount] = useState(0);

  useEffect(() => {
    const unsub = subscribeAlertCount(setFlaggedCount);
    return () => { unsub(); };
  }, []);

  // ── Pending critical connection badge + dropdown ──────────────────────────
  const { currentUser, logout, advisorProfile, updateAvailability } = useAuth();
  const [pendingConnections, setPendingConnections] = useState<AdvisorConnection[]>([]);

  // IDs of notifications the advisor has already opened/clicked at least once
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('advisor_seen_notification_ids');
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  function markSeen(ids: string[]) {
    setSeenIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      try {
        localStorage.setItem('advisor_seen_notification_ids', JSON.stringify([...next]));
      } catch { /* storage quota — silently ignore */ }
      return next;
    });
  }

  useEffect(() => {
    if (!currentUser) {
      setPendingConnections([]);
      return;
    }
    const unsub = listenToCriticalCases(
      currentUser.uid,
      (conns) => setPendingConnections(conns.filter((c) => c.status === 'pending')),
      () => {},
    );
    return () => { unsub(); };
  }, [currentUser]);

  // Unseen = pending connections not yet opened by the advisor
  const unseenCount = pendingConnections.filter((c) => !seenIds.has(c.id)).length;

  // Combined badge: flagged-message toasts + unseen critical connections
  const totalBadge = flaggedCount + unseenCount;

  // ── Notification dropdown ─────────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  function openNotifications() {
    setNotifOpen((v) => !v);
  }

  // ── Profile dropdown ──────────────────────────────────────────────────────
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const currentAvailability = advisorProfile?.availability ?? 'online';
  const [savingAvailability, setSavingAvailability] = useState(false);

  async function handleAvailabilityChange(status: AvailabilityStatus) {
    if (status === currentAvailability || savingAvailability) return;
    setSavingAvailability(true);
    try {
      await updateAvailability(status);
    } finally {
      setSavingAvailability(false);
    }
  }

  const navigate = useNavigate();

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSignOut() {
    setProfileOpen(false);
    await logout();
    navigate('/login');
  }

  function handleReviewConnection(conn: AdvisorConnection) {
    markSeen([conn.id]);
    setNotifOpen(false);
    navigate('/critical-cases', { state: { connectionId: conn.id } });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <header className="h-16 bg-[#0f1535] border-b border-[#1e2650] flex items-center justify-between px-8 sticky top-0 z-10">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
            size={18}
          />
          <input
            type="text"
            placeholder="Search users, groups, or reports..."
            className="w-full pl-10 pr-4 py-2 bg-[#1e2650] border border-[#2a3460] placeholder-white/40 text-white/80 focus:bg-[#242d5a] focus:border-brand-500 rounded-xl outline-none text-sm transition-all"
          />
        </div>
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-4">

        {/* ── Notification bell ── */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={openNotifications}
            className="p-2 text-white/60 hover:bg-white/10 rounded-xl transition-colors relative"
            aria-label="Notifications"
          >
            <Bell size={20} />

            {/* Badge */}
            {totalBadge > 0 ? (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-[#0f1535] px-0.5">
                {totalBadge > 9 ? '9+' : totalBadge}
              </span>
            ) : (
              /* Ambient dot when nothing unread */
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0f1535]" />
            )}
          </button>

          {/* ── Notification dropdown panel ── */}
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-rose-50">
                <div className="flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-500" />
                  <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
                </div>
                {unseenCount > 0 && (
                  <span className="text-[11px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">
                    {unseenCount} pending
                  </span>
                )}
              </div>

              {/* Connection list */}
              <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                {pendingConnections.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Bell size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm text-slate-400">No notifications yet</p>
                  </div>
                ) : (
                  pendingConnections.slice(0, 10).map((conn) => {
                    const isUnseen = !seenIds.has(conn.id);
                    return (
                    <div
                      key={conn.id}
                      className={`px-4 py-3 transition-colors ${isUnseen ? 'bg-rose-50 hover:bg-rose-100' : 'bg-white hover:bg-slate-50'}`}
                    >
                      {/* Connection body */}
                      <div className="flex items-start gap-2.5 mb-2">
                        <div className="mt-0.5 shrink-0">
                          <span className={`block w-2 h-2 rounded-full ${isUnseen ? 'bg-rose-500' : 'bg-slate-300'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 leading-tight">
                            Critical Case Request
                          </p>
                          <p className="text-xs text-slate-700 mt-0.5 font-medium">
                            {conn.nickName || conn.userName || '—'}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {conn.userEmail}
                          </p>
                          {conn.userMentalHealthCategory && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {conn.userMentalHealthCategory}
                            </p>
                          )}
                          {conn.reason && (
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                              {conn.reason}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                            <Clock size={10} />
                            <span>{fmtTime(conn.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Review button */}
                      <button
                        onClick={() => handleReviewConnection(conn)}
                        className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline transition-colors ml-4"
                      >
                        Review Case <ArrowRight size={10} />
                      </button>
                    </div>
                  )})
                )}
              </div>

              {/* Footer */}
              {pendingConnections.length > 10 && (
                <div className="px-4 py-2.5 border-t border-slate-100 text-center">
                  <button
                    onClick={() => {
                      setNotifOpen(false);
                      navigate('/critical-cases');
                    }}
                    className="text-xs text-brand-500 font-semibold hover:underline"
                  >
                    View all in Critical Cases →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-8 w-[1px] bg-white/15 mx-2" />

        {/* ── Profile dropdown ── */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-3 cursor-pointer hover:bg-white/10 p-1 pr-3 rounded-xl transition-colors"
          >
            <div className="relative w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60">
              <User size={18} />
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0f1535] ${availabilityDotClass(currentAvailability)}`} />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-white/80 leading-tight">Advisor Portal</span>
              <span className="text-[10px] font-semibold text-white/40 leading-tight">{availabilityLabel(currentAvailability)}</span>
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50">
              <div className="px-3 pt-3 pb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Set Status</p>
                <div className="space-y-0.5">
                  {AVAILABILITY_OPTIONS.map((opt) => {
                    const isActive = currentAvailability === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleAvailabilityChange(opt.value)}
                        disabled={savingAvailability}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                          isActive ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'
                        } ${savingAvailability ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dot}`} />
                        {opt.label}
                        {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-100 mt-1">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
