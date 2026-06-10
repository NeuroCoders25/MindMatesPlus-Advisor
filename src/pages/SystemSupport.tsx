import React, { useState, useEffect } from 'react';
import {
  HeadphonesIcon,
  Circle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  ChevronRight,
  Send,
  RefreshCw,
  Filter,
  Inbox,
  AlertCircle,
  HelpCircle,
  Settings2,
  FileQuestion,
  LifeBuoy,
  User,
  CalendarDays,
  Tag,
  BadgeCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  where,
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import AdvisorChat from './AdvisorChat';
import type {
  SupportRequest,
  SupportCategory,
  SupportPriority,
  SupportStatus,
  AdminAvailability,
} from '../types';

// ─── static lookup tables ─────────────────────────────────────────────────────

const CATEGORIES: {
  value: SupportCategory;
  icon: React.ElementType;
  desc: string;
}[] = [
  { value: 'Technical Issue',  icon: Settings2,     desc: 'Portal bugs or feature problems' },
  { value: 'Urgent Case',      icon: AlertTriangle, desc: 'Critical user needing admin action' },
  { value: 'System Error',     icon: AlertCircle,   desc: 'Crashes, sync or connectivity errors' },
  { value: 'Consultation',     icon: HelpCircle,    desc: 'Guidance on policies or best practices' },
  { value: 'Policy Question',  icon: FileQuestion,  desc: 'Platform rules or compliance queries' },
  { value: 'Other',            icon: LifeBuoy,      desc: 'Anything else needing admin attention' },
];

const PRIORITIES: {
  value: SupportPriority;
  color: string;
  bg: string;
  dot: string;
}[] = [
  { value: 'Low',      color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200',   dot: 'bg-slate-400'  },
  { value: 'Medium',   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-400'  },
  { value: 'High',     color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  { value: 'Critical', color: 'text-rose-700',   bg: 'bg-rose-50 border-rose-200',     dot: 'bg-rose-500'   },
];

const STATUS_META: Record<
  SupportStatus,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  pending:     { label: 'Pending',     color: 'text-amber-700',   bg: 'bg-amber-50',   icon: Clock        },
  in_progress: { label: 'In Progress', color: 'text-blue-700',    bg: 'bg-blue-50',    icon: RefreshCw    },
  resolved:    { label: 'Resolved',    color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  closed:      { label: 'Closed',      color: 'text-slate-500',   bg: 'bg-slate-50',   icon: BadgeCheck   },
};

const AVAIL_META: Record<
  AdminAvailability['availability'],
  { label: string; dot: string; text: string }
> = {
  online:  { label: 'Online',  dot: 'bg-emerald-500', text: 'text-emerald-700' },
  busy:    { label: 'Busy',    dot: 'bg-amber-500',   text: 'text-amber-700'   },
  away:    { label: 'Away',    dot: 'bg-slate-400',   text: 'text-slate-500'   },
  offline: { label: 'Offline', dot: 'bg-slate-300',   text: 'text-slate-400'   },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

function getProfileImageUrl(data: Record<string, unknown>) {
  return (
    data.profileImageUrl ||
    data.profilePicture ||
    data.profile_picture ||
    data.photoURL ||
    data.avatarUrl ||
    data.avatar ||
    data.imageUrl ||
    data.image_url ||
    ''
  ) as string;
}

async function getAdminProfileImageUrl(adminId: string, data: Record<string, unknown>) {
  const directUrl = getProfileImageUrl(data);
  if (directUrl) return directUrl;

  const fallbackCollections = ['adminProfiles', 'admin', 'users', 'advisors'];
  for (const collectionName of fallbackCollections) {
    const snap = await getDoc(doc(db, collectionName, adminId)).catch(() => null);
    if (snap?.exists()) {
      const fallbackUrl = getProfileImageUrl(snap.data());
      if (fallbackUrl) return fallbackUrl;
    }
  }

  return '';
}

function formatTs(ts: unknown): string {
  if (!ts) return '—';
  const d =
    ts instanceof Timestamp
      ? ts.toDate()
      : new Date(ts as string);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── component ────────────────────────────────────────────────────────────────

export default function SystemSupport() {
  const { currentUser, advisorProfile } = useAuth();
  const navigate = useNavigate();

  const [admins, setAdmins] = useState<AdminAvailability[]>([]);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<SupportStatus | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [selectedAdminChatId, setSelectedAdminChatId] = useState<string | null>(null);

  const [form, setForm] = useState({
    category: '' as SupportCategory | '',
    priority: 'Medium' as SupportPriority,
    subject: '',
    description: '',
  });
  const [submitState, setSubmitState] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [submitError, setSubmitError] = useState('');

  // ── real-time admin availability ──────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'admins'), orderBy('name', 'asc'));
    return onSnapshot(q, async (snap) => {
      const list = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || 'Admin',
          email: data.email,
          role: data.role || 'System Admin',
          availability: data.availability ?? 'offline',
          profileImageUrl: await getAdminProfileImageUrl(d.id, data),
          lastSeen: data.lastSeen,
        } as AdminAvailability;
      }));
      setAdmins(list);
    });
  }, []);

  // ── this advisor's support requests ──────────────────────────────────────
  // NOTE: only one where() filter — no composite index required.
  // Sorting is done client-side so Firestore doesn't need an index.
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'supportRequests'),
      where('advisorId', '==', currentUser.uid)
    );
    return onSnapshot(
      q,
      (snap) => {
        const list: SupportRequest[] = [];
        snap.forEach((d) =>
          list.push({ id: d.id, ...d.data() } as SupportRequest)
        );
        // Sort newest first on the client
        list.sort((a, b) => {
          const toMs = (ts: unknown) =>
            ts instanceof Timestamp
              ? ts.toMillis()
              : ts
              ? new Date(ts as string).getTime()
              : 0;
          return toMs(b.createdAt) - toMs(a.createdAt);
        });
        setRequests(list);
      },
      (err) => {
        console.error('supportRequests listener error:', err);
      }
    );
  }, [currentUser]);

  // ── derived stats ─────────────────────────────────────────────────────────
  const onlineCount  = admins.filter((a) => a.availability === 'online').length;
  const busyCount    = admins.filter((a) => a.availability === 'busy').length;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const resolvedCount = requests.filter(
    (r) => r.status === 'resolved' || r.status === 'closed'
  ).length;

  const filteredRequests =
    filterStatus === 'all'
      ? requests
      : requests.filter((r) => r.status === filterStatus);

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !advisorProfile) return;

    if (!form.category) {
      setSubmitError('Please select a category.');
      setSubmitState('error');
      return;
    }
    if (!form.subject.trim()) {
      setSubmitError('Please enter a subject.');
      setSubmitState('error');
      return;
    }
    if (!form.description.trim()) {
      setSubmitError('Please describe your issue.');
      setSubmitState('error');
      return;
    }

    setSubmitState('loading');
    setSubmitError('');

    try {
      await addDoc(collection(db, 'supportRequests'), {
        advisorId:   currentUser.uid,
        advisorName: advisorProfile.name,
        category:    form.category,
        priority:    form.priority,
        subject:     form.subject.trim(),
        description: form.description.trim(),
        status:      'pending' as SupportStatus,
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });

      setSubmitState('success');
      setForm({ category: '', priority: 'Medium', subject: '', description: '' });
      setTimeout(() => {
        setSubmitState('idle');
        setActiveTab('history');
      }, 2000);
    } catch (err: unknown) {
      console.error('Support request submit error:', err);
      const msg =
        err instanceof Error ? err.message : 'Failed to submit. Please try again.';
      setSubmitError(msg);
      setSubmitState('error');
    }
  };

  const priorityMeta = (p: SupportPriority) =>
    PRIORITIES.find((x) => x.value === p)!;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-7xl"
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <HeadphonesIcon className="text-brand-500" size={32} />
          System Support
        </h1>
        <p className="text-slate-500 mt-1">
          Contact a system admin for technical help, urgent cases, or policy
          guidance — based on their live availability.
        </p>
      </header>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Admins Online',   value: onlineCount,   icon: Circle,       color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Admins Busy',     value: busyCount,     icon: Clock,        color: 'text-amber-500',   bg: 'bg-amber-50'   },
          { label: 'My Open Tickets', value: pendingCount,  icon: Inbox,        color: 'text-brand-500',   bg: 'bg-brand-50'   },
          { label: 'Resolved',        value: resolvedCount, icon: CheckCircle2, color: 'text-slate-500',   bg: 'bg-slate-50'   },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-5 flex items-center gap-4"
          >
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
                stat.bg
              )}
            >
              <stat.icon size={20} className={stat.color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
              <p className="text-xs font-semibold text-slate-400">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Main Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

        {/* ── Left: Admin Availability (2 / 5) ─────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-6 space-y-5">
            {/* panel header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Admin Availability
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time status of system admins
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-emerald-700">Live</span>
              </div>
            </div>

            {admins.length === 0 ? (
              <div className="py-10 text-center">
                <LifeBuoy className="text-slate-300 mx-auto mb-3" size={36} />
                <p className="text-sm text-slate-400">No admins found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...admins]
                  .sort((a, b) => {
                    const ord = { online: 0, busy: 1, away: 2, offline: 3 };
                    return ord[a.availability] - ord[b.availability];
                  })
                  .map((admin) => {
                    const meta = AVAIL_META[admin.availability];
                    const contactable =
                      admin.availability === 'online' ||
                      admin.availability === 'busy';

                    return (
                      <div
                        key={admin.id}
                        className={cn(
                          'flex items-center gap-3 p-3.5 rounded-2xl border transition-all',
                          contactable
                            ? 'bg-white border-slate-100 shadow-sm hover:shadow-md'
                            : 'bg-slate-50/50 border-slate-100 opacity-60'
                        )}
                      >
                        {/* avatar */}
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold text-sm shadow-sm overflow-hidden">
                            {admin.profileImageUrl ? (
                              <img
                                src={admin.profileImageUrl}
                                alt={admin.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              getInitials(admin.name)
                            )}
                          </div>
                          <span
                            className={cn(
                              'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-white rounded-full',
                              meta.dot
                            )}
                          />
                        </div>

                        {/* info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">
                            {admin.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={cn(
                                'text-[10px] font-bold uppercase tracking-wider',
                                meta.text
                              )}
                            >
                              {meta.label}
                            </span>
                            {admin.role && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="text-[10px] text-slate-400 truncate">
                                  {admin.role}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* quick-chat button */}
                        {contactable && (
                          <button
                            onClick={() => setSelectedAdminChatId(admin.id)}
                            title="Open chat"
                            className="shrink-0 p-2 rounded-xl text-brand-500 hover:bg-brand-50 transition-all"
                          >
                            <MessageSquare size={16} />
                          </button>
                        )}
                      </div>
                    );
                })}
              </div>
            )}
          </div>

          {/* legend */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Status Guide
            </h3>
            <div className="space-y-2">
              {(
                Object.entries(AVAIL_META) as [
                  AdminAvailability['availability'],
                  (typeof AVAIL_META)[AdminAvailability['availability']]
                ][]
              ).map(([key, m]) => (
                <div key={key} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'w-2.5 h-2.5 rounded-full shrink-0',
                      m.dot
                    )}
                  />
                  <span className="text-xs font-semibold text-slate-600 capitalize w-14">
                    {m.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    {key === 'online'  && 'Available for immediate assistance'}
                    {key === 'busy'    && 'Occupied — may respond with delay'}
                    {key === 'away'    && 'Temporarily away from portal'}
                    {key === 'offline' && 'Not currently logged in'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <AdvisorChat embedded initialAdminId={selectedAdminChatId} />
        </div>

        {/* ── Right: New Request / History (3 / 5) ─────────────────────── */}
        <div className="lg:col-span-3 space-y-4">

          {/* tab switcher */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
            {(['new', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-5 py-2 rounded-xl text-sm font-semibold transition-all',
                  activeTab === tab
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {tab === 'new'
                  ? '+ New Request'
                  : `My Requests${requests.length ? ` (${requests.length})` : ''}`}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">

            {/* ── NEW REQUEST ─────────────────────────────────────────── */}
            {activeTab === 'new' && (
              <motion.div
                key="new"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="glass-card p-7 space-y-6"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Create Support Request
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Submit a ticket and an available admin will respond as soon
                    as possible.
                  </p>
                </div>

                {submitState === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl text-sm font-semibold"
                  >
                    <CheckCircle2
                      size={18}
                      className="shrink-0 text-emerald-600"
                    />
                    Request submitted! Redirecting to history…
                  </motion.div>
                )}

                {submitState === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-sm font-semibold"
                  >
                    <AlertCircle size={18} className="shrink-0 text-rose-600" />
                    {submitError}
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">

                  {/* Category */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">
                      Category <span className="text-rose-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, category: cat.value }))
                          }
                          className={cn(
                            'flex flex-col items-start gap-1.5 p-3.5 rounded-2xl border text-left transition-all',
                            form.category === cat.value
                              ? 'border-brand-400 bg-brand-50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          )}
                        >
                          <cat.icon
                            size={16}
                            className={
                              form.category === cat.value
                                ? 'text-brand-500'
                                : 'text-slate-400'
                            }
                          />
                          <span
                            className={cn(
                              'text-xs font-bold leading-tight',
                              form.category === cat.value
                                ? 'text-brand-700'
                                : 'text-slate-700'
                            )}
                          >
                            {cat.value}
                          </span>
                          <span className="text-[10px] text-slate-400 leading-snug">
                            {cat.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">
                      Priority
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {PRIORITIES.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, priority: p.value }))
                          }
                          className={cn(
                            'flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all',
                            form.priority === p.value
                              ? cn(p.bg, p.color, 'border-current shadow-sm')
                              : 'border-slate-200 text-slate-500 hover:border-slate-300'
                          )}
                        >
                          <span
                            className={cn('w-2 h-2 rounded-full', p.dot)}
                          />
                          {p.value}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500">
                      Subject <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.subject}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, subject: e.target.value }))
                      }
                      placeholder="Brief summary of your issue…"
                      maxLength={120}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-400 focus:bg-white text-sm text-slate-800 transition-all"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500">
                      Description <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                      placeholder="Describe the issue in detail — include relevant user IDs, error messages, or steps to reproduce…"
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-400 focus:bg-white text-sm text-slate-800 transition-all resize-none"
                    />
                    <p className="text-[10px] text-slate-400 text-right">
                      {form.description.length} characters
                    </p>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={
                      submitState === 'loading' || submitState === 'success'
                    }
                    className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500 text-white rounded-xl font-semibold text-sm hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.98]"
                  >
                    {submitState === 'loading' ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Submit Support Request
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── HISTORY ─────────────────────────────────────────────── */}
            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                {/* filter bar */}
                <div className="glass-card p-4 flex items-center gap-3 flex-wrap">
                  <Filter size={15} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-500">
                    Filter:
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {(
                      [
                        'all',
                        'pending',
                        'in_progress',
                        'resolved',
                        'closed',
                      ] as const
                    ).map((s) => (
                      <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={cn(
                          'px-3 py-1 rounded-full text-xs font-bold transition-all',
                          filterStatus === s
                            ? 'bg-brand-500 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        )}
                      >
                        {s === 'all' ? 'All' : STATUS_META[s].label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredRequests.length === 0 ? (
                  <div className="glass-card py-16 text-center">
                    <Inbox
                      className="text-slate-300 mx-auto mb-3"
                      size={40}
                    />
                    <p className="text-sm font-semibold text-slate-400">
                      No support requests yet
                    </p>
                    <p className="text-xs text-slate-300 mt-1">
                      Your submitted tickets will appear here.
                    </p>
                    <button
                      onClick={() => setActiveTab('new')}
                      className="mt-4 px-4 py-2 bg-brand-50 text-brand-600 rounded-xl text-xs font-semibold hover:bg-brand-100 transition-all"
                    >
                      Create your first request
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRequests.map((req) => {
                      const sm = STATUS_META[req.status];
                      const pm = priorityMeta(req.priority);
                      const cat = CATEGORIES.find(
                        (c) => c.value === req.category
                      );
                      const CatIcon = cat?.icon ?? LifeBuoy;

                      return (
                        <motion.div
                          key={req.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="glass-card p-5 space-y-3 hover:shadow-md transition-shadow"
                        >
                          {/* subject + status */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <CatIcon
                                size={15}
                                className="text-slate-400 shrink-0"
                              />
                              <p className="text-sm font-bold text-slate-800 truncate">
                                {req.subject}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide',
                                sm.bg,
                                sm.color
                              )}
                            >
                              <sm.icon size={10} />
                              {sm.label}
                            </span>
                          </div>

                          {/* description preview */}
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {req.description}
                          </p>

                          {/* meta chips */}
                          <div className="flex flex-wrap gap-2 items-center">
                            <span
                              className={cn(
                                'flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border',
                                pm.bg,
                                pm.color
                              )}
                            >
                              <span
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full',
                                  pm.dot
                                )}
                              />
                              {pm.value}
                            </span>

                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 text-[10px] font-bold border border-slate-100">
                              <Tag size={9} />
                              {req.category}
                            </span>

                            {req.adminName && (
                              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold border border-brand-100">
                                <User size={9} />
                                {req.adminName}
                              </span>
                            )}

                            <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                              <CalendarDays size={10} />
                              {formatTs(req.createdAt)}
                            </span>
                          </div>

                          {/* open chat thread */}
                          {req.chatId && (
                            <button
                              onClick={() => navigate('/chat')}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-brand-200 text-brand-600 text-xs font-semibold hover:bg-brand-50 transition-all"
                            >
                              <MessageSquare size={13} />
                              Open Chat Thread
                              <ChevronRight size={13} />
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
