/**
 * JournalsTab — shows ONLY journal metadata and BERT signals.
 * Journal entry text/content is NEVER shown here per privacy policy.
 * "Review →" navigates to the existing JournalReview page.
 */

import React, { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../../lib/utils';
import { getLabelChipClass, getJournalTimestamp, tsToFull } from '../../../types/userDiagnostic';
import type { UserDiagnosticData, JournalMetaEntry } from '../../../types/userDiagnostic';

interface Props {
  data:   UserDiagnosticData;
  userId: string;
}

// ── Mood tag emoji map ────────────────────────────────────────────────────────

const MOOD_EMOJI: Record<string, string> = {
  happy:    '😊',
  sad:      '😢',
  anxious:  '😰',
  angry:    '😠',
  neutral:  '😐',
  stressed: '😓',
  calm:     '😌',
  excited:  '😃',
  worried:  '😟',
  hopeful:  '🌟',
};

function moodEmoji(tag: string | undefined): string {
  if (!tag) return '📝';
  const lower = tag.toLowerCase();
  for (const [key, emoji] of Object.entries(MOOD_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return '📝';
}

// ── Mood distribution mini-bar ────────────────────────────────────────────────

interface MoodCount { tag: string; count: number }

function MoodDistBar({ entries }: { entries: JournalMetaEntry[] }) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      const t = (e.mood_tag ?? 'unknown').toLowerCase();
      map.set(t, (map.get(t) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  if (counts.length === 0) return null;
  const total = entries.length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
        Mood Distribution
      </p>
      <div className="flex h-4 rounded-full overflow-hidden gap-px">
        {counts.map(({ tag, count }) => {
          const pct = (count / total) * 100;
          return (
            <div
              key={tag}
              className="h-full bg-brand-400 first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${pct}%`,
                opacity: 0.3 + (counts.indexOf({ tag, count } as MoodCount) / counts.length) * 0.7,
              }}
              title={`${tag}: ${count}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
        {counts.slice(0, 5).map(({ tag, count }) => (
          <span key={tag} className="text-[10px] text-slate-500">
            {moodEmoji(tag)} {tag} ({count})
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Aggregate stats ───────────────────────────────────────────────────────────

interface AggStats {
  avgConf:   number | null;
  dominant:  string | null;
  domCount:  number;
}

function computeAgg(entries: JournalMetaEntry[]): AggStats {
  let confSum = 0;
  let confCount = 0;
  const labelMap = new Map<string, number>();

  for (const e of entries) {
    // ml_analysis is the correct field name; bertPrediction is the legacy alias
    const bp = e.ml_analysis ?? e.bertPrediction;
    if (bp) {
      if (typeof bp.confidence === 'number') {
        confSum += bp.confidence;
        confCount++;
      }
      // ml_analysis uses 'prediction'; bertPrediction used 'label'
      const lbl = ((bp as { prediction?: string; label?: string }).prediction ?? (bp as { label?: string }).label ?? '').toLowerCase();
      if (lbl) labelMap.set(lbl, (labelMap.get(lbl) ?? 0) + 1);
    }
  }

  let dominant: string | null = null;
  let domCount = 0;
  for (const [lbl, cnt] of labelMap.entries()) {
    if (cnt > domCount) { dominant = lbl; domCount = cnt; }
  }

  return {
    avgConf:  confCount > 0 ? confSum / confCount : null,
    dominant,
    domCount,
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function JournalsTab({ data, userId }: Props) {
  const navigate = useNavigate();
  const { journalEntries } = data;

  const agg = useMemo(() => computeAgg(journalEntries), [journalEntries]);

  if (journalEntries.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-slate-400 italic">
        No journal entries found for this user.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">

      {/* Privacy reminder */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
        🔒 Journal content is hidden to protect user privacy. Only metadata and BERT signals are shown.
        Use <strong>Review →</strong> to open the full Journal Review page.
      </div>

      {/* Mood distribution */}
      <MoodDistBar entries={journalEntries} />

      {/* Entry list */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[90px_1fr_1fr_56px_72px] px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <span>Date</span>
          <span>Mood Tag</span>
          <span>BERT Label</span>
          <span className="text-right">Conf.</span>
          <span className="text-right pr-1">Action</span>
        </div>

        <div className="divide-y divide-slate-50">
          {journalEntries.map((entry) => {
            // ml_analysis is the correct field; bertPrediction is legacy
            const ml        = entry.ml_analysis ?? entry.bertPrediction;
            const bertLabel = entry.ml_analysis?.prediction ?? entry.bertPrediction?.label;
            const conf      = ml?.confidence;
            const mood      = entry.mood_tag;

            return (
              <div
                key={entry.id}
                className="grid grid-cols-[90px_1fr_1fr_56px_72px] px-3 py-2.5 items-center hover:bg-slate-50/50 transition-colors"
              >
                {/* Date */}
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {tsToFull(getJournalTimestamp(entry))}
                </span>

                {/* Mood tag */}
                <span className="text-sm">
                  {moodEmoji(mood)}{' '}
                  <span className="text-xs text-slate-600 capitalize ml-1">
                    {mood ?? 'Unknown'}
                  </span>
                </span>

                {/* BERT label chip */}
                {bertLabel ? (
                  <span
                    className={cn(
                      'inline-flex self-start px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize w-fit',
                      getLabelChipClass(bertLabel),
                    )}
                  >
                    {bertLabel}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}

                {/* Confidence */}
                <span className="text-right text-xs tabular-nums text-slate-500">
                  {typeof conf === 'number' ? `${(conf * 100).toFixed(0)}%` : '—'}
                </span>

                {/* Review button */}
                <div className="flex justify-end">
                  <button
                    onClick={() =>
                      navigate('/journal-review', {
                        state: { filterUserId: userId, entryId: entry.id },
                      })
                    }
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                    title="Open in Journal Review"
                  >
                    Review <ExternalLink size={10} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Aggregate row */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          Avg BERT confidence:{' '}
          <strong className="text-slate-800">
            {agg.avgConf !== null ? `${(agg.avgConf * 100).toFixed(0)}%` : '—'}
          </strong>
        </span>
        {agg.dominant && (
          <span>
            Dominant emotion:{' '}
            <strong className="text-slate-800 capitalize">
              {agg.dominant} ({agg.domCount}/{journalEntries.length} entries)
            </strong>
          </span>
        )}
      </div>

    </div>
  );
}
