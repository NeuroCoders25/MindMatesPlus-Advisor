/**
 * LiveDiagnosticsPanel — real-time ML diagnostic view for advisors.
 * Dark navy theme. Shows live DASS scores, ML pipeline, BERT events,
 * KNN result, and a session event-log that captures every Firestore update.
 *
 * Firestore paths consumed:
 *   users/{uid}/mentalHealthProfile/currentProfile  (onSnapshot)
 *   users/{uid}/mlAnalysisHistory                   (onSnapshot, orderBy createdAt desc)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  getDassScores,
  getDASSSeverity,
  getSeverityBarColor,
  resolveActiveRecommendation,
  getCategoryColor,
  normalizeUserStatus,
  getLabelColor,
  getMlTimestamp,
  tsToRelative,
  tsToFull,
} from '../../types/userDiagnostic';
import type { UserDiagnosticData, MLHistoryEntry } from '../../types/userDiagnostic';
import ConfidenceSparkline from './ConfidenceSparkline';

interface Props {
  data: UserDiagnosticData;
  userId: string;
}

// ── Dark-blue palette tokens ──────────────────────────────────────────────────
// bg:       bg-[#0d1929]  (deep navy)
// section:  bg-[#112240]
// border:   border-[#1e3a5f]
// muted:    text-[#6b8aab]
// value:    text-[#c8d8e8]
// bright:   text-white

// ── Prediction chip (dark theme) ─────────────────────────────────────────────

function PredChip({ label }: { label: string | undefined }) {
  const l = (label ?? '').toLowerCase();
  if (l.includes('depress'))
    return <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">{label}</span>;
  if (l.includes('anxi'))
    return <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">{label}</span>;
  return <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{label ?? '—'}</span>;
}

// ── Source icon ───────────────────────────────────────────────────────────────

function srcIcon(source: string | undefined): string {
  const s = (source ?? '').toLowerCase();
  if (s.includes('group') || s.includes('chat')) return '💬';
  if (s.includes('ai')) return '🤖';
  return '📓';
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#1e3a5f] rounded-xl overflow-hidden">
      <div className="px-4 py-2 bg-[#112240] border-b border-[#1e3a5f]">
        <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#6b8aab]">
          {title}
        </span>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

// ── Full-width bar ────────────────────────────────────────────────────────────

function DarkBar({
  label, score, max, color, badge,
}: { label: string; score: number; max: number; color: string; badge?: React.ReactNode }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#6b8aab]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{score}/{max}</span>
          {badge}
        </div>
      </div>
      <div className="h-2 bg-[#1e3a5f] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Group probabilities bar ───────────────────────────────────────────────────

function GroupBar({ group, prob }: { group: string; prob: number }) {
  const pct   = Math.round(prob * 100);
  const color = pct >= 40 ? '#f59e0b' : pct >= 20 ? '#38bdf8' : '#2a4a6a';
  const label = group.replace(/_/g, ' ');

  return (
    <div className="grid grid-cols-[110px_1fr_36px] items-center gap-2 text-[11px]">
      <span className="text-[#6b8aab] truncate font-mono">{label}</span>
      <div className="h-1.5 bg-[#1e3a5f] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-right font-mono font-bold" style={{ color: pct >= 20 ? color : '#2a4a6a' }}>
        {pct}%
      </span>
    </div>
  );
}

// ── KV row helper ─────────────────────────────────────────────────────────────

function KV({ k, v, accent }: { k: string; v: React.ReactNode; accent?: string }) {
  return (
    <>
      <span className="text-[#6b8aab] text-xs">{k}</span>
      <span className={cn('text-xs font-semibold', accent ?? 'text-[#c8d8e8]')}>{v}</span>
    </>
  );
}

// ── Event log entry ───────────────────────────────────────────────────────────

interface LogEntry { ts: number; msg: string; type: 'info' | 'change' | 'warn' }

function LogLine({ e }: { e: LogEntry }) {
  const cls = e.type === 'warn' ? 'text-amber-400' : e.type === 'change' ? 'text-emerald-400' : 'text-[#6b8aab]';
  const time = new Date(e.ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <div className="flex items-start gap-2 text-[11px] font-mono">
      <span className="text-[#2a4a6a] shrink-0 tabular-nums">{time}</span>
      <span className={cls}>{e.msg}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LiveDiagnosticsPanel({ data, userId }: Props) {
  const { currentUser }   = useAuth();
  const { profile, mentalHealthProfile, mlHistory } = data;
  const [rerunning, setRerunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([
    { ts: Date.now(), msg: 'Watching for changes… interact with the app to see live events.', type: 'info' },
  ]);

  const push = useCallback((msg: string, type: LogEntry['type'] = 'change') => {
    setLog((prev) => [{ ts: Date.now(), msg, type }, ...prev].slice(0, 80));
  }, []);

  // ── Live event tracking ───────────────────────────────────────────────────
  const prevLen    = useRef(mlHistory.length);
  const prevScore  = useRef<number | undefined>(mentalHealthProfile?.wellnessScore ?? profile?.wellnessScore);
  const prevCat    = useRef<string | undefined>(mentalHealthProfile?.activeRecommendationCategory);
  const prevStatus = useRef<string | undefined>(mentalHealthProfile?.userStatus);

  useEffect(() => {
    if (mlHistory.length > prevLen.current) {
      const e    = mlHistory[0];
      const pred = e?.prediction ?? '?';
      const conf = typeof e?.confidence === 'number' ? ` (${(e.confidence * 100).toFixed(0)}%)` : '';
      const src  = e?.source ? ` via ${e.source}` : '';
      const prev = e?.textPreview ? ` — "${e.textPreview.slice(0, 40)}…"` : '';
      push(`New BERT event: ${pred}${conf}${src}${prev}`, 'change');
    }
    prevLen.current = mlHistory.length;
  }, [mlHistory.length, mlHistory, push]);

  useEffect(() => {
    const cur = mentalHealthProfile?.wellnessScore ?? profile?.wellnessScore;
    if (cur !== undefined && cur !== prevScore.current) {
      push(`Wellness score: ${prevScore.current ?? '?'} → ${cur}`, 'change');
    }
    prevScore.current = cur;
  }, [mentalHealthProfile?.wellnessScore, profile?.wellnessScore, push]);

  useEffect(() => {
    const cur = mentalHealthProfile?.activeRecommendationCategory;
    if (cur && cur !== prevCat.current) {
      push(`Active category: ${prevCat.current ?? '?'} → ${cur}`, 'warn');
    }
    prevCat.current = cur;
  }, [mentalHealthProfile?.activeRecommendationCategory, push]);

  useEffect(() => {
    const cur = mentalHealthProfile?.userStatus;
    if (cur && cur !== prevStatus.current) {
      push(`User status changed: ${prevStatus.current ?? '?'} → ${cur}`, 'warn');
    }
    prevStatus.current = cur;
  }, [mentalHealthProfile?.userStatus, push]);

  // ── Derived values ────────────────────────────────────────────────────────

  // DASS-21 — from initialQuestionnaireScore (primary) or dass21Scores (fallback)
  const { depression: dep, anxiety: anx, stress: str } = getDassScores(mentalHealthProfile);
  const hasDass = dep !== null || anx !== null || str !== null;

  // Wellness + status
  const wellnessScore = profile?.wellnessScore ?? mentalHealthProfile?.wellnessScore ?? 0;
  const status        = normalizeUserStatus(profile, mentalHealthProfile);

  // Pipeline (P1 = peerGroupRecommendationCategory)
  const activeRec   = profile ? resolveActiveRecommendation(profile, mentalHealthProfile) : null;
  const p1Val       = profile?.peerGroupRecommendationCategory ?? mentalHealthProfile?.peerGroupRecommendationCategory ?? profile?.weeklyTrendCategory ?? mentalHealthProfile?.weeklyTrendCategory;
  const knnMapped   = profile?.knnMappedCategory ?? mentalHealthProfile?.knnMappedCategory;
  const knnFlag     = (profile?.knnSafetyFlag ?? mentalHealthProfile?.knnSafetyFlag) === true;
  const baseline    = profile?.baselineRecommendationCategory ?? mentalHealthProfile?.baselineRecommendationCategory;
  const activeCat   = profile?.activeRecommendationCategory   ?? mentalHealthProfile?.activeRecommendationCategory;

  const waterfall = [
    { n: 1, label: 'Weekly Trend', value: p1Val       ?? '—' },
    { n: 2, label: 'KNN Mapped',   value: knnFlag ? '⚠ G1 — BLOCKED' : (knnMapped ?? '—') },
    { n: 3, label: 'Baseline',     value: baseline    ?? '—' },
    { n: 4, label: 'Active (ML)',  value: activeCat   ?? '—' },
  ];

  // Stability counter
  const counter  = mentalHealthProfile?.mlStabilityCounter ?? {};
  const repeated = typeof counter.repeatedCount === 'number' ? counter.repeatedCount : 0;
  const maxDots  = typeof counter.maxCount === 'number' ? counter.maxCount : 5;
  // Use lastPrediction first, fall back to legacy currentPrediction
  const stabLabel = counter.lastPrediction ?? counter.currentPrediction
                  ?? profile?.mlMentalHealthProfile?.dominantCategory ?? null;

  // KNN — direct fields on currentProfile
  const knnGroup   = mentalHealthProfile?.knnRecommendedGroup ?? null;
  const knnCat     = mentalHealthProfile?.knnMappedCategory   ?? null;
  const knnProbs   = mentalHealthProfile?.knnProbabilities    ?? null;
  const knnSafety  = mentalHealthProfile?.knnSafetyFlag;
  const knnFallbk  = mentalHealthProfile?.knnFallbackReason   ?? null;
  const knnLastAt  = mentalHealthProfile?.knnLastUpdatedAt    ?? null;
  const sortedGrps = knnProbs ? Object.entries(knnProbs).sort((a, b) => b[1] - a[1]) : null;

  // ── Re-run KNN ────────────────────────────────────────────────────────────
  async function handleRerun() {
    if (rerunning || !currentUser) return;
    setRerunning(true);
    push('KNN re-run requested by advisor…', 'warn');
    try {
      await updateDoc(
        doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile'),
        { knnRerunRequestedAt: serverTimestamp(), knnRerunRequestedBy: currentUser.uid },
      );
      push('KNN re-run request written ✓', 'info');
    } catch (err) {
      console.error('[LiveDiagnosticsPanel] rerun:', err);
      push('Failed to write KNN re-run request.', 'warn');
    } finally {
      setRerunning(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#0d1929] rounded-2xl overflow-hidden border border-[#1e3a5f] text-sm">

      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1e3a5f] flex items-center gap-3 bg-[#0a1422]">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold text-emerald-400 tracking-[0.2em] uppercase">Live</span>
        </span>
        <span className="text-[11px] font-bold text-[#6b8aab] tracking-[0.15em] uppercase">
          — ML Diagnostic Dashboard
        </span>
        <span className="ml-auto font-mono text-[10px] text-[#2a4a6a] truncate max-w-[160px]">
          uid: {userId}
        </span>
      </div>

      <div className="p-4 space-y-4">

        {/* ── Live Scores ── */}
        <Sec title="Live Scores">

          {/* DASS-21 */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-[#6b8aab] uppercase tracking-widest mb-2">DASS-21 Scores</p>
            {hasDass ? (
              <div className="space-y-2">
                {dep !== null && (
                  <DarkBar label="Depression" score={dep} max={42}
                    color={getSeverityBarColor(getDASSSeverity('depression', dep))}
                    badge={<span style={{ color: getSeverityBarColor(getDASSSeverity('depression', dep)) }} className="text-[10px] font-bold">{getDASSSeverity('depression', dep)}</span>}
                  />
                )}
                {anx !== null && (
                  <DarkBar label="Anxiety" score={anx} max={42}
                    color={getSeverityBarColor(getDASSSeverity('anxiety', anx))}
                    badge={<span style={{ color: getSeverityBarColor(getDASSSeverity('anxiety', anx)) }} className="text-[10px] font-bold">{getDASSSeverity('anxiety', anx)}</span>}
                  />
                )}
                {str !== null && (
                  <DarkBar label="Stress" score={str} max={42}
                    color={getSeverityBarColor(getDASSSeverity('stress', str))}
                    badge={<span style={{ color: getSeverityBarColor(getDASSSeverity('stress', str)) }} className="text-[10px] font-bold">{getDASSSeverity('stress', str)}</span>}
                  />
                )}
              </div>
            ) : (
              <p className="text-xs text-[#2a4a6a] italic">No DASS-21 data recorded yet</p>
            )}
          </div>

          {/* User Status only (wellness score shown in card above, no repeat) */}
          <div className="flex items-center gap-2 pt-1 text-xs">
            <span className="text-[#6b8aab]">User Status</span>
            <span className={cn(
              'px-2 py-0.5 rounded text-[10px] font-bold border',
              status === 'Active'       && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
              status === 'Monitoring'   && 'bg-amber-500/15   text-amber-400   border-amber-500/30',
              status === 'Restricted'   && 'bg-red-500/15     text-red-400     border-red-500/30',
              status === 'Under Review' && 'bg-sky-500/15     text-sky-400     border-sky-500/30',
              status === 'Inactive'     && 'bg-slate-500/15   text-slate-400   border-slate-500/30',
            )}>
              {status.toLowerCase().replace(' ', '_')}
            </span>
          </div>
        </Sec>

        {/* ── Recommendation Pipeline ── */}
        <Sec title="Recommendation Pipeline">
          <div className="space-y-1">
            {waterfall.map((row) => {
              const isActive   = activeRec?.source === row.label;
              const activeIdx  = waterfall.findIndex((r) => r.label === activeRec?.source);
              const rowIdx     = waterfall.findIndex((r) => r.label === row.label);
              const isOverride = !isActive && rowIdx < activeIdx;
              const accent     = isActive ? getCategoryColor(row.value) : undefined;

              return (
                <div
                  key={row.n}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-xs',
                    isActive   && 'bg-emerald-500/10 border border-emerald-500/20',
                    isOverride && 'opacity-25',
                    !isActive && !isOverride && 'opacity-60',
                  )}
                >
                  <span className="text-[#2a4a6a] font-bold font-mono w-4 shrink-0">P{row.n}</span>
                  <span className={cn('w-28 shrink-0 font-mono', isActive ? 'text-emerald-400' : 'text-[#6b8aab]')}>
                    {row.label}
                  </span>
                  <span className={cn(
                    'flex-1 font-semibold truncate',
                    isOverride ? 'line-through text-[#2a4a6a]' : 'text-[#c8d8e8]',
                    row.value.includes('BLOCKED') && 'text-red-400 no-underline',
                  )}>
                    {row.value}
                  </span>
                  {isActive && (
                    <span className="shrink-0 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                      ACTIVE
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stability counter */}
          <div className="flex items-center gap-2 pt-1 border-t border-[#1e3a5f] text-xs text-[#6b8aab]">
            <span className="font-mono">Stability Counter</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: maxDots }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'w-3 h-3 rounded-full border transition-colors',
                    i < repeated ? 'bg-emerald-500 border-emerald-500' : 'bg-transparent border-[#2a4a6a]',
                  )}
                />
              ))}
            </div>
            <span className="font-bold text-white">{repeated}/{maxDots}</span>
            {stabLabel && <span className="text-emerald-400 font-mono capitalize">{stabLabel}</span>}
          </div>
        </Sec>

        {/* ── BERT Prediction History ── */}
        <Sec title="BERT Prediction History">
          {mlHistory.length > 0 ? (
            <>
              <p className="text-[10px] font-bold text-[#6b8aab] uppercase tracking-widest font-mono">
                BERT Events (Last {Math.min(mlHistory.length, 20)})
              </p>

              <div className="max-h-[280px] overflow-y-auto space-y-0.5 pr-1">
                {mlHistory.slice(0, 20).map((entry: MLHistoryEntry) => {
                  const conf  = typeof entry.confidence === 'number' ? entry.confidence : null;
                  const ts    = getMlTimestamp(entry);
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 py-1.5 border-b border-[#112240] last:border-0"
                    >
                      <span className="text-[#2a4a6a] tabular-nums text-[11px] font-mono w-12 shrink-0">
                        {tsToRelative(ts)}
                      </span>
                      <span className="text-sm leading-none shrink-0">{srcIcon(entry.source)}</span>
                      <PredChip label={entry.prediction ?? '—'} />
                      {entry.textPreview && (
                        <span className="text-[#2a4a6a] text-[10px] truncate max-w-[100px] hidden sm:block">
                          "{entry.textPreview}"
                        </span>
                      )}
                      {conf !== null && (
                        <span
                          className="ml-auto text-[11px] tabular-nums font-bold font-mono shrink-0"
                          style={{ color: getLabelColor(entry.prediction) }}
                        >
                          {(conf * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Sparkline */}
              <div className="border-t border-[#1e3a5f] pt-2">
                <p className="text-[9px] text-[#2a4a6a] italic mb-1 font-mono">
                  Confidence over time ↑  (dashed = 0.80 threshold)
                </p>
                <ConfidenceSparkline events={mlHistory.slice(0, 20)} />
              </div>
            </>
          ) : (
            <p className="text-xs text-[#2a4a6a] italic font-mono">No ML event history yet</p>
          )}
        </Sec>

        {/* ── KNN Result ── */}
        <Sec title="KNN Result">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-3">
            {knnGroup  && <KV k="KNN Group"    v={knnGroup}  accent="text-sky-300" />}
            {knnCat    && <KV k="Mapped Cat"   v={knnCat}    accent="text-amber-400" />}
            {knnSafety !== undefined && (
              <KV k="Safety Flag" v={String(knnSafety)} accent={knnSafety ? 'text-red-400 font-bold' : 'text-emerald-400'} />
            )}
            {knnFallbk && <KV k="Fallback"     v={knnFallbk} accent="text-amber-500" />}
            {knnLastAt && <KV k="Last run"      v={tsToFull(knnLastAt)} />}
          </div>

          {(!knnGroup && !knnCat && !sortedGrps) && (
            <p className="text-xs text-[#2a4a6a] italic font-mono mb-3">No KNN result yet</p>
          )}

          {sortedGrps && sortedGrps.length > 0 && (
            <div className="space-y-1.5 mb-4">
              <p className="text-[10px] font-bold text-[#6b8aab] uppercase tracking-widest font-mono">
                Group Probabilities
              </p>
              {sortedGrps.map(([group, prob]) => (
                <GroupBar key={group} group={group} prob={prob} />
              ))}
            </div>
          )}

          <button
            onClick={handleRerun}
            disabled={rerunning}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border',
              'text-xs font-bold font-mono transition-all',
              'bg-transparent border-[#1e6aab] text-[#38bdf8]',
              'hover:bg-[#0c2a4a] hover:border-[#38bdf8]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <RefreshCw size={13} className={rerunning ? 'animate-spin' : ''} />
            {rerunning ? 'Requesting Re-run…' : '⟳  Re-run KNN'}
          </button>
        </Sec>

        {/* ── Event Log ── */}
        <Sec title="Event Log">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-[#6b8aab] uppercase tracking-widest font-mono">
              Event Log
            </span>
            <button
              onClick={() => setLog([{ ts: Date.now(), msg: 'Log cleared.', type: 'info' }])}
              className="text-[10px] text-[#2a4a6a] hover:text-[#6b8aab] transition-colors font-mono"
            >
              Clear
            </button>
          </div>
          <div className="max-h-[160px] overflow-y-auto space-y-0.5">
            {log.map((entry, i) => <LogLine key={i} e={entry} />)}
          </div>
        </Sec>

      </div>
    </div>
  );
}
