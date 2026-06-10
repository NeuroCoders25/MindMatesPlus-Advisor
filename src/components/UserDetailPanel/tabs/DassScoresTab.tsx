import React, { useMemo } from 'react';
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
import { cn } from '../../../lib/utils';
import {
  getDassScores,
  getDASSSeverity,
  getSeverityColorClass,
  getSeverityBarColor,
  getMlTimestamp,
  tsToShort,
} from '../../../types/userDiagnostic';
import type { UserDiagnosticData } from '../../../types/userDiagnostic';

interface Props { data: UserDiagnosticData }

// ── Custom recharts dot ───────────────────────────────────────────────────────

interface DotProps {
  cx?: number;
  cy?: number;
  value?: number;
}

function WellnessDot(props: DotProps) {
  const { cx, cy, value } = props;
  if (cx === undefined || cy === undefined) return null;
  const v = value ?? 0;
  const fill = v >= 40 ? '#10b981' : v >= 20 ? '#f59e0b' : '#ef4444';
  return (
    <circle cx={cx} cy={cy} r={4} fill={fill} stroke="white" strokeWidth={1.5} />
  );
}

// ── Large score display ───────────────────────────────────────────────────────

function ScoreBlock({
  label,
  score,
  type,
}: {
  label: string;
  score: number | null;
  type: 'depression' | 'anxiety' | 'stress';
}) {
  const severity = score !== null ? getDASSSeverity(type, score) : '—';
  const barColor = score !== null ? getSeverityBarColor(severity) : '#e2e8f0';
  const chipCls  = score !== null ? getSeverityColorClass(severity) : 'bg-slate-50 text-slate-400';
  const pct      = score !== null ? Math.min(100, (score / 42) * 100) : 0;

  return (
    <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 space-y-3 min-w-0">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black" style={{ color: barColor }}>
          {score !== null ? score : '—'}
        </span>
        <span className="text-slate-400 text-sm mb-1">/ 42</span>
      </div>
      <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-semibold', chipCls)}>
        {severity}
      </span>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

// ── Overall severity banner ───────────────────────────────────────────────────

const SEVERITY_ORDER = ['Normal', 'Mild', 'Moderate', 'Severe', 'Extremely Severe'];

function highestSeverity(severities: string[]): string {
  let max = 0;
  for (const s of severities) {
    const idx = SEVERITY_ORDER.indexOf(s);
    if (idx > max) max = idx;
  }
  return SEVERITY_ORDER[max];
}

const BANNER_CLS: Record<string, string> = {
  'Normal':           'bg-emerald-50  text-emerald-800 border-emerald-200',
  'Mild':             'bg-yellow-50   text-yellow-800  border-yellow-200',
  'Moderate':         'bg-amber-50    text-amber-800   border-amber-200',
  'Severe':           'bg-red-50      text-red-800     border-red-200',
  'Extremely Severe': 'bg-red-100     text-red-900     border-red-300',
};

// ── Wellness chart ────────────────────────────────────────────────────────────

type ChartPoint = { date: string; score: number };

export default function DassScoresTab({ data }: Props) {
  const { mentalHealthProfile, wellnessHistory, mlHistory } = data;

  // Use getDassScores — reads initialQuestionnaireScore first, falls back to dass21Scores
  const { depression: dep, anxiety: anx, stress: str } = getDassScores(mentalHealthProfile);
  const hasDass = dep !== null || anx !== null || str !== null;

  const severities = [
    dep !== null ? getDASSSeverity('depression', dep) : null,
    anx !== null ? getDASSSeverity('anxiety',    anx) : null,
    str !== null ? getDASSSeverity('stress',      str) : null,
  ].filter((s): s is string => s !== null);

  const overall = severities.length > 0 ? highestSeverity(severities) : null;

  // Wellness history chart data
  const chartData: ChartPoint[] = useMemo(() => {
    if (wellnessHistory.length > 0) {
      return [...wellnessHistory]
        .reverse()
        .map((e) => ({
          date:  tsToShort(e.createdAt),
          score: typeof e.newScore === 'number' ? e.newScore : 0,
        }));
    }
    // Fall back: mlAnalysisHistory entries that carry wellnessScore
    const derivable = mlHistory.filter((e) => typeof e.wellnessScore === 'number');
    if (derivable.length > 0) {
      return [...derivable]
        .reverse()
        .map((e) => ({
          date:  tsToShort(getMlTimestamp(e)),
          score: e.wellnessScore as number,
        }));
    }
    return [];
  }, [wellnessHistory, mlHistory]);

  // Stability counter — lastPrediction is the correct field name, threshold = 5
  const counter    = mentalHealthProfile?.mlStabilityCounter ?? {};
  const repeated   = typeof counter.repeatedCount  === 'number' ? counter.repeatedCount  : 0;
  const maxDots    = typeof counter.maxCount        === 'number' ? counter.maxCount        : 5;
  const prediction = counter.lastPrediction ?? counter.currentPrediction ?? null;
  const daysBottom = typeof mentalHealthProfile?.consecutiveDaysAtBottom === 'number'
    ? mentalHealthProfile.consecutiveDaysAtBottom
    : 0;

  return (
    <div className="p-4 space-y-5">

      {/* ── Section A: Score detail ── */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          DASS-21 Scores
        </h3>
        {hasDass ? (
          <>
            <div className="flex gap-3">
              <ScoreBlock label="Depression" score={dep} type="depression" />
              <ScoreBlock label="Anxiety"    score={anx} type="anxiety"    />
              <ScoreBlock label="Stress"     score={str} type="stress"     />
            </div>
            {overall && (
              <div className={cn(
                'rounded-xl px-4 py-2.5 border text-sm font-bold text-center',
                BANNER_CLS[overall] ?? BANNER_CLS['Normal'],
              )}>
                Overall Severity: {overall.toUpperCase()}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400 italic">No DASS-21 data recorded yet.</p>
        )}
      </section>

      {/* ── Section B: Wellness Score History ── */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Wellness Score History
        </h3>
        {chartData.length >= 2 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                  formatter={(val: number) => [`${val}`, 'Wellness Score']}
                />
                <ReferenceLine
                  y={40}
                  stroke="#10b981"
                  strokeDasharray="4 2"
                  label={{ value: 'Healthy', position: 'insideRight', fontSize: 10, fill: '#10b981' }}
                />
                <ReferenceLine
                  y={20}
                  stroke="#ef4444"
                  strokeDasharray="4 2"
                  label={{ value: 'Critical', position: 'insideRight', fontSize: 10, fill: '#ef4444' }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={(dotProps) => <WellnessDot {...(dotProps as DotProps)} />}
                  activeDot={{ r: 5, stroke: '#6366f1', strokeWidth: 2, fill: 'white' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-slate-400 italic">
              Insufficient history data — score history begins accumulating after first ML event.
            </p>
          </div>
        )}
      </section>

      {/* ── Section C: Stability Counter ── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          ML Stability Counter
        </h3>
        <div className="flex items-center gap-3">
          {/* Dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: maxDots }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs',
                  i < repeated
                    ? 'bg-brand-500 border-brand-500'
                    : 'bg-white border-slate-300',
                )}
              />
            ))}
          </div>
          <span className="text-sm font-bold text-slate-700">
            {repeated} / {maxDots}
          </span>
          {prediction && (
            <span className="ml-2 text-xs text-slate-500">
              Current prediction:{' '}
              <span className="font-semibold text-slate-700 capitalize">{prediction}</span>
            </span>
          )}
        </div>
        {daysBottom > 0 && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
            ⚠ User has been at Moderate Support floor for{' '}
            <strong>{daysBottom}</strong> consecutive day{daysBottom !== 1 ? 's' : ''}.
            Escalation evaluation may be triggered.
          </div>
        )}
      </section>

    </div>
  );
}
