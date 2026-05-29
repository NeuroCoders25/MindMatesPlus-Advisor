import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Activity,
  ShieldAlert,
  Star,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import DashboardCard from '../components/DashboardCard';
import AlertPanel from '../components/AlertPanel';
import UserTable from '../components/UserTable';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { User, Alert, RiskLevel } from '../types';
import { subscribeAdvisorRatingSummary, RatingSummary } from '../services/advisorRatingService';

// ─── helpers (shared with UserMonitoring / CriticalCases) ────────────────────

function normalizeRiskLevel(value: unknown): RiskLevel {
  const v = String(value ?? '').toLowerCase().trim();
  if (v.includes('extremely') || v.includes('severe') || v === 'critical') return 'Critical';
  if (v.includes('high') || v.includes('moderate') || v === 'moderate') return 'High';
  if (v === 'medium' || v === 'mild') return 'Medium';
  return 'Low';
}

function normalizeStatus(value: unknown): User['status'] {
  const v = String(value ?? '').toLowerCase().trim();
  if (v === 'monitoring') return 'Monitoring';
  if (v === 'inactive') return 'Inactive';
  return 'Active';
}

function toRelativeTime(value: unknown): string {
  if (!value) return '—';
  let date: Date;
  if (typeof value === 'object' && value !== null && 'seconds' in (value as object)) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  } else {
    const s = String(value);
    if (!s || s === 'undefined' || s === 'null') return '—';
    date = new Date(s);
  }
  if (isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

interface RichUser extends User {
  depressionScore?: number;
  anxietyScore?: number;
  stressScore?: number;
  rawActivityMs: number;
}

const RISK_ORDER: Record<RiskLevel, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const ALERT_TYPE_MAP: Record<RiskLevel, Alert['type']> = {
  Critical: 'Self-Harm',
  High: 'Distress',
  Medium: 'Anxiety',
  Low: 'Anxiety',
};

// ─── hook ────────────────────────────────────────────────────────────────────

function useDashboardData() {
  const [users, setUsers] = useState<RichUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'users'),
      async (snap) => {
        try {
          const profileResults = await Promise.all(
            snap.docs.map((d) =>
              getDoc(doc(db, 'users', d.id, 'mentalHealthProfile', 'currentProfile'))
                .then((p) => ({ id: d.id, data: (p.exists() ? p.data() : {}) as Record<string, unknown> }))
                .catch(() => ({ id: d.id, data: {} as Record<string, unknown> }))
            )
          );
          const profileMap = new Map(profileResults.map((p) => [p.id, p.data]));

          const parsed: RichUser[] = snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            const profile = profileMap.get(d.id) ?? {};

            const iqScore = profile.initialQuestionnaireScore as Record<string, unknown> | undefined;
            const rawRisk =
              profile.classificationLevel ??
              profile.activeRecommendationCategory ??
              iqScore?.category ??
              data.classificationLevel ??
              data.riskLevel ??
              data.risk_level ??
              data.severity ??
              data.alertLevel;
            const riskLevel = normalizeRiskLevel(rawRisk);
            const rawStatus = data.status ?? (riskLevel === 'High' || riskLevel === 'Critical' ? 'Monitoring' : 'Active');
            const rawActivity = data.lastActivity ?? data.last_active ?? data.lastSeen ?? data.updatedAt;

            let rawActivityMs = 0;
            if (rawActivity) {
              if (typeof rawActivity === 'object' && 'seconds' in (rawActivity as object)) {
                rawActivityMs = (rawActivity as { seconds: number }).seconds * 1000;
              } else {
                const d2 = new Date(String(rawActivity));
                if (!isNaN(d2.getTime())) rawActivityMs = d2.getTime();
              }
            }

            return {
              id: d.id,
              name: (data.nickname ?? data.nickName ?? data.name ?? data.displayName ?? data.userName ?? data.fullName ?? 'Unknown') as string,
              riskLevel,
              status: normalizeStatus(rawStatus),
              lastActivity: toRelativeTime(rawActivity),
              rawActivityMs,
              depressionScore: typeof profile.depressionScore === 'number' ? (profile.depressionScore as number) : undefined,
              anxietyScore: typeof profile.anxietyScore === 'number' ? (profile.anxietyScore as number) : undefined,
              stressScore: typeof profile.stressScore === 'number' ? (profile.stressScore as number) : undefined,
            };
          });

          setUsers(parsed);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('[Dashboard]', err);
          setError('Failed to load dashboard data.');
          setLoading(false);
        }
      },
      (err) => {
        console.error('[Dashboard snapshot]', err);
        setError('Failed to load dashboard data.');
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { users, loading, error };
}

// ─── component ───────────────────────────────────────────────────────────────

const STATIC_TREND_DATA = [
  { name: 'Mon', distress: 4, wellness: 7 },
  { name: 'Tue', distress: 3, wellness: 8 },
  { name: 'Wed', distress: 7, wellness: 5 },
  { name: 'Thu', distress: 5, wellness: 6 },
  { name: 'Fri', distress: 8, wellness: 4 },
  { name: 'Sat', distress: 2, wellness: 9 },
  { name: 'Sun', distress: 1, wellness: 10 },
];

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className ?? ''}`} />;
}

export default function Dashboard() {
  const { advisorProfile, currentUser } = useAuth();
  const advisorName = advisorProfile?.name ?? 'Advisor';
  const { users, loading, error } = useDashboardData();

  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  useEffect(() => {
    if (!currentUser?.uid) return;
    return subscribeAdvisorRatingSummary(currentUser.uid, setRatingSummary);
  }, [currentUser?.uid]);

  // ── derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const highRisk = users.filter((u) => u.riskLevel === 'Critical' || u.riskLevel === 'High');
    const critical = users.filter((u) => u.riskLevel === 'Critical');
    const active = users.filter((u) => u.status === 'Active');
    const monitoring = users.filter((u) => u.status === 'Monitoring');

    // "Today" window
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const activeToday = users.filter((u) => u.rawActivityMs >= todayStart.getTime());

    return {
      highRisk: highRisk.length,
      critical: critical.length,
      activeAlerts: highRisk.length,   // each high/critical user is an active alert
      totalUsers: users.length,
      activeUsers: active.length,
      monitoringUsers: monitoring.length,
      activeToday: activeToday.length,
    };
  }, [users]);

  // ── top-risk users for the table (max 5) ──────────────────────────────────
  const topRiskUsers: User[] = useMemo(
    () =>
      [...users]
        .sort((a, b) => {
          const riskDiff = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
          if (riskDiff !== 0) return riskDiff;
          return b.rawActivityMs - a.rawActivityMs;
        })
        .slice(0, 5)
        .map(({ depressionScore: _d, anxietyScore: _a, stressScore: _s, rawActivityMs: _r, ...u }) => u),
    [users]
  );

  // ── alerts derived from high-risk users ───────────────────────────────────
  const derivedAlerts: Alert[] = useMemo(() => {
    const highRisk = [...users]
      .filter((u) => u.riskLevel === 'Critical' || u.riskLevel === 'High')
      .sort((a, b) => RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel])
      .slice(0, 6);

    return highRisk.map((u) => ({
      id: `alert-${u.id}`,
      userId: u.id,
      userName: u.name,
      type: ALERT_TYPE_MAP[u.riskLevel],
      timestamp: u.rawActivityMs ? new Date(u.rawActivityMs).toISOString() : new Date().toISOString(),
      severity: u.riskLevel,
      message:
        u.riskLevel === 'Critical'
          ? 'User flagged as critical risk – immediate review required.'
          : 'Elevated distress indicators detected in recent activity.',
    }));
  }, [users]);

  // ── DASS score averages for the bar chart ─────────────────────────────────
  const emotionData = useMemo(() => {
    const withScores = users.filter(
      (u) => u.depressionScore !== undefined || u.anxietyScore !== undefined || u.stressScore !== undefined
    );

    const avg = (key: keyof Pick<RichUser, 'depressionScore' | 'anxietyScore' | 'stressScore'>) => {
      const vals = withScores.map((u) => u[key]).filter((v): v is number => v !== undefined);
      if (vals.length === 0) return 0;
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    };

    const depression = avg('depressionScore');
    const anxiety = avg('anxietyScore');
    const stress = avg('stressScore');
    const hasRealData = withScores.length > 0;

    if (!hasRealData) {
      // fallback illustrative data
      return [
        { name: 'Anxiety', value: 45, color: '#f59e0b' },
        { name: 'Depression', value: 30, color: '#6366f1' },
        { name: 'Stress', value: 60, color: '#ef4444' },
      ];
    }
    return [
      { name: 'Anxiety', value: anxiety, color: '#f59e0b' },
      { name: 'Depression', value: depression, color: '#6366f1' },
      { name: 'Stress', value: stress, color: '#ef4444' },
    ];
  }, [users]);

  // ── dominant distress for insight text ────────────────────────────────────
  const dominantEmotion = useMemo(
    () => [...emotionData].sort((a, b) => b.value - a.value)[0],
    [emotionData]
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold text-slate-800">Advisor Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Welcome back, {advisorName}. Here's a live overview of system health.
        </p>
      </header>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm">
          <ShieldAlert size={18} />
          {error}
        </div>
      )}
      
      {/* ── stat cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {loading ? (
          <>
            <Skeleton className="h-[130px]" />
            <Skeleton className="h-[130px]" />
            <Skeleton className="h-[130px]" />
            <Skeleton className="h-[130px]" />
            <Skeleton className="h-[130px]" />
          </>
        ) : (
          <>
            <DashboardCard
              title="High-Risk Users"
              value={stats.highRisk}
              icon={Users}
              color="red"
            />
            <DashboardCard
              title="Active Alerts"
              value={stats.activeAlerts}
              icon={AlertCircle}
              color="amber"
            />
            <DashboardCard
              title="Active Today"
              value={stats.activeToday}
              icon={Activity}
              color="brand"
            />
            <DashboardCard
              title="Total Users"
              value={stats.totalUsers}
              icon={CheckCircle2}
              color="emerald"
            />
            <DashboardCard
              title="My Rating"
              value={
                ratingSummary && ratingSummary.ratingCount > 0
                  ? `${ratingSummary.averageRating.toFixed(1)} ★`
                  : '—'
              }
              icon={Star}
              color="amber"
            />
          </>
        )}
      </div>

      {/* ── secondary stats row ── */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Critical', value: stats.critical, dot: 'bg-red-500' },
            { label: 'Monitoring', value: stats.monitoringUsers, dot: 'bg-amber-500' },
            { label: 'Active', value: stats.activeUsers, dot: 'bg-emerald-500' },
            { label: 'All Users', value: stats.totalUsers, dot: 'bg-brand-500' },
          ].map(({ label, value, dot }) => (
            <div key={label} className="glass-card px-5 py-4 flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
              <span className="text-sm text-slate-500 flex-1">{label}</span>
              <span className="text-lg font-bold text-slate-800">{value}</span>
            </div>
          ))}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* ── trend chart ── */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-bold text-slate-800">Emotional Trends</h3>
                <p className="text-xs text-slate-400">System-wide distress vs. wellness indicators</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-brand-500"></div>
                  <span className="text-xs font-medium text-slate-500">Wellness</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <span className="text-xs font-medium text-slate-500">Distress</span>
                </div>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={STATIC_TREND_DATA}>
                  <defs>
                    <linearGradient id="colorWellness" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3354ff" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3354ff" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDistress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="wellness" stroke="#3354ff" strokeWidth={3} fillOpacity={1} fill="url(#colorWellness)" />
                  <Area type="monotone" dataKey="distress" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDistress)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* ── user table ── */}
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Users Requiring Attention</h3>
              <span className="text-xs text-slate-400">{topRiskUsers.length} shown</span>
            </div>
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : topRiskUsers.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">No users found.</p>
            ) : (
              <UserTable users={topRiskUsers} />
            )}
          </div>
        </div>
        
        <div className="space-y-8">
          {/* ── alert panel ── */}
          {loading ? (
            <Skeleton className="h-64" />
          ) : (
            <AlertPanel alerts={derivedAlerts} />
          )}
          
          {/* ── distress bar chart ── */}
          <div className="glass-card p-6">
            <h3 className="font-bold text-slate-800 mb-1">AI Distress Analysis</h3>
            <p className="text-xs text-slate-400 mb-6">
              Average DASS-21 scores across {loading ? '…' : users.length} users
            </p>
            {loading ? (
              <Skeleton className="h-[200px]" />
            ) : (
              <>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={emotionData} layout="vertical" margin={{ left: -20 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                        {emotionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className="text-emerald-500" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Insight</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {dominantEmotion
                      ? <>
                          <span className="font-bold" style={{ color: dominantEmotion.color }}>{dominantEmotion.name}</span>
                          {' '}is the leading distress indicator with an average score of{' '}
                          <span className="font-bold text-slate-700">{dominantEmotion.value}</span>
                          {' '}across all users.
                        </>
                      : 'No distress data available yet.'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* ── risk distribution ── */}
          {!loading && users.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="font-bold text-slate-800 mb-4">Risk Distribution</h3>
              <div className="space-y-3">
                {(
                  [
                    { label: 'Critical', color: 'bg-red-500', key: 'Critical' as RiskLevel },
                    { label: 'High', color: 'bg-orange-500', key: 'High' as RiskLevel },
                    { label: 'Medium', color: 'bg-amber-400', key: 'Medium' as RiskLevel },
                    { label: 'Low', color: 'bg-emerald-500', key: 'Low' as RiskLevel },
                  ] as const
                ).map(({ label, color, key }) => {
                  const count = users.filter((u) => u.riskLevel === key).length;
                  const pct = users.length > 0 ? Math.round((count / users.length) * 100) : 0;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-600">{label}</span>
                        <span className="text-slate-400">{count} users ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
