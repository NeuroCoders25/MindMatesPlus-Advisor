import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import LiveDiagnosticsPanel from '../LiveDiagnosticsPanel';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { db } from '../../../lib/firebase';
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { cn } from '../../../lib/utils';
import {
  getDassScores,
  getDASSSeverity,
  getSeverityColorClass,
  getSeverityBarColor,
  resolveActiveRecommendation,
  getCategoryColor,
  normalizeUserStatus,
  getLabelChipClass,
  getSourceIcon,
  getMlTimestamp,
  getJournalTimestamp,
  tsToRelative,
  tsToShort,
} from '../../../types/userDiagnostic';
import type { UserDiagnosticData, MLHistoryEntry } from '../../../types/userDiagnostic';

interface Props {
  data: UserDiagnosticData;
  userId: string;
}

// ── Compact Wellness ring ────────────────────────────────────────────────────

function WellnessRing({ score }: { score: number }) {
  const radius  = 28;
  const circ    = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const progress = (clamped / 100) * circ;
  const color   = clamped >= 40 ? '#10b981' : clamped >= 20 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={radius}
        fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${progress} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
      />
      <text x="36" y="32" textAnchor="middle" fontSize="15" fontWeight="700" fill="#1e293b">
        {clamped}
      </text>
      <text x="36" y="44" textAnchor="middle" fontSize="8" fill="#94a3b8">/ 100</text>
    </svg>
  );
}

// ── Recharts custom dot ──────────────────────────────────────────────────────

interface DotProps { cx?: number; cy?: number; value?: number }
function WellnessDot({ cx, cy, value }: DotProps) {
  if (cx === undefined || cy === undefined) return null;
  const v    = value ?? 0;
  const fill = v >= 40 ? '#10b981' : v >= 20 ? '#f59e0b' : '#ef4444';
  return <circle cx={cx} cy={cy} r={3} fill={fill} stroke="white" strokeWidth={1.5} />;
}

// ── DASS score block ─────────────────────────────────────────────────────────

function ScoreBlock({
  label, score, type,
}: { label: string; score: number | null; type: 'depression' | 'anxiety' | 'stress' }) {
  const severity = score !== null ? getDASSSeverity(type, score) : '—';
  const barColor = score !== null ? getSeverityBarColor(severity) : '#e2e8f0';
  const chipCls  = score !== null ? getSeverityColorClass(severity) : 'bg-slate-50 text-slate-400';
  const pct      = score !== null ? Math.min(100, (score / 42) * 100) : 0;

  return (
    <div className="flex-1 bg-slate-50 rounded-xl p-3 space-y-1.5 min-w-0">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-black leading-none" style={{ color: barColor }}>
          {score !== null ? score : '—'}
        </span>
        <span className="text-slate-400 text-[10px] mb-0.5">/ 42</span>
      </div>
      <span className={cn('inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold', chipCls)}>
        {severity}
      </span>
      <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  );
}

// ── KNN Safety flag card ─────────────────────────────────────────────────────

function KnnSafetyCard({ userId, data }: { userId: string; data: UserDiagnosticData }) {
  const { currentUser } = useAuth();
  const [reviewing, setReviewing] = useState(false);
  const { advisorConnection } = data;

  async function handleMarkReviewed() {
    if (reviewing || !currentUser) return;
    setReviewing(true);
    try {
      await updateDoc(doc(db, 'users', userId), { knnSafetyFlag: false });
      if (advisorConnection?.id) {
        await addDoc(
          collection(db, 'advisorConnections', advisorConnection.id, 'auditLog'),
          { action: 'knn_safety_flag_cleared', advisorId: currentUser.uid, timestamp: serverTimestamp() },
        );
      }
    } catch (err) {
      console.error('[OverviewTab] markReviewed:', err);
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="col-span-full bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <AlertTriangle className="text-red-500 shrink-0" size={20} />
      <div className="flex-1">
        <p className="text-sm font-bold text-red-800">
          ⚠ Crisis Safety Flag — KNN predicted G1 (Crisis Peer Support)
        </p>
        <p className="text-xs text-red-600 mt-0.5">Auto-assignment blocked. Advisor review required.</p>
      </div>
      <button
        onClick={handleMarkReviewed}
        disabled={reviewing}
        className="shrink-0 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-all"
      >
        {reviewing ? 'Clearing…' : 'Mark as Reviewed'}
      </button>
    </div>
  );
}

// ── BERT last-7-days stats ───────────────────────────────────────────────────

function last7DaysStats(entries: MLHistoryEntry[]) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = entries.filter((e) => {
    const v = e.timestamp as { seconds?: number } | string | undefined;
    if (!v) return false;
    const ms = typeof v === 'object' && v.seconds
      ? v.seconds * 1000
      : new Date(String(v)).getTime();
    return !isNaN(ms) && ms >= cutoff;
  });
  let depression = 0, anxiety = 0, normal = 0;
  for (const e of recent) {
    const l = (e.prediction ?? '').toLowerCase();
    if (l.includes('depress')) depression++;
    else if (l.includes('anxi')) anxiety++;
    else normal++;
  }
  return { total: recent.length, depression, anxiety, normal };
}

// ── Main component ───────────────────────────────────────────────────────────

export default function OverviewTab({ data, userId }: Props) {
  const { profile, mentalHealthProfile, journalEntries, mlHistory, wellnessHistory } = data;

  // Wellness
  const wellnessScore = profile?.wellnessScore ?? mentalHealthProfile?.wellnessScore ?? 0;
  const status        = normalizeUserStatus(profile, mentalHealthProfile);
  const statusColors: Record<string, string> = {
    'Active':       'bg-emerald-50 text-emerald-700',
    'Monitoring':   'bg-amber-50   text-amber-700',
    'Restricted':   'bg-red-50     text-red-700',
    'Under Review': 'bg-blue-50    text-blue-700',
    'Inactive':     'bg-slate-100  text-slate-500',
  };

  const activeRec = profile ? resolveActiveRecommendation(profile, mentalHealthProfile) : null;
  const catColor  = getCategoryColor(activeRec?.category);

  // Safety flag
  const knnFlag = (profile?.knnSafetyFlag ?? mentalHealthProfile?.knnSafetyFlag) === true;

  // DASS-21 — reads initialQuestionnaireScore first, then falls back to dass21Scores
  const { depression: dep, anxiety: anx, stress: str } = getDassScores(mentalHealthProfile);
  const hasDass = dep !== null || anx !== null || str !== null;

  // ML Pipeline waterfall — P1 is peerGroupRecommendationCategory
  const p1Val     = profile?.peerGroupRecommendationCategory ?? mentalHealthProfile?.peerGroupRecommendationCategory
                  ?? profile?.weeklyTrendCategory ?? mentalHealthProfile?.weeklyTrendCategory;
  const knnMapped = profile?.knnMappedCategory ?? mentalHealthProfile?.knnMappedCategory;
  const baseline  = profile?.baselineRecommendationCategory ?? mentalHealthProfile?.baselineRecommendationCategory;
  const activeCat = profile?.activeRecommendationCategory   ?? mentalHealthProfile?.activeRecommendationCategory;

  const waterfall = [
    { priority: 1, source: 'Weekly Trend', value: p1Val    ?? '—', blocked: false },
    { priority: 2, source: 'KNN Mapped',   value: knnFlag ? '⚠ G1 — BLOCKED' : (knnMapped ?? '—'), blocked: knnFlag },
    { priority: 3, source: 'Baseline',     value: baseline ?? '—', blocked: false },
    { priority: 4, source: 'Active (ML)',  value: activeCat ?? '—', blocked: false },
  ];

  // BERT History summary
  const bertStats  = useMemo(() => last7DaysStats(mlHistory), [mlHistory]);
  const recentBert = mlHistory.slice(0, 4);

  // ML Stability Counter — lastPrediction is the correct field name (threshold = 5)
  const counter      = mentalHealthProfile?.mlStabilityCounter ?? {};
  const repeated     = typeof counter.repeatedCount === 'number' ? counter.repeatedCount : 0;
  const maxDots      = typeof counter.maxCount      === 'number' ? counter.maxCount      : 5;
  const stabilityLabel = counter.lastPrediction ?? counter.currentPrediction
                       ?? profile?.mlMentalHealthProfile?.dominantCategory ?? null;

  // Wellness score history chart
  type ChartPoint = { date: string; score: number };
  const chartData: ChartPoint[] = useMemo(() => {
    if (wellnessHistory.length > 0) {
      return [...wellnessHistory].reverse().map((e) => ({
        date:  tsToShort(e.createdAt),
        score: typeof e.newScore === 'number' ? e.newScore : 0,
      }));
    }
    const derivable = mlHistory.filter((e) => typeof e.wellnessScore === 'number');
    if (derivable.length > 0) {
      return [...derivable].reverse().map((e) => ({
        date:  tsToShort(getMlTimestamp(e)),
        score: e.wellnessScore as number,
      }));
    }
    return [];
  }, [wellnessHistory, mlHistory]);

  // Use correct timestamp fields
  const lastJournal = journalEntries[0] ? getJournalTimestamp(journalEntries[0]) : undefined;
  const lastMl      = mlHistory[0] ? getMlTimestamp(mlHistory[0]) : undefined;

  return (
    <div className="p-4 space-y-3">

      {/* KNN safety banner */}
      {knnFlag && <KnnSafetyCard userId={userId} data={data} />}

      {/* ══ Row 1: Wellness Score + ML Pipeline ══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Wellness Score — compact horizontal */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-3">
          <WellnessRing score={wellnessScore} />
          <div className="space-y-1.5 min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Wellness Score
            </p>
            <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', statusColors[status] ?? statusColors['Active'])}>
              {status}
            </span>
            {activeRec && (
              <div
                className="rounded-lg px-2 py-1 text-white text-[11px] font-bold text-center truncate"
                style={{ background: catColor }}
              >
                {activeRec.category}
              </div>
            )}
          </div>
        </div>

        {/* ML Pipeline — compact waterfall */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">ML Pipeline</p>
          </div>
          <div className="divide-y divide-slate-50">
            {waterfall.map((row) => {
              const isActive   = activeRec?.source === row.source;
              const activeIdx  = waterfall.findIndex((r) => r.source === activeRec?.source);
              const rowIdx     = waterfall.findIndex((r) => r.source === row.source);
              const isOverride = !isActive && rowIdx < activeIdx;
              const accent     = isActive ? getCategoryColor(row.value) : undefined;

              return (
                <div
                  key={row.priority}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2',
                    isActive   && 'bg-brand-50/40',
                    isOverride && 'opacity-40',
                  )}
                  style={isActive ? { borderLeft: `3px solid ${accent}` } : { borderLeft: '3px solid transparent' }}
                >
                  <span className="text-[10px] font-bold text-slate-400 w-3 shrink-0">{row.priority}</span>
                  <span className="text-xs text-slate-600 flex-1">{row.source}</span>
                  <span className={cn(
                    'text-xs truncate max-w-[110px]',
                    isActive    && 'font-semibold text-slate-900',
                    isOverride  && 'line-through text-slate-400',
                    row.blocked && 'text-red-600 font-semibold no-underline',
                    !isActive && !isOverride && !row.blocked && 'text-slate-500',
                  )}>
                    {row.value}
                  </span>
                  {isActive && (
                    <span className="shrink-0 px-1.5 py-0.5 bg-brand-100 text-brand-700 rounded-full text-[9px] font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ Row 2: DASS-21 + BERT History ══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* DASS-21 Full Scores */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">DASS-21 Scores</p>
          {hasDass ? (
            <div className="flex gap-2">
              <ScoreBlock label="Dep."   score={dep} type="depression" />
              <ScoreBlock label="Anx."   score={anx} type="anxiety"    />
              <ScoreBlock label="Stress" score={str} type="stress"     />
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No DASS-21 data recorded yet</p>
          )}
        </div>

        {/* BERT History summary */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">BERT History</p>
            <span className="text-[10px] text-slate-400">Last 7 days</span>
          </div>
          {mlHistory.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] bg-slate-50 rounded-lg px-2 py-1.5">
                <span className="font-semibold text-slate-600">{bertStats.total} events</span>
                <span className="text-red-600">Dep: <strong>{bertStats.depression}</strong></span>
                <span className="text-amber-600">Anx: <strong>{bertStats.anxiety}</strong></span>
                <span className="text-emerald-600">Norm: <strong>{bertStats.normal}</strong></span>
              </div>
              <div className="space-y-1">
                {recentBert.map((entry) => {
                  const conf = typeof entry.confidence === 'number' ? entry.confidence : null;
                  return (
                    <div key={entry.id} className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-400 tabular-nums w-10 shrink-0">
                        {tsToRelative(entry.timestamp)}
                      </span>
                      <span className="text-slate-500 shrink-0">{getSourceIcon(entry.source)}</span>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded-full font-semibold capitalize',
                        getLabelChipClass(entry.prediction ?? ''),
                      )}>
                        {entry.prediction ?? '—'}
                      </span>
                      {conf !== null && (
                        <span className="ml-auto text-slate-400 tabular-nums shrink-0">
                          {(conf * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 italic">No ML event history yet</p>
          )}
        </div>
      </div>

      {/* ══ Row 3: Wellness Score History chart ══ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          Wellness Score History
        </p>
        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={chartData} margin={{ top: 6, right: 20, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                ticks={[0, 25, 50, 75, 100]}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', padding: '4px 8px' }}
                formatter={(val: number) => [`${val}`, 'Wellness']}
              />
              <ReferenceLine
                y={40}
                stroke="#10b981"
                strokeDasharray="4 2"
                label={{ value: 'Healthy', position: 'insideRight', fontSize: 9, fill: '#10b981' }}
              />
              <ReferenceLine
                y={20}
                stroke="#ef4444"
                strokeDasharray="4 2"
                label={{ value: 'Critical', position: 'insideRight', fontSize: 9, fill: '#ef4444' }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={1.5}
                dot={(dotProps) => <WellnessDot {...(dotProps as DotProps)} />}
                activeDot={{ r: 4, stroke: '#6366f1', strokeWidth: 2, fill: 'white' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 italic py-2">
            Wellness history begins accumulating after first ML event.
          </p>
        )}
      </div>

      {/* ══ Row 4: ML Stability Counter + Last Activity ══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* ML Stability Counter */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            ML Stability Counter
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: maxDots }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 transition-colors',
                    i < repeated
                      ? 'bg-brand-500 border-brand-500'
                      : 'bg-white border-slate-300',
                  )}
                />
              ))}
            </div>
            <span className="text-sm font-bold text-slate-700">{repeated} / {maxDots}</span>
            {stabilityLabel && (
              <span className="text-xs text-slate-500 capitalize">
                — <span className="font-semibold text-slate-700">{stabilityLabel}</span>
              </span>
            )}
          </div>
          {(mentalHealthProfile?.consecutiveDaysAtBottom ?? 0) > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-amber-800">
              ⚠ {mentalHealthProfile!.consecutiveDaysAtBottom} consecutive day
              {mentalHealthProfile!.consecutiveDaysAtBottom !== 1 ? 's' : ''} at support floor
            </div>
          )}
        </div>

        {/* Last Activity */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Last Activity</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Last Journal</p>
              <p className="text-sm font-semibold text-slate-700">{tsToRelative(lastJournal)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Last ML Event</p>
              <p className="text-sm font-semibold text-slate-700">{tsToRelative(lastMl)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Live ML Diagnostic Dashboard (always visible) ══ */}
      <LiveDiagnosticsPanel data={data} userId={userId} />

    </div>
  );
}
