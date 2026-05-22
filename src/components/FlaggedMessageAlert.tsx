import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, X, ArrowRight, MessageSquare, BookOpen, Bot } from 'lucide-react';
import { db } from '../lib/firebase';
import { collectionGroup, onSnapshot, query } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { FlaggedAlert } from '../types';

// ── source config ────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<
  FlaggedAlert['source'],
  { label: string; Icon: React.ElementType; color: string; bg: string; border: string }
> = {
  'group-chat': {
    label: 'Group Chat',
    Icon: MessageSquare,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  'ai-chat': {
    label: 'AI Chat',
    Icon: Bot,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
  journal: {
    label: 'Journal',
    Icon: BookOpen,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
};

// ── helpers ──────────────────────────────────────────────────────────────────

function isFlaggedDoc(data: Record<string, unknown>): boolean {
  if (data.isFlagged === true || data.flagged === true || data.is_flagged === true) return true;
  const risk = String(data.riskLevel ?? data.risk_level ?? data.risk ?? '').toLowerCase();
  if (risk && (risk.includes('high') || risk.includes('critical') || risk.includes('severe'))) return true;
  const sentiment = String(data.sentiment ?? '').toLowerCase();
  if (sentiment === 'risky') return true;
  return false;
}

function getSenderName(data: Record<string, unknown>): string {
  return String(
    data.nickname ??
      data.nickName ??
      data.senderName ??
      data.sender_name ??
      data.userName ??
      data.user_name ??
      data.displayName ??
      data.name ??
      'A user',
  );
}

function getSnippet(data: Record<string, unknown>): string {
  const raw = String(
    data.text ?? data.message ?? data.content ?? data.body ?? data.entry ?? '',
  );
  return raw.slice(0, 120) + (raw.length > 120 ? '…' : '');
}

// ── component ────────────────────────────────────────────────────────────────

// Exported so Navbar can consume the same count
export type AlertCountListener = (count: number) => void;
const listeners: Set<AlertCountListener> = new Set();
export function subscribeAlertCount(fn: AlertCountListener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export default function FlaggedMessageAlert() {
  const [alerts, setAlerts] = useState<FlaggedAlert[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  // Per-collection initialization gate: suppress the first snapshot (existing docs)
  const initialized = useRef<Record<string, boolean>>({});

  const navigate = useNavigate();

  // Notify external badge subscribers whenever alert count changes
  useEffect(() => {
    listeners.forEach(fn => fn(alerts.length));
  }, [alerts.length]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const pushAlert = useCallback(
    (alert: FlaggedAlert) => {
      setAlerts(prev => {
        if (prev.some(a => a.id === alert.id)) return prev;
        return [alert, ...prev].slice(0, 6);
      });
      const handle = setTimeout(() => dismissAlert(alert.id), 12000);
      return () => clearTimeout(handle);
    },
    [dismissAlert],
  );

  // ── Generic listener factory ────────────────────────────────────────────────
  function useCollectionGroupListener(
    collectionName: string,
    source: FlaggedAlert['source'],
    navPath: string,
  ) {
    useEffect(() => {
      const key = collectionName;
      initialized.current[key] = false;

      const q = query(collectionGroup(db, collectionName));

      const unsub = onSnapshot(
        q,
        snap => {
          if (!initialized.current[key]) {
            // First snapshot: seed seen set, suppress alerts
            snap.docs.forEach(d => seenIds.current.add(`${key}-${d.id}`));
            initialized.current[key] = true;
            return;
          }

          snap.docChanges()
            .filter(c => c.type === 'added')
            .forEach(c => {
              const compositeKey = `${key}-${c.doc.id}`;
              if (seenIds.current.has(compositeKey)) return;
              seenIds.current.add(compositeKey);

              const data = c.doc.data() as Record<string, unknown>;
              if (!isFlaggedDoc(data)) return;

              pushAlert({
                id: compositeKey,
                source,
                senderName: getSenderName(data),
                snippet: getSnippet(data),
                timestamp: new Date(),
                navPath,
              });
            });
        },
        () => {
          // Permission error or collection doesn't exist → silently ignore
        },
      );

      return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  }

  // Group chat messages
  useCollectionGroupListener('chatMessages', 'group-chat', '/chat-review');

  // AI chat messages (try both common collection names)
  useCollectionGroupListener('ai_messages', 'ai-chat', '/monitoring');
  useCollectionGroupListener('messages', 'ai-chat', '/monitoring');

  // Journal entries (try all common sub-collection names)
  useCollectionGroupListener('journal_entries', 'journal', '/journal-review');
  useCollectionGroupListener('journalEntries', 'journal', '/journal-review');
  useCollectionGroupListener('journals', 'journal', '/journal-review');

  // ── Render toasts ──────────────────────────────────────────────────────────

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {alerts.map(alert => {
          const cfg = SOURCE_CONFIG[alert.source];

          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={cn(
                'pointer-events-auto rounded-2xl border shadow-xl overflow-hidden',
                cfg.bg,
                cfg.border,
              )}
            >
              {/* Header bar */}
              <div className={cn('flex items-center justify-between px-4 py-2.5 border-b', cfg.border)}>
                <div className={cn('flex items-center gap-2 font-bold text-xs uppercase tracking-wider', cfg.color)}>
                  <AlertTriangle size={13} />
                  <cfg.Icon size={13} />
                  <span>Flagged {cfg.label} Message</span>
                </div>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Body */}
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-slate-700 mb-1">{alert.senderName}</p>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{alert.snippet}</p>
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-opacity-50 flex items-center justify-between"
                   style={{ borderColor: 'inherit' }}>
                <span className="text-[10px] text-slate-400">
                  {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => {
                    dismissAlert(alert.id);
                    navigate(alert.navPath);
                  }}
                  className={cn(
                    'flex items-center gap-1 text-[11px] font-bold hover:underline',
                    cfg.color,
                  )}
                >
                  Review <ArrowRight size={11} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
