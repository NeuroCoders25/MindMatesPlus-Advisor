import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { tsToRelative } from '../../../types/userDiagnostic';
import type { UserDiagnosticData, FeedbackEntry } from '../../../types/userDiagnostic';

interface Props { data: UserDiagnosticData }

// ── Star rating renderer ──────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={i < rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}
        />
      ))}
    </div>
  );
}

// ── Truncated text with show more ────────────────────────────────────────────

function TruncatedText({ text, limit = 120 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (!text || !text.trim()) return null;

  const needsTruncate = text.length > limit;
  const display       = !needsTruncate || expanded ? text : `${text.slice(0, limit)}…`;

  return (
    <p className="text-xs text-slate-600 italic leading-relaxed">
      "{display}"
      {needsTruncate && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-1 text-brand-500 font-semibold hover:text-brand-700 not-italic"
        >
          {expanded ? 'show less' : 'show more'}
        </button>
      )}
    </p>
  );
}

// ── Feedback card ─────────────────────────────────────────────────────────────

function FeedbackCard({ entry }: { entry: FeedbackEntry }) {
  const rating     = typeof entry.star_rating === 'number' ? entry.star_rating : 0;
  const hasPeer    = typeof entry.peer_comment === 'string' && entry.peer_comment.trim().length > 0;
  const hasApp     = typeof entry.app_comment  === 'string' && entry.app_comment.trim().length  > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <StarRating rating={rating} />
        <span className="text-xs text-slate-400">{tsToRelative(entry.createdAt)}</span>
      </div>

      {/* Peer comment */}
      {hasPeer && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Peer Comment</p>
          <TruncatedText text={entry.peer_comment!} />
        </div>
      )}

      {/* App comment */}
      {hasApp && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">App Feedback</p>
          <TruncatedText text={entry.app_comment!} />
        </div>
      )}

      {!hasPeer && !hasApp && (
        <p className="text-xs text-slate-300 italic">No written comments.</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FeedbackTab({ data }: Props) {
  const { feedback } = data;

  return (
    <div className="p-4 space-y-3">
      {feedback.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400 italic">
          This user has not submitted any feedback yet.
        </div>
      ) : (
        feedback.map((entry) => <FeedbackCard key={entry.id} entry={entry} />)
      )}

      {/* Privacy note */}
      <div className="pt-2">
        <p className="text-[10px] text-slate-400 text-center italic leading-relaxed">
          Feedback data is pseudonymous — stored under user UID. Not for clinical assessment.
        </p>
      </div>
    </div>
  );
}
