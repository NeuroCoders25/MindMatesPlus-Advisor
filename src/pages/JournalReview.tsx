import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Search, Calendar, Smile, Meh, Frown, Loader2, WifiOff } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import {
  collection,
  collectionGroup,
  onSnapshot,
  getDocs,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { JournalEntry } from '../types';
import NotesModal from '../components/NotesModal';

type EnrichedJournal = JournalEntry & { userName: string; isFlagged: boolean };
type SentimentFilter = 'All' | 'Positive' | 'Neutral' | 'Negative';

// ---- helpers ----

function toDateString(value: unknown): string {
  if (!value) return '—';
  if (value instanceof Timestamp) {
    return value.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (value instanceof Date) {
    return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return String(value) || '—';
}

function parseSentiment(value: unknown): number {
  const n = Number(value);
  if (isNaN(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) return value.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function parseJournal(
  id: string,
  userId: string,
  userName: string,
  data: Record<string, unknown>,
): EnrichedJournal {
  return {
    id,
    userId,
    date: toDateString(data.date ?? data.createdAt ?? data.timestamp),
    content: String(data.content ?? data.text ?? data.entry ?? data.body ?? ''),
    sentiment: parseSentiment(
      data.sentiment ?? data.sentimentScore ?? data.score ?? data.sentimentAnalysis,
    ),
    tags: parseTags(data.tags ?? data.mood_tag ?? data.keywords ?? data.emotions ?? []),
    userName,
    isFlagged: Boolean(data.flagged ?? data.isFlagged ?? false),
  };
}

function sentimentLabel(score: number): SentimentFilter {
  if (score >= 0) return 'Positive';
  if (score >= -0.3) return 'Neutral';
  return 'Negative';
}

// ---- component ----

export default function JournalReview() {
  const [journals, setJournals] = useState<EnrichedJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('All');
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedUserName, setSelectedUserName] = useState('');

  useEffect(() => {
    // Build a user-id → name map from the users collection.
    // Then try three strategies in priority order:
    //   1. collectionGroup('journalEntries')
    //   2. collectionGroup('journals')  (alternative subcollection name)
    //   3. top-level 'journals' collection
    async function buildUserMap(): Promise<Map<string, string>> {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const map = new Map<string, string>();
        snap.docs.forEach(d => {
          const data = d.data() as Record<string, unknown>;
          const name = String(
            data.nickname ?? data.nickName ?? data.name ?? data.displayName ?? data.fullName ?? data.userName ?? 'Unknown',
          );
          map.set(d.id, name);
        });
        return map;
      } catch {
        return new Map();
      }
    }

    async function loadJournals() {
      setLoading(true);
      setError(null);

      const userMap = await buildUserMap();

      // Helper: extract userId from a collectionGroup doc (parent segment)
      function resolveUserId(docData: Record<string, unknown>, refPath: string): string {
        if (docData.userId) return String(docData.userId);
        if (docData.user_id) return String(docData.user_id);
        // e.g. "users/ABC123/journalEntries/docId" → segment[1]
        const parts = refPath.split('/');
        const usersIdx = parts.indexOf('users');
        if (usersIdx !== -1 && parts[usersIdx + 1]) return parts[usersIdx + 1];
        return '';
      }

      // Strategy 1, 2 & 3: collectionGroup (try all known subcollection names)
      for (const subcollName of ['journal_entries', 'journalEntries', 'journals']) {
        try {
          const snap = await getDocs(
            query(collectionGroup(db, subcollName), orderBy('createdAt', 'desc')),
          );
          if (!snap.empty) {
            const fetched = snap.docs.map(d => {
              const data = d.data() as Record<string, unknown>;
              const userId = resolveUserId(data, d.ref.path);
              const userName = userMap.get(userId) ?? String(data.nickname ?? data.nickName ?? data.userName ?? data.name ?? 'Unknown');
              return parseJournal(d.id, userId, userName, data);
            });
            setJournals(fetched);
            setLoading(false);
            return;
          }
        } catch {
          // orderBy may fail without an index; retry without ordering
          try {
            const snap = await getDocs(collectionGroup(db, subcollName));
            if (!snap.empty) {
              const fetched = snap.docs.map(d => {
                const data = d.data() as Record<string, unknown>;
                const userId = resolveUserId(data, d.ref.path);
                const userName = userMap.get(userId) ?? String(data.nickname ?? data.nickName ?? data.userName ?? data.name ?? 'Unknown');
                return parseJournal(d.id, userId, userName, data);
              });
              fetched.sort((a, b) => b.date.localeCompare(a.date));
              setJournals(fetched);
              setLoading(false);
              return;
            }
          } catch {
            // try next strategy
          }
        }
      }

      // Strategy 3: top-level 'journals' collection
      try {
        const snap = await getDocs(collection(db, 'journals'));
        const fetched = snap.docs.map(d => {
          const data = d.data() as Record<string, unknown>;
          const userId = String(data.userId ?? data.user_id ?? '');
          const userName = userMap.get(userId) ?? String(data.nickname ?? data.nickName ?? data.userName ?? data.name ?? 'Unknown');
          return parseJournal(d.id, userId, userName, data);
        });
        fetched.sort((a, b) => b.date.localeCompare(a.date));
        setJournals(fetched);
        setLoading(false);
        return;
      } catch (err) {
        console.error('[JournalReview]', err);
        setError('Could not load journal entries. Check Firestore permissions.');
        setLoading(false);
      }
    }

    // Use a real-time listener on users so the list stays current,
    // and reload journals when the user list changes.
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      () => { loadJournals(); },
      (err) => {
        console.error('[JournalReview] users listener error:', err);
        // Still attempt to load journals even if user listener fails
        loadJournals();
      },
    );

    return () => unsubUsers();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return journals.filter(j => {
      const matchesSearch =
        !q ||
        j.userName.toLowerCase().includes(q) ||
        j.content.toLowerCase().includes(q) ||
        j.tags.some(t => t.toLowerCase().includes(q));

      const matchesSentiment =
        sentimentFilter === 'All' || sentimentLabel(j.sentiment) === sentimentFilter;

      return matchesSearch && matchesSentiment;
    });
  }, [journals, searchQuery, sentimentFilter]);

  const toggleFlag = (id: string) => {
    setFlaggedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <BookOpen className="text-brand-500" size={32} />
          Journal Review
        </h1>
        <p className="text-slate-500 mt-1">Monitor user journal entries analyzed for sentiment and emotional triggers.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by keywords or user..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-brand-300 rounded-xl outline-none text-sm transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">
            <Calendar size={16} />
            Date Range
          </button>
          <select
            value={sentimentFilter}
            onChange={e => setSentimentFilter(e.target.value as SentimentFilter)}
            className="bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold px-4 py-2 outline-none border-none cursor-pointer"
          >
            <option value="All">All Sentiments</option>
            <option value="Positive">Positive</option>
            <option value="Neutral">Neutral</option>
            <option value="Negative">Negative</option>
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="animate-spin mr-3" size={24} />
          <span className="text-sm font-medium">Loading journal entries…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100">
          <WifiOff size={20} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 glass-card">
          <BookOpen size={40} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">No journal entries found.</p>
        </div>
      )}

      {/* Entries */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {filtered.map((journal) => (
            <div key={journal.id} className="glass-card p-6 flex flex-col md:flex-row gap-6">
              <div className="md:w-64 shrink-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                    {journal.userName.charAt(0)}
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">{journal.userName}</h5>
                    <p className="text-[10px] text-slate-400">{journal.date}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">AI Sentiment</p>
                    <div className="flex items-center gap-2">
                      {journal.sentiment < -0.5
                        ? <Frown className="text-red-500" size={18} />
                        : journal.sentiment < 0
                          ? <Meh className="text-amber-500" size={18} />
                          : <Smile className="text-emerald-500" size={18} />}
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            journal.sentiment < -0.5
                              ? 'bg-red-500'
                              : journal.sentiment < 0
                                ? 'bg-amber-500'
                                : 'bg-emerald-500',
                          )}
                          style={{ width: `${Math.abs(journal.sentiment) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-600">
                        {(journal.sentiment * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {journal.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {journal.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-brand-50 text-brand-600 rounded-md text-[10px] font-bold uppercase tracking-wider"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <div className="bg-slate-50 rounded-2xl p-6 relative">
                  <div className="absolute top-4 right-4 text-slate-200">
                    <BookOpen size={48} />
                  </div>
                  <p className="text-slate-700 leading-relaxed italic relative z-10">
                    "{journal.content || 'No content available.'}"
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-end gap-3">
                  <button
                    onClick={() => toggleFlag(journal.id)}
                    className={cn(
                      'text-xs font-bold transition-colors',
                      flaggedIds.has(journal.id)
                        ? 'text-amber-500 hover:text-amber-600'
                        : 'text-slate-400 hover:text-slate-600',
                    )}
                  >
                    {flaggedIds.has(journal.id) ? 'Flagged ✓' : 'Flag for Follow-up'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUserName(journal.userName);
                      setIsNotesModalOpen(true);
                    }}
                    className="px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-bold hover:bg-brand-600 transition-all"
                  >
                    Add Note
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NotesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        userName={selectedUserName}
      />
    </motion.div>
  );
}
