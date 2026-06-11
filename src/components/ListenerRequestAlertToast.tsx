import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Headphones, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listenToListenerRequests } from '../lib/advisorConnections';
import type { AdvisorConnection } from '../types';

// ── Shared count bus (Sidebar subscribes to this) ─────────────────────────────

export type ListenerCountListener = (count: number) => void;
const countListeners: Set<ListenerCountListener> = new Set();
let currentPendingCount = 0;

export function subscribeListenerRequestCount(fn: ListenerCountListener) {
  fn(currentPendingCount); // immediately emit current value
  countListeners.add(fn);
  return () => countListeners.delete(fn);
}

function emitCount(n: number) {
  currentPendingCount = n;
  countListeners.forEach((fn) => fn(n));
}

// ── Shared full-list bus (Navbar subscribes to this) ──────────────────────────

export type ListenerRequestsListener = (requests: AdvisorConnection[]) => void;
const requestListeners: Set<ListenerRequestsListener> = new Set();
let currentPendingRequests: AdvisorConnection[] = [];

export function subscribeListenerRequests(fn: ListenerRequestsListener) {
  fn(currentPendingRequests); // immediately emit current value
  requestListeners.add(fn);
  return () => requestListeners.delete(fn);
}

function emitRequests(reqs: AdvisorConnection[]) {
  currentPendingRequests = reqs;
  requestListeners.forEach((fn) => fn(reqs));
}

// ── Toast shape ───────────────────────────────────────────────────────────────

interface ListenerToast {
  id: string;
  connectionId: string;
  nickName: string;
  receivedAt: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 6_000;
const ORIGINAL_TITLE = document.title;

function requestBrowserNotificationPermission() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function fireBrowserNotification(nickName: string) {
  if (typeof Notification === 'undefined') return;
  if (document.visibilityState !== 'hidden') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification('New Listener Request', {
      body: `🎧 ${nickName} is requesting a listener session`,
      icon: '/favicon.ico',
    });
  } catch {
    // silently skip if blocked
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ListenerRequestAlertToast() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [toasts, setToasts] = useState<ListenerToast[]>([]);

  const seenIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  // ── Request browser notification permission on first interaction ───────────

  useEffect(() => {
    const handle = () => {
      requestBrowserNotificationPermission();
      document.removeEventListener('click', handle, { capture: true });
    };
    document.addEventListener('click', handle, { capture: true });
    return () => document.removeEventListener('click', handle, { capture: true });
  }, []);

  // ── document.title prefix ──────────────────────────────────────────────────

  useEffect(() => {
    const count = currentPendingCount;
    if (count > 0) {
      document.title = `(${count}) ${ORIGINAL_TITLE}`;
    } else {
      document.title = ORIGINAL_TITLE;
    }
  });

  // ── dismiss ────────────────────────────────────────────────────────────────

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── listener ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser) return;

    initialized.current = false;
    seenIds.current = new Set();
    emitCount(0);

    const unsub = listenToListenerRequests(
      currentUser.uid,
      (conns) => {
        const pending = conns.filter((c) => c.status === 'pending');

        // Always keep the live count and full list up to date
        emitCount(pending.length);
        emitRequests(pending);

        if (!initialized.current) {
          // First snapshot — seed seen set, suppress pre-existing connections
          pending.forEach((c) => seenIds.current.add(c.id));
          initialized.current = true;
          return;
        }

        // Subsequent updates — toast only for brand-new pending connections
        pending.forEach((conn) => {
          if (seenIds.current.has(conn.id)) return;
          seenIds.current.add(conn.id);

          const nickName = conn.nickName || conn.userName || 'A user';

          const toast: ListenerToast = {
            id: conn.id,
            connectionId: conn.id,
            nickName,
            receivedAt: new Date(),
          };

          setToasts((prev) => {
            if (prev.some((t) => t.id === toast.id)) return prev;
            return [toast, ...prev].slice(0, 4);
          });

          setTimeout(() => dismiss(conn.id), AUTO_DISMISS_MS);

          fireBrowserNotification(nickName);
        });
      },
      (err) => {
        // Surface composite-index link so it can be click-created
        console.error('[ListenerRequestAlertToast] Firestore error — check for missing composite index:', err);
      },
    );

    return () => {
      unsub();
      initialized.current = false;
      emitCount(0);
      emitRequests([]);
    };
  }, [currentUser, dismiss]);

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
            className="pointer-events-auto rounded-2xl border shadow-xl overflow-hidden bg-blue-50 border-blue-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-blue-200">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-blue-700">
                <Headphones size={13} />
                <span>New Listener Request</span>
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-blue-400 hover:text-blue-600 transition-colors"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3">
              <p className="text-xs text-slate-500 mb-0.5">Request from</p>
              <p className="text-sm font-semibold text-slate-800">🎧 {toast.nickName}</p>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-blue-200 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                {toast.receivedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                onClick={() => {
                  dismiss(toast.id);
                  navigate('/listener-requests');
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                View <ArrowRight size={11} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
