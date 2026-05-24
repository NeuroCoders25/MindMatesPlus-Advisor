import React, { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import {
  getLabelChipClass,
  getLabelColor,
  getSourceIcon,
  getMlTimestamp,
  tsToRelative,
} from '../../../types/userDiagnostic';
import type { UserDiagnosticData, MLHistoryEntry } from '../../../types/userDiagnostic';
import ConfidenceSparkline from '../ConfidenceSparkline';

interface Props { data: UserDiagnosticData }

function getEffect(entry: MLHistoryEntry, prevEntry: MLHistoryEntry | null): {
  label: string;
  cls:   string;
} {
  if (entry.triggeredCategoryMove) {
    return { label: '→ Category moved', cls: 'text-cyan-600 font-semibold' };
  }
  // Stability +1: same prediction as previous, no category move
  if (
    prevEntry &&
    entry.prediction &&
    prevEntry.prediction === entry.prediction &&
    !entry.triggeredCategoryMove
  ) {
    return { label: 'Stability +1', cls: 'text-blue-500 font-medium' };
  }
  return { label: 'No change', cls: 'text-slate-400' };
}

interface SummaryStats {
  total:      number;
  depression: number;
  anxiety:    number;
  normal:     number;
}

function last7DaysStats(entries: MLHistoryEntry[]): SummaryStats {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = entries.filter((e) => {
    // mlAnalysisHistory uses createdAt; getMlTimestamp handles both
    const v = getMlTimestamp(e);
    if (!v) return false;
    let ms: number;
    if (typeof v === 'object' && v !== null && 'seconds' in v) {
      ms = (v as { seconds: number }).seconds * 1000;
    } else {
      ms = new Date(String(v)).getTime();
    }
    return !isNaN(ms) && ms >= cutoff;
  });

  const stats: SummaryStats = { total: recent.length, depression: 0, anxiety: 0, normal: 0 };
  for (const e of recent) {
    const l = (e.prediction ?? '').toLowerCase();
    if (l.includes('depress')) stats.depression++;
    else if (l.includes('anxi')) stats.anxiety++;
    else stats.normal++;
  }
  return stats;
}

export default function BertHistoryTab({ data }: Props) {
  const { mlHistory } = data;

  const stats = useMemo(() => last7DaysStats(mlHistory), [mlHistory]);

  if (mlHistory.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-slate-400 italic leading-relaxed">
          No ML event history recorded. Events are logged after the user's first
          journal save, AI chat, or group chat message.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">

      {/* ── Summary bar ── */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-semibold text-slate-600">
          Last 7 days: <span className="text-slate-800">{stats.total}</span> events
        </span>
        <span className="text-red-600">Depression: <strong>{stats.depression}</strong></span>
        <span className="text-amber-600">Anxiety: <strong>{stats.anxiety}</strong></span>
        <span className="text-emerald-600">Normal: <strong>{stats.normal}</strong></span>
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[56px_1fr_1fr_70px_100px] px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <span>Time</span>
          <span>Source</span>
          <span>Prediction</span>
          <span className="text-right">Conf.</span>
          <span className="text-right pr-1">Effect</span>
        </div>

        <div className="divide-y divide-slate-50 max-h-[360px] overflow-y-auto">
          {mlHistory.map((entry, idx) => {
            // mlHistory is desc (latest first); prevEntry is the one before (older)
            const prevEntry = mlHistory[idx + 1] ?? null;
            const effect    = getEffect(entry, prevEntry);
            const conf      = typeof entry.confidence === 'number' ? entry.confidence : null;
            const predLabel = entry.prediction ?? '—';
            const isHighConf = conf !== null && conf >= 0.85;

            return (
              <div
                key={entry.id}
                className="grid grid-cols-[56px_1fr_1fr_70px_100px] px-3 py-2.5 items-center hover:bg-slate-50/50 transition-colors"
              >
                {/* Time */}
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {tsToRelative(getMlTimestamp(entry))}
                </span>

                {/* Source */}
                <span className="text-sm">
                  {getSourceIcon(entry.source)}{' '}
                  <span className="text-xs text-slate-500 ml-1 capitalize">
                    {entry.source ?? 'unknown'}
                  </span>
                </span>

                {/* Prediction chip */}
                <span
                  className={cn(
                    'inline-flex items-center self-start px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize w-fit',
                    getLabelChipClass(predLabel),
                  )}
                >
                  {predLabel}
                </span>

                {/* Confidence */}
                <span
                  className={cn(
                    'text-right text-xs tabular-nums',
                    isHighConf ? 'font-bold text-slate-800' : 'text-slate-500',
                  )}
                >
                  {conf !== null ? `${(conf * 100).toFixed(0)}%` : '—'}
                </span>

                {/* Effect */}
                <span className={cn('text-right text-[11px] pr-1', effect.cls)}>
                  {effect.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Confidence sparkline ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Confidence Trend
          </p>
          <span className="text-[10px] text-slate-400">Last {mlHistory.length} events</span>
        </div>
        <div className="pt-1">
          <ConfidenceSparkline events={mlHistory} />
        </div>
        <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-1">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-red-400 inline-block" /> Depression
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-amber-400 inline-block" /> Anxiety
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Normal
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <span className="w-4 border-t border-dashed border-slate-400 inline-block" /> 0.80 threshold
          </span>
        </div>
      </div>

    </div>
  );
}
