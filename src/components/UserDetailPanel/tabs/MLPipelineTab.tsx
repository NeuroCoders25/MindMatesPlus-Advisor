import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  resolveActiveRecommendation,
  getCategoryColor,
  CATEGORY_DESCRIPTIONS,
  tsToFull,
} from '../../../types/userDiagnostic';
import type { UserDiagnosticData } from '../../../types/userDiagnostic';

interface Props { data: UserDiagnosticData }

interface WaterfallRow {
  priority: number;
  source:   string;
  value:    string;
  blocked?: boolean;
}

export default function MLPipelineTab({ data }: Props) {
  const { profile, mentalHealthProfile } = data;
  const [accordionOpen, setAccordionOpen] = useState(false);

  if (!profile) {
    return (
      <div className="p-6 text-sm text-slate-400 italic text-center">
        Loading ML pipeline data…
      </div>
    );
  }

  // P1: peerGroupRecommendationCategory (weekly trend driving HomeScreen)
  const weeklyTrend = profile.peerGroupRecommendationCategory ?? mentalHealthProfile?.peerGroupRecommendationCategory
                    ?? profile.weeklyTrendCategory ?? mentalHealthProfile?.weeklyTrendCategory;
  const knnMapped   = profile.knnMappedCategory ?? mentalHealthProfile?.knnMappedCategory;
  const knnFlag     = (profile.knnSafetyFlag    ?? mentalHealthProfile?.knnSafetyFlag) === true;
  const baseline    = profile.baselineRecommendationCategory ?? mentalHealthProfile?.baselineRecommendationCategory;
  const activeCat   = profile.activeRecommendationCategory   ?? mentalHealthProfile?.activeRecommendationCategory;

  const activeRec = resolveActiveRecommendation(profile, mentalHealthProfile);

  const waterfall: WaterfallRow[] = [
    {
      priority: 1,
      source:   'Weekly Trend',
      value:    weeklyTrend ?? '—',
    },
    {
      priority: 2,
      source:   'KNN Mapped',
      value:    knnFlag ? '⚠ G1 — BLOCKED' : (knnMapped ?? '—'),
      blocked:  knnFlag,
    },
    {
      priority: 3,
      source:   'Baseline',
      value:    baseline ?? '—',
    },
    {
      priority: 4,
      source:   'Active (ML)',
      value:    activeCat ?? '—',
    },
  ];

  function getStatus(row: WaterfallRow): 'active' | 'overridden' | 'inactive' {
    if (row.source === activeRec.source) return 'active';
    const activeIdx  = waterfall.findIndex((r) => r.source === activeRec.source);
    const currentIdx = waterfall.findIndex((r) => r.source === row.source);
    if (currentIdx < activeIdx) return 'overridden';
    return 'inactive';
  }

  // KNN details — direct fields on currentProfile (primary), legacy lastKnnResult (fallback)
  const knnGroup    = mentalHealthProfile?.knnRecommendedGroup
                    ?? (typeof mentalHealthProfile?.lastKnnResult?.group === 'string' ? mentalHealthProfile.lastKnnResult.group : null);
  const knnCat      = mentalHealthProfile?.knnMappedCategory
                    ?? (typeof mentalHealthProfile?.lastKnnResult?.mappedCategory === 'string' ? mentalHealthProfile.lastKnnResult.mappedCategory : null);
  const knnProbs    = mentalHealthProfile?.knnProbabilities ?? mentalHealthProfile?.lastKnnResult?.groupProbabilities ?? null;
  const knnSafety   = mentalHealthProfile?.knnSafetyFlag;
  const knnFallback = mentalHealthProfile?.knnFallbackReason ?? null;
  const knnLastAt   = mentalHealthProfile?.knnLastUpdatedAt  ?? mentalHealthProfile?.lastKnnResult?.lastRun ?? null;
  const lastUpdated = mentalHealthProfile?.lastUpdated;

  // Stability counter
  const counter   = mentalHealthProfile?.mlStabilityCounter ?? {};
  const repeated  = typeof counter.repeatedCount === 'number' ? counter.repeatedCount : 0;
  const maxDots   = typeof counter.maxCount      === 'number' ? counter.maxCount      : 5;
  const stabLabel = counter.lastPrediction ?? counter.currentPrediction ?? null;

  return (
    <div className="p-4 space-y-5">

      {/* ── Waterfall table ── */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[32px_1fr_1fr_80px] px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <span>#</span>
          <span>Source</span>
          <span>Current Value</span>
          <span className="text-right">Status</span>
        </div>

        {waterfall.map((row) => {
          const rowStatus = getStatus(row);
          const isActive  = rowStatus === 'active';
          const isOverridden = rowStatus === 'overridden';
          const accentColor  = isActive ? getCategoryColor(row.value) : undefined;

          return (
            <div
              key={row.priority}
              className={cn(
                'grid grid-cols-[32px_1fr_1fr_80px] px-4 py-3 border-b border-slate-50 items-center transition-colors',
                isActive    && 'bg-brand-50/40',
                isOverridden && 'opacity-50',
              )}
              style={isActive ? { borderLeft: `3px solid ${accentColor}` } : { borderLeft: '3px solid transparent' }}
            >
              {/* Priority */}
              <span className="text-xs font-bold text-slate-400">{row.priority}</span>

              {/* Source */}
              <span className="text-sm font-medium text-slate-700">{row.source}</span>

              {/* Value */}
              <span
                className={cn(
                  'text-sm',
                  isActive     && 'font-semibold text-slate-900',
                  isOverridden && 'line-through text-slate-400',
                  row.blocked  && 'text-red-600 font-semibold no-underline',
                  !isActive && !isOverridden && !row.blocked && 'text-slate-500',
                )}
              >
                {row.value}
              </span>

              {/* Status badge */}
              <div className="flex justify-end">
                {isActive ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                    ACTIVE
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-300 text-xs">
                    <span className="w-3 h-3 rounded-full border border-slate-300" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── KNN Detail box ── */}
      {(knnGroup || knnCat || knnProbs) && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">KNN Detail</h3>
          <div className="grid grid-cols-2 gap-3">
            {knnGroup && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Group</p>
                <p className="font-semibold text-slate-700 text-xs mt-0.5">{knnGroup}</p>
              </div>
            )}
            {knnCat && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Category</p>
                <p className="font-semibold text-slate-700 text-xs mt-0.5">{knnCat}</p>
              </div>
            )}
            {knnSafety !== undefined && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Safety Flag</p>
                <p className={`font-semibold text-xs mt-0.5 ${knnSafety ? 'text-red-600' : 'text-emerald-600'}`}>
                  {String(knnSafety)}
                </p>
              </div>
            )}
            {knnFallback && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Fallback</p>
                <p className="font-semibold text-amber-600 text-xs mt-0.5">{knnFallback}</p>
              </div>
            )}
            {(knnLastAt || lastUpdated) && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Last Run</p>
                <p className="font-semibold text-slate-700 text-xs mt-0.5">
                  {tsToFull(knnLastAt ?? lastUpdated)}
                </p>
              </div>
            )}
          </div>
          {/* Group probabilities */}
          {knnProbs && Object.keys(knnProbs).length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Group Probabilities</p>
              {Object.entries(knnProbs).sort((a, b) => b[1] - a[1]).map(([group, prob]) => {
                const pct   = Math.round(prob * 100);
                const color = pct >= 40 ? '#f59e0b' : pct >= 20 ? '#6366f1' : '#cbd5e1';
                return (
                  <div key={group} className="grid grid-cols-[110px_1fr_36px] items-center gap-2 text-xs">
                    <span className="text-slate-500 truncate">{group.replace(/_/g, ' ')}</span>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="text-right font-semibold" style={{ color }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
          {/* Stability counter */}
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">ML Stability Counter</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {Array.from({ length: maxDots }).map((_, i) => (
                  <span key={i} className={`w-4 h-4 rounded-full border-2 ${i < repeated ? 'bg-brand-500 border-brand-500' : 'bg-white border-slate-300'}`} />
                ))}
              </div>
              <span className="text-xs font-bold text-slate-700">{repeated}/{maxDots}</span>
              {stabLabel && <span className="text-xs text-slate-500 capitalize">— {stabLabel}</span>}
            </div>
          </div>
        </section>
      )}

      {/* ── Category definitions accordion ── */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setAccordionOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <span>Category Definitions Reference</span>
          {accordionOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {accordionOpen && (
          <div className="border-t border-slate-100 divide-y divide-slate-50">
            {Object.entries(CATEGORY_DESCRIPTIONS).map(([cat, desc]) => (
              <div key={cat} className="px-4 py-3">
                <p className="text-xs font-bold text-slate-700">{cat}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
