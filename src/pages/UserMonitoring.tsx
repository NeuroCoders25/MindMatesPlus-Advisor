import React, { useState, useEffect } from 'react';
import { Users, Search, Download } from 'lucide-react';
import UserTable from '../components/UserTable';
import UserDetailsModal from '../components/UserDetailsModal';
import UserDetailPanel from '../components/UserDetailPanel';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { User, RiskLevel } from '../types';

const PAGE_SIZE = 10;
const RISK_ORDER: Record<RiskLevel, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function normalizeRiskLevel(value: unknown): RiskLevel {
  const v = String(value ?? '').toLowerCase().trim();
  if (v.includes('extremely') || v.includes('severe') || v === 'critical') return 'Critical';
  if (v.includes('high') || v.includes('moderate') || v === 'moderate') return 'High';
  if (v === 'medium' || v === 'mild') return 'Medium';
  return 'Low';
}

function normalizeStatus(value: unknown): User['status'] {
  const v = String(value ?? '').toLowerCase().trim();
  if (v === 'monitoring') return 'Monitoring';
  if (v === 'inactive') return 'Inactive';
  return 'Active';
}

function toRelativeTime(value: unknown): string {
  if (!value) return '—';
  let date: Date;
  if (typeof value === 'object' && value !== null && 'seconds' in (value as object)) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  } else {
    const s = String(value);
    if (!s || s === 'undefined' || s === 'null') return '—';
    date = new Date(s);
  }
  if (isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function toTimestamp(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'seconds' in (value as object))
    return (value as { seconds: number }).seconds * 1000;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function resolveActivityTimestamp(data: Record<string, unknown>, profile: Record<string, unknown>): unknown {
  return (
    data.lastActivity ??
    data.lastActive ??
    data.last_active ??
    data.lastSeen ??
    data.updatedAt ??
    (data.mlMentalHealthProfile as Record<string, unknown> | undefined)?.lastUpdated ??
    profile.lastUpdated ??
    profile.knnLastUpdatedAt ??
    data.createdAt
  );
}

function parseUser(id: string, data: Record<string, unknown>, profile: Record<string, unknown>): User {
  const iqScore = profile.initialQuestionnaireScore as Record<string, unknown> | undefined;
  const rawRisk =
    profile.classificationLevel ??
    profile.activeRecommendationCategory ??
    iqScore?.category ??
    data.classificationLevel ??
    data.riskLevel ??
    data.risk_level ??
    data.severity ??
    data.alertLevel;
  const riskLevel = normalizeRiskLevel(rawRisk);
  const rawStatus =
    data.status ?? (riskLevel === 'High' || riskLevel === 'Critical' ? 'Monitoring' : 'Active');
  return {
    id,
    name: (data.nickname ?? data.nickName ?? data.name ?? data.displayName ?? data.userName ?? data.fullName ?? 'Unknown') as string,
    riskLevel,
    status: normalizeStatus(rawStatus),
    lastActivity: toRelativeTime(resolveActivityTimestamp(data, profile)),
  };
}

export default function UserMonitoring() {
  const [users, setUsers] = useState<User[]>([]);
  const [timestamps, setTimestamps] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('Last Activity');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'users'),
      async (snap) => {
        try {
          const profileResults = await Promise.all(
            snap.docs.map((d) =>
              getDoc(doc(db, 'users', d.id, 'mentalHealthProfile', 'currentProfile'))
                .then((p) => ({ id: d.id, data: (p.exists() ? p.data() : {}) as Record<string, unknown> }))
                .catch(() => ({ id: d.id, data: {} as Record<string, unknown> }))
            )
          );
          const profileMap = new Map(profileResults.map((p) => [p.id, p.data]));
          const tsMap = new Map<string, number>();
          const parsed = snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            const profile = profileMap.get(d.id) ?? {};
            tsMap.set(d.id, toTimestamp(resolveActivityTimestamp(data, profile)));
            return parseUser(d.id, data, profile);
          });
          setUsers(parsed);
          setTimestamps(tsMap);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('[UserMonitoring]', err);
          setError('Failed to load user data.');
          setLoading(false);
        }
      },
      (err) => {
        console.error('[UserMonitoring] snapshot error:', err);
        setError('Could not load users. Check Firestore permissions.');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const lowCount = users.filter((u) => u.riskLevel === 'Low').length;
  const mediumCount = users.filter((u) => u.riskLevel === 'Medium').length;
  const highCritCount = users.filter(
    (u) => u.riskLevel === 'High' || u.riskLevel === 'Critical'
  ).length;
  const totalCount = users.length;

  const filtered = users
    .filter(
      (u) =>
        searchQuery === '' ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'Name') return a.name.localeCompare(b.name);
      if (sortBy === 'Last Activity')
        return (timestamps.get(b.id) ?? 0) - (timestamps.get(a.id) ?? 0);
      return RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Users className="text-brand-500" size={32} />
            User Monitoring
          </h1>
          <p className="text-slate-500 mt-1">Real-time overview of all users and their AI-calculated risk scores.</p>
        </div>
        <button className="px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2 self-start shadow-sm">
          <Download size={20} />
          Export Data
        </button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border-b-4 border-b-emerald-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Low Risk</p>
          <h4 className="text-3xl font-bold text-slate-800">
            {loading ? '—' : lowCount.toLocaleString()}
          </h4>
          <p className="text-xs text-slate-500 mt-2">
            {!loading && totalCount > 0
              ? `${Math.round((lowCount / totalCount) * 100)}% of total users`
              : '—'}
          </p>
        </div>
        <div className="glass-card p-6 border-b-4 border-b-amber-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Medium Risk</p>
          <h4 className="text-3xl font-bold text-slate-800">
            {loading ? '—' : mediumCount.toLocaleString()}
          </h4>
          <p className="text-xs text-slate-500 mt-2">
            {!loading && totalCount > 0
              ? `${Math.round((mediumCount / totalCount) * 100)}% of total users`
              : '—'}
          </p>
        </div>
        <div className="glass-card p-6 border-b-4 border-b-red-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">High/Critical</p>
          <h4 className="text-3xl font-bold text-slate-800">
            {loading ? '—' : highCritCount.toLocaleString()}
          </h4>
          <p className="text-xs text-slate-500 mt-2">
            {!loading && totalCount > 0
              ? `${Math.round((highCritCount / totalCount) * 100)}% of total users`
              : '—'}
          </p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name or ID..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-brand-300 rounded-xl outline-none text-sm transition-all"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold px-4 py-2 outline-none border-none"
          >
            <option value="Last Activity">Sort by: Last Activity</option>
            <option value="Risk Level">Sort by: Risk Level</option>
            <option value="Name">Sort by: Name</option>
          </select>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading users…</div>
        ) : (
          <UserTable
            users={paginated}
            onViewDetails={(u) => {
              setSelectedUserId(u.id);
            }}
          />
        )}

        <div className="p-6 border-t border-slate-100 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {loading
              ? 'Loading…'
              : `Showing ${paginated.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + paginated.length} of ${filtered.length} users`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-slate-50 disabled:hover:bg-transparent"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-slate-50 disabled:hover:bg-transparent"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selectedUser && (
        <UserDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          userId={selectedUser.id}
          userName={selectedUser.name}
          riskLevel={selectedUser.riskLevel}
        />
      )}

      {/* Mental Health Detail Panel — slides in from the right */}
      <UserDetailPanel
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </motion.div>
  );
}
