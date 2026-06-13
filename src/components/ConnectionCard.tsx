import React, { useState, useEffect, useCallback } from 'react';
import { AdvisorConnection } from '../types';
import {
  Mail,
  Clock,
  AlertCircle,
  CheckCircle2,
  BookCheck,
  Loader2,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const _API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

// ── Types ──────────────────────────────────────────────────────────────────────

interface TrialStatusResponse {
  daysLeft: number;
  expired: boolean;
  systemApproved?: boolean;
}

interface ConnectionCardProps {
  connection: AdvisorConnection;
  onAccept: (conn: AdvisorConnection) => Promise<void>;
  onMarkReviewed: (conn: AdvisorConnection) => Promise<void>;
  onClick?: (conn: AdvisorConnection) => void;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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
  system_approved: 'bg-emerald-100 text-emerald-700',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function PaymentPill({
  paymentStatus,
  sessionFeeUSD,
}: {
  paymentStatus: string;
  sessionFeeUSD?: number;
}) {
  if (paymentStatus === 'paid') {
    const label = sessionFeeUSD != null ? `Paid $${sessionFeeUSD}` : 'Paid';
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
        {label}
      </span>
    );
  }
  if (paymentStatus === 'trial') {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
        Free trial
      </span>
    );
  }
  if (paymentStatus === 'pending_payment') {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
        Awaiting payment
      </span>
    );
  }
  return null;
}

function TrialStatusChip({
  trialStatus,
  trialStatusLoading,
  localApproved,
  isSystemApproved,
  paymentStatus,
  trialExpiredFromDoc,
}: {
  trialStatus: TrialStatusResponse | null;
  trialStatusLoading: boolean;
  localApproved: boolean;
  isSystemApproved: boolean;
  paymentStatus: AdvisorConnection['paymentStatus'];
  trialExpiredFromDoc: boolean;
}) {
  if (isSystemApproved || localApproved || trialStatus?.systemApproved) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
        ✓ Approved to system
      </span>
    );
  }

  if (trialStatusLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-400">
        <Loader2 size={11} className="animate-spin" />
        Checking trial…
      </span>
    );
  }

  if (!trialStatus) return null;

  const expired = trialStatus.expired || trialExpiredFromDoc;

  if (!expired) {
    const s = trialStatus.daysLeft === 1 ? '' : 's';
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
        🕐 {trialStatus.daysLeft} day{s} of free support remaining
      </span>
    );
  }

  if (paymentStatus === 'paid') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
        ✓ Continued (paid)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
      ⚠ Free week ended — awaiting payment
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ConnectionCard({
  connection,
  onAccept,
  onMarkReviewed,
  onClick,
  onShowToast,
}: ConnectionCardProps) {
  const { currentUser } = useAuth();

  // Existing action states
  const [accepting, setAccepting] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  // Trial status fetch
  const [trialStatus, setTrialStatus] = useState<TrialStatusResponse | null>(null);
  const [trialStatusLoading, setTrialStatusLoading] = useState(false);

  // Approve action
  const [approving, setApproving] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [localApproved, setLocalApproved] = useState(false);

  // Extend action
  // Advisors may only extend once per connection — enforce client-side by
  // hiding the Extend button once trialExtendedAt is set on the doc.
  const [showExtendOptions, setShowExtendOptions] = useState(false);
  const [extendLoading, setExtendLoading] = useState(false);

  const isCriticalCase = connection.caseType !== 'listener_support';
  const isSystemApproved =
    localApproved ||
    connection.status === 'system_approved' ||
    !!trialStatus?.systemApproved;

  const hasTrialFeatures =
    connection.paymentStatus === 'trial' || connection.paymentStatus === 'paid';

  // Fetch trial status from the backend
  const fetchTrialStatus = useCallback(async () => {
    if (!_API_BASE || !hasTrialFeatures || !currentUser) return;
    setTrialStatusLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${_API_BASE}/payments/trial-status/${connection.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as TrialStatusResponse;
      setTrialStatus(data);
    } catch {
      // Silently ignore — chip is hidden when trialStatus is null
    } finally {
      setTrialStatusLoading(false);
    }
  }, [connection.id, hasTrialFeatures, currentUser]);

  // Fetch on mount
  useEffect(() => {
    fetchTrialStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when Firestore live snapshot flips trialExpired or trialExtendedAt
  // so the chip updates immediately without a page refresh.
  useEffect(() => {
    if (!hasTrialFeatures) return;
    fetchTrialStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.trialExpired, connection.trialExtendedAt]);

  // ── Handlers ────────────────────────────────────────────────────────────────

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

  async function handleConfirmApprove(e: React.SyntheticEvent) {
    e.stopPropagation();
    if (!currentUser || !_API_BASE) return;
    setApproving(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${_API_BASE}/payments/approve-to-system`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ connectionId: connection.id, advisorId: currentUser.uid }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLocalApproved(true);
      setShowApproveConfirm(false);
      const name = connection.nickName || connection.userName;
      onShowToast?.(
        `${name} has been approved and can now use MindMates+ independently.`,
        'success',
      );
    } catch {
      onShowToast?.('Failed to approve connection. Please try again.', 'error');
    } finally {
      setApproving(false);
    }
  }

  async function handleExtend(extraDays: 5 | 7, e: React.SyntheticEvent) {
    e.stopPropagation();
    if (!currentUser || !_API_BASE) return;
    setExtendLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${_API_BASE}/payments/extend-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ connectionId: connection.id, extraDays }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowExtendOptions(false);
      onShowToast?.(`Free period extended by ${extraDays} days.`, 'success');
      // Re-fetch to update the chip with the new daysLeft
      await fetchTrialStatus();
    } catch {
      onShowToast?.('Failed to extend trial. Please try again.', 'error');
    } finally {
      setExtendLoading(false);
    }
  }

  // ── Derived visibility flags ────────────────────────────────────────────────

  const canApprove =
    isCriticalCase &&
    connection.status === 'accepted' &&
    hasTrialFeatures &&
    !isSystemApproved;

  const canExtend =
    isCriticalCase &&
    connection.paymentStatus === 'trial' &&
    !connection.trialExtendedAt &&
    !isSystemApproved &&
    !!trialStatus &&
    (trialStatus.daysLeft <= 2 || trialStatus.expired || !!connection.trialExpired);

  // ── Render ──────────────────────────────────────────────────────────────────

  const statusLabel =
    connection.status === 'system_approved'
      ? 'System Approved'
      : connection.status.charAt(0).toUpperCase() + connection.status.slice(1);
  const statusStyle = STATUS_STYLES[connection.status] ?? 'bg-slate-100 text-slate-600';
  const displayName = connection.nickName || connection.userName;

  return (
    <div
      className="glass-card p-5 hover:shadow-md transition-all border-l-4 border-l-red-400 cursor-pointer"
      onClick={() => onClick?.(connection)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 font-bold text-lg shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-slate-800 leading-tight truncate">{displayName}</h4>
            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
              <Mail size={11} className="shrink-0" />
              <span className="truncate">{connection.userEmail}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle}`}>
            {statusLabel}
          </span>
          {connection.paymentStatus && (
            <PaymentPill
              paymentStatus={connection.paymentStatus}
              sessionFeeUSD={connection.sessionFeeUSD}
            />
          )}
        </div>
      </div>

      {/* Category */}
      {connection.userMentalHealthCategory && (
        <div className="flex items-center gap-2 text-xs font-medium mb-3 bg-slate-50 px-3 py-1.5 rounded-lg">
          <span className="text-slate-400">Category:</span>
          <span className="text-slate-700 capitalize">{connection.userMentalHealthCategory}</span>
        </div>
      )}

      {/* Reason */}
      <div className="bg-red-50 rounded-xl p-3 mb-3 flex items-start gap-2.5">
        <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-700">Reason: </span>
          {connection.reason || 'No reason provided'}
        </p>
      </div>

      {/* Timestamp */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
        <Clock size={12} />
        <span>Connected {formatTimestamp(connection.createdAt)}</span>
      </div>

      {/* Trial status chip */}
      {hasTrialFeatures && (
        <div className="mb-3">
          <TrialStatusChip
            trialStatus={trialStatus}
            trialStatusLoading={trialStatusLoading}
            localApproved={localApproved}
            isSystemApproved={connection.status === 'system_approved'}
            paymentStatus={connection.paymentStatus}
            trialExpiredFromDoc={!!connection.trialExpired}
          />
        </div>
      )}

      {/* ── Action area ──────────────────────────────────────────────────── */}
      <div
        className="pt-3 border-t border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Approve confirmation inline row */}
        {showApproveConfirm ? (
          <div className="bg-slate-50 rounded-xl p-3 space-y-2">
            <p className="text-xs text-slate-700 font-medium leading-snug">
              Approve <span className="font-bold">{displayName}</span> to use MindMates+
              independently? Their advisor connection will be closed.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmApprove}
                disabled={approving}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
              >
                {approving ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                {approving ? 'Approving…' : 'Confirm'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowApproveConfirm(false); }}
                disabled={approving}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : showExtendOptions ? (
          /* Extend trial inline option row */
          <div className="bg-slate-50 rounded-xl p-3 space-y-2">
            <p className="text-xs text-slate-500 font-medium">Extend free support period by:</p>
            <div className="flex gap-2">
              <button
                onClick={(e) => handleExtend(5, e)}
                disabled={extendLoading}
                className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
              >
                {extendLoading ? <Loader2 size={11} className="animate-spin" /> : null}
                + 5 days
              </button>
              <button
                onClick={(e) => handleExtend(7, e)}
                disabled={extendLoading}
                className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
              >
                {extendLoading ? <Loader2 size={11} className="animate-spin" /> : null}
                + 7 days
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowExtendOptions(false); }}
                disabled={extendLoading}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Normal action row */
          <div className="flex items-center gap-2 flex-wrap">
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

            {/* Extend free period button */}
            {canExtend && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowExtendOptions(true); }}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 border border-blue-300 hover:bg-blue-50 px-3 py-2 rounded-xl transition-colors"
              >
                <Timer size={13} />
                Extend free period
              </button>
            )}

            {/* Approve to system button */}
            {canApprove && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowApproveConfirm(true); }}
                className="flex items-center gap-1.5 text-sm font-semibold text-green-700 border border-green-300 hover:bg-green-50 px-4 py-2 rounded-xl transition-colors"
              >
                <ShieldCheck size={14} />
                Approve to system
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
        )}
      </div>
    </div>
  );
}
