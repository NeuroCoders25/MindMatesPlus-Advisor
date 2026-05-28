import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, UserCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listenToCriticalCases } from '../lib/advisorConnections';

// ── Toast shape ───────────────────────────────────────────────────────────────

interface CriticalToast {
  id: string;
  connectionId: string;
  userName: string;
  userEmail: string;
  category: string | null;
  reason: string | null;
  receivedAt: Date;
}

// ── Component ─────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 12_000;

export default function CriticalCaseAlertToast() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [toasts, setToasts] = useState<CriticalToast[]>([]);

  // seenIds prevents showing the same toast twice across re-renders
  const seenIds = useRef<Set<string>>(new Set());
  // initialized gates the very first snapshot so pre-existing connections never toast
  const initialized = useRef(false);

  // ── dismiss ────────────────────────────────────────────────────────────────

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── listener ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser) return;

    initialized.current = false;
    seenIds.current = new Set();

    const unsub = listenToCriticalCases(
      currentUser.uid,
      (conns) => {
        const pending = conns.filter((c) => c.status === 'pending');

        if (!initialized.current) {
          // First snapshot — seed seen set, suppress existing connections
          pending.forEach((c) => seenIds.current.add(c.id));
          initialized.current = true;
          return;
        }

        // Subsequent updates — toast only for brand-new pending connections
        pending.forEach((conn) => {
          if (seenIds.current.has(conn.id)) return;
          seenIds.current.add(conn.id);

          const toast: CriticalToast = {
            id: conn.id,
            connectionId: conn.id,
            userName: conn.nickName || conn.userName || 'A user',
            userEmail: conn.userEmail,
            category: conn.userMentalHealthCategory || null,
            reason: conn.reason || null,
            receivedAt: new Date(),
          };

          setToasts((prev) => {
            if (prev.some((t) => t.id === toast.id)) return prev;
            return [toast, ...prev].slice(0, 4);
          });

          setTimeout(() => dismiss(conn.id), AUTO_DISMISS_MS);
        });
      },
      () => {}, // silently swallow permission errors
    );

    return () => {
      unsub();
      initialized.current = false;
    };
  }, [currentUser, dismiss]);

  // ── review handler ─────────────────────────────────────────────────────────

  function handleReview(toast: CriticalToast) {
    dismiss(toast.id);
    navigate('/critical-cases', { state: { connectionId: toast.connectionId } });
  }

  // ── render ─────────────────────────────────────────────────────────────────

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="pointer-events-auto rounded-2xl border shadow-xl overflow-hidden bg-rose-50 border-rose-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-rose-200">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-rose-700">
                <AlertCircle size={13} />
                <UserCheck size={13} />
                <span>Critical Case Request</span>
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-rose-400 hover:text-rose-600 transition-colors"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-0.5">
              <p className="text-xs font-semibold text-slate-800">{toast.userName}</p>
              {toast.userEmail && (
                <p className="text-[11px] text-slate-500 truncate">{toast.userEmail}</p>
              )}
              {toast.category && (
                <p className="text-[11px] text-slate-400">{toast.category}</p>
              )}
              {toast.reason && (
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 pt-0.5">
                  {toast.reason}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-rose-200 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                {toast.receivedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                onClick={() => handleReview(toast)}
                className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline transition-colors"
              >
                Review Case <ArrowRight size={11} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
