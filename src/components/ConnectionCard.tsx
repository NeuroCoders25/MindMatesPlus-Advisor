import React, { useState } from 'react';
import { AdvisorConnection } from '../types';
import { Mail, Clock, AlertCircle, CheckCircle2, BookCheck } from 'lucide-react';

interface ConnectionCardProps {
  connection: AdvisorConnection;
  onAccept: (conn: AdvisorConnection) => Promise<void>;
  onMarkReviewed: (conn: AdvisorConnection) => Promise<void>;
  onClick?: (conn: AdvisorConnection) => void;
}

function formatTimestamp(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const d = new Date((value as { seconds: number }).seconds * 1000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const s = String(value);
  return s === 'undefined' || s === 'null' || s === '' ? '—' : s;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-emerald-100 text-emerald-700',
};

export default function ConnectionCard({ connection, onAccept, onMarkReviewed, onClick }: ConnectionCardProps) {
  const [accepting, setAccepting] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  async function handleAccept(e: React.SyntheticEvent) {
    e.stopPropagation();
    setAccepting(true);
    try {
      await onAccept(connection);
    } finally {
      setAccepting(false);
    }
  }

  async function handleMarkReviewed(e: React.SyntheticEvent) {
    e.stopPropagation();
    setReviewing(true);
    try {
      await onMarkReviewed(connection);
    } finally {
      setReviewing(false);
    }
  }

  const statusLabel = connection.status.charAt(0).toUpperCase() + connection.status.slice(1);
  const statusStyle = STATUS_STYLES[connection.status] ?? 'bg-slate-100 text-slate-600';

  return (
    <div
      className="glass-card p-5 hover:shadow-md transition-all border-l-4 border-l-red-400 cursor-pointer"
      onClick={() => onClick?.(connection)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 font-bold text-lg shrink-0">
            {connection.userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-slate-800 leading-tight truncate">{connection.userName}</h4>
            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
              <Mail size={11} className="shrink-0" />
              <span className="truncate">{connection.userEmail}</span>
            </div>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ml-2 ${statusStyle}`}>
          {statusLabel}
        </span>
      </div>

      {connection.userMentalHealthCategory && (
        <div className="flex items-center gap-2 text-xs font-medium mb-3 bg-slate-50 px-3 py-1.5 rounded-lg">
          <span className="text-slate-400">Category:</span>
          <span className="text-slate-700 capitalize">{connection.userMentalHealthCategory}</span>
        </div>
      )}

      <div className="bg-red-50 rounded-xl p-3 mb-3 flex items-start gap-2.5">
        <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-700">Reason: </span>
          {connection.reason || 'No reason provided'}
        </p>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
        <Clock size={12} />
        <span>Connected {formatTimestamp(connection.createdAt)}</span>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
        {connection.status === 'pending' && (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-60 px-4 py-2 rounded-xl transition-colors flex-1 justify-center"
          >
            <CheckCircle2 size={14} />
            {accepting ? 'Accepting…' : 'Accept'}
          </button>
        )}
        <button
          onClick={handleMarkReviewed}
          disabled={reviewing}
          className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 px-4 py-2 rounded-xl transition-colors flex-1 justify-center"
        >
          <BookCheck size={14} />
          {reviewing ? 'Saving…' : 'Mark Reviewed'}
        </button>
      </div>
    </div>
  );
}
