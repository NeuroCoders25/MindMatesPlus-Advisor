import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Search, PlusCircle } from 'lucide-react';
import { motion } from 'motion/react';
import CaseCard from '../components/CaseCard';
import NotesModal from '../components/NotesModal';
import UserDetailsModal from '../components/UserDetailsModal';
import DirectChatModal from '../components/DirectChatModal';
import { Case } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, getDoc, doc } from 'firebase/firestore';

function toDateString(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object' && 'seconds' in (value as object)) {
    try {
      const d = new Date((value as { seconds: number }).seconds * 1000);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  }
  const s = String(value);
  return s === 'undefined' || s === 'null' || s === '' ? '—' : s;
}

function normalizeRiskLevel(value: unknown): Case['riskLevel'] {
  const v = String(value ?? '').toLowerCase().trim();
  if (v === 'critical' || v === 'severe') return 'Critical';
  if (v === 'high' || v === 'moderate') return 'High';
  if (v === 'medium' || v === 'mild') return 'Medium';
  return 'Low';
}

function normalizeStatus(value: unknown): Case['status'] {
  const v = String(value ?? '').toLowerCase().trim();
  if (v === 'escalated') return 'Escalated';
  if (v === 'resolved') return 'Resolved';
  return 'Open';
}

function parseCase(id: string, data: Record<string, unknown>): Case {
  const rawRisk =
    data.classificationLevel ?? data.riskLevel ?? data.risk_level ?? data.level ??
    data.severity ?? data.alertLevel ?? data.mentalHealthRisk ?? data.risk;

  return {
    id,
    userId: (data.userId ?? data.uid ?? data.user_id ?? id) as string,
    userName: (data.userName ?? data.name ?? data.displayName ?? data.fullName ?? 'Unknown') as string,
    riskLevel: normalizeRiskLevel(rawRisk),
    lastActivity: toDateString(data.lastActivity ?? data.last_active ?? data.lastSeen ?? data.updatedAt),
    reason: (data.reason ?? data.flagReason ?? data.description ?? data.aiFlag ?? data.notes ?? 'Risk detected') as string,
    status: normalizeStatus(data.status),
  };
}

const HIGH_RISK: Case['riskLevel'][] = ['Critical', 'High'];
const RISK_ORDER: Record<Case['riskLevel'], number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export default function CriticalCases() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDirectChatOpen, setIsDirectChatOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'All' | 'Critical' | 'High'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Escalated' | 'Resolved'>('All');

  // Track whether the `cases` collection has already provided data so
  // the `users` fallback listener doesn't overwrite it.
  const casesHasData = useRef(false);

  useEffect(() => {
    setLoading(true);
    casesHasData.current = false;

    // Primary: real-time listener on all users, filter Critical/High client-side.
    // For each user we also fetch their mentalHealthProfile/currentProfile subcollection
    // document to read the classificationLevel written by the onboarding questionnaire.
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      async (snap) => {
        if (casesHasData.current) return;

        // Batch-fetch mental health profiles so we get classificationLevel
        const profileResults = await Promise.all(
          snap.docs.map((d) =>
            getDoc(doc(db, 'users', d.id, 'mentalHealthProfile', 'currentProfile'))
              .then((p) => ({ id: d.id, data: (p.exists() ? p.data() : {}) as Record<string, unknown> }))
              .catch(() => ({ id: d.id, data: {} as Record<string, unknown> }))
          )
        );
        const profileMap = new Map(profileResults.map((p) => [p.id, p.data]));

        const fetched = snap.docs.map((d) => {
          const userData = d.data() as Record<string, unknown>;
          const profileData = profileMap.get(d.id) ?? {};
          // classificationLevel from the subcollection takes priority over any field on the user doc
          const merged: Record<string, unknown> = { ...userData };
          if (profileData.classificationLevel) merged.classificationLevel = profileData.classificationLevel;
          return parseCase(d.id, merged);
        });

        const hasRiskData = fetched.some((c) => c.riskLevel !== 'Low');
        const display = hasRiskData ? fetched.filter((c) => HIGH_RISK.includes(c.riskLevel)) : fetched;
        setCases(display);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[CriticalCases] users collection error:', err);
        if (!casesHasData.current) {
          setError('Could not load users. Check Firestore permissions.');
          setLoading(false);
        }
      }
    );

    // Secondary: if a `cases` collection exists, it takes priority over users.
    const unsubCases = onSnapshot(
      collection(db, 'cases'),
      (snap) => {
        if (snap.empty) {
          casesHasData.current = false;
          return;
        }
        const fetched = snap.docs
          .map((d) => parseCase(d.id, d.data() as Record<string, unknown>))
          .filter((c) => HIGH_RISK.includes(c.riskLevel) || c.status !== 'Resolved');

        if (fetched.length > 0) {
          casesHasData.current = true;
          setCases(fetched);
          setLoading(false);
          setError(null);
        }
      },
      () => {} // cases collection absent — silently ignore
    );

    return () => {
      unsubUsers();
      unsubCases();
    };
  }, []);

  const filteredCases = cases
    .filter(
      (c) =>
        searchQuery === '' ||
        c.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((c) => riskFilter === 'All' || c.riskLevel === riskFilter)
    .filter((c) => statusFilter === 'All' || c.status === statusFilter)
    .sort((a, b) => RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel]);

  const handleViewDetails = (c: Case) => {
    setSelectedCase(c);
    setIsDetailsModalOpen(true);
  };

  const handleAddNote = (c: Case) => {
    setSelectedCase(c);
    setIsNotesModalOpen(true);
  };

  const handleOpenChat = (c: Case) => {
    setSelectedCase(c);
    setIsDirectChatOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <AlertTriangle className="text-red-500" size={32} />
            Critical Cases
          </h1>
          <p className="text-slate-500 mt-1">AI-flagged high-risk users requiring immediate advisor review.</p>
        </div>
        <button className="px-6 py-3 bg-brand-500 text-white rounded-2xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-600 transition-all flex items-center gap-2 self-start">
          <PlusCircle size={20} />
          New Intervention
        </button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by name or case ID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-brand-300 rounded-xl outline-none text-sm transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as typeof riskFilter)}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold outline-none border-none hover:bg-slate-200 transition-colors"
          >
            <option value="All">All Risk Levels</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold outline-none border-none hover:bg-slate-200 transition-colors"
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Escalated">Escalated</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Case grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="text-center py-16">
          <AlertTriangle size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-semibold text-slate-500">No critical cases found</p>
          <p className="text-sm text-slate-400 mt-1">
            {cases.length === 0
              ? 'No high-risk users in the database yet.'
              : 'No users match the current filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCases.map((c) => (
            <CaseCard
              key={c.id}
              caseData={c}
              onViewDetails={() => handleViewDetails(c)}
              onAddNote={() => handleAddNote(c)}
              onOpenChat={() => handleOpenChat(c)}
            />
          ))}
        </div>
      )}

      {/* Protocol reminder */}
      <div className="bg-brand-50 rounded-3xl p-8 border border-brand-100 flex flex-col md:flex-row items-center gap-8">
        <div className="w-20 h-20 bg-brand-500 rounded-3xl flex items-center justify-center text-white shrink-0 shadow-xl shadow-brand-200">
          <AlertTriangle size={40} />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h3 className="text-xl font-bold text-slate-800 mb-2">Protocol Reminder</h3>
          <p className="text-slate-600 leading-relaxed">
            For all <span className="font-bold text-red-600">Critical</span> risk cases, advisors must initiate
            contact within 15 minutes of detection. Ensure all intervention steps are documented in the Advisor
            Notes section.
          </p>
        </div>
        <button className="px-8 py-3 bg-white text-brand-600 rounded-2xl font-bold border border-brand-200 hover:bg-brand-50 transition-all">
          View Protocol
        </button>
      </div>

      <NotesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        userName={selectedCase?.userName ?? ''}
      />

      {selectedCase && (
        <UserDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          userId={selectedCase.userId}
          userName={selectedCase.userName}
          riskLevel={selectedCase.riskLevel}
          onOpenChat={() => {
            setIsDetailsModalOpen(false);
            setIsDirectChatOpen(true);
          }}
        />
      )}

      {selectedCase && (
        <DirectChatModal
          isOpen={isDirectChatOpen}
          onClose={() => setIsDirectChatOpen(false)}
          caseData={selectedCase}
          onViewProfile={() => {
            setIsDirectChatOpen(false);
            setIsDetailsModalOpen(true);
          }}
        />
      )}
    </motion.div>
  );
}
