import { useEffect, useState, useMemo } from 'react';
import {
  FileText, Download, Calendar, Filter, FileSpreadsheet, Loader2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { RiskLevel } from '../types';

// ─── types ────────────────────────────────────────────────────────────────────

interface RichUser {
  id: string;
  name: string;
  riskLevel: RiskLevel;
  status: 'Active' | 'Inactive' | 'Monitoring';
  lastActivity: string;
  rawActivityMs: number;
  depressionScore?: number;
  anxietyScore?: number;
  stressScore?: number;
}

const RISK_ORDER: Record<RiskLevel, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

// ─── normalisation helpers (same rules as Dashboard / UserMonitoring) ─────────

function normalizeRiskLevel(value: unknown): RiskLevel {
  const v = String(value ?? '').toLowerCase().trim();
  if (v.includes('extremely') || v.includes('severe') || v === 'critical') return 'Critical';
  if (v.includes('high') || v.includes('moderate') || v === 'moderate') return 'High';
  if (v === 'medium' || v === 'mild') return 'Medium';
  return 'Low';
}

function normalizeStatus(value: unknown): RichUser['status'] {
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

// ─── download utilities ───────────────────────────────────────────────────────

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadCSV(filename: string, headers: string[], rows: Array<Array<string | number | undefined>>) {
  const esc = (v: string | number | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const content = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n');
  // BOM so Excel opens UTF-8 CSV correctly
  triggerDownload(filename, new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' }));
}


// ─── Firebase data hook ───────────────────────────────────────────────────────

function useReportsData() {
  const [users, setUsers] = useState<RichUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      async (snap) => {
        const profileResults = await Promise.all(
          snap.docs.map(d =>
            getDoc(doc(db, 'users', d.id, 'mentalHealthProfile', 'currentProfile'))
              .then(p => ({ id: d.id, data: (p.exists() ? p.data() : {}) as Record<string, unknown> }))
              .catch(() => ({ id: d.id, data: {} as Record<string, unknown> }))
          )
        );
        const profileMap = new Map(profileResults.map(p => [p.id, p.data]));

        const parsed: RichUser[] = snap.docs.map(d => {
          const data = d.data() as Record<string, unknown>;
          const profile = profileMap.get(d.id) ?? {};
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
          const rawStatus = data.status ?? (riskLevel === 'High' || riskLevel === 'Critical' ? 'Monitoring' : 'Active');
          const rawActivity = data.lastActivity ?? data.last_active ?? data.lastSeen ?? data.updatedAt;

          let rawActivityMs = 0;
          if (rawActivity) {
            if (typeof rawActivity === 'object' && 'seconds' in (rawActivity as object)) {
              rawActivityMs = (rawActivity as { seconds: number }).seconds * 1000;
            } else {
              const d2 = new Date(String(rawActivity));
              if (!isNaN(d2.getTime())) rawActivityMs = d2.getTime();
            }
          }

          return {
            id: d.id,
            name: (data.nickname ?? data.nickName ?? data.name ?? data.displayName ?? data.userName ?? data.fullName ?? 'Unknown') as string,
            riskLevel,
            status: normalizeStatus(rawStatus),
            lastActivity: toRelativeTime(rawActivity),
            rawActivityMs,
            depressionScore: typeof profile.depressionScore === 'number' ? profile.depressionScore as number : undefined,
            anxietyScore: typeof profile.anxietyScore === 'number' ? profile.anxietyScore as number : undefined,
            stressScore: typeof profile.stressScore === 'number' ? profile.stressScore as number : undefined,
          };
        });

        setUsers(parsed);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  return { users, loading };
}

// ─── report definitions (static metadata, dynamic live-data downloads) ────────

const REPORT_DEFS = [
  { id: 'R1', name: 'Weekly System Health Summary',     date: 'Mar 17, 2026' },
  { id: 'R2', name: 'High-Risk User Intervention Log',  date: 'Mar 16, 2026' },
  { id: 'R3', name: 'AI Sentiment Accuracy Report',     date: 'Mar 15, 2026' },
  { id: 'R4', name: 'Monthly Peer Support Analytics',   date: 'Mar 01, 2026' },
  { id: 'R5', name: 'Crisis Response Time Audit',       date: 'Feb 28, 2026' },
];

// ─── component ────────────────────────────────────────────────────────────────

export default function Reports() {
  const { users, loading } = useReportsData();
  const [generating, setGenerating] = useState(false);

  const stats = useMemo(() => {
    const byRisk = (r: RiskLevel) => users.filter(u => u.riskLevel === r).length;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return {
      total: users.length,
      critical: byRisk('Critical'),
      high: byRisk('High'),
      medium: byRisk('Medium'),
      low: byRisk('Low'),
      monitoring: users.filter(u => u.status === 'Monitoring').length,
      activeToday: users.filter(u => u.rawActivityMs >= todayStart.getTime()).length,
    };
  }, [users]);

  const avgScores = useMemo(() => {
    const avg = (key: 'depressionScore' | 'anxietyScore' | 'stressScore') => {
      const vals = users.map(u => u[key]).filter((v): v is number => v !== undefined);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    };
    return { depression: avg('depressionScore'), anxiety: avg('anxietyScore'), stress: avg('stressScore') };
  }, [users]);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel]),
    [users]
  );

  const CSV_HEADERS = ['Name', 'Risk Level', 'Status', 'Last Activity', 'Depression Score', 'Anxiety Score', 'Stress Score'];
  const toCSVRow = (u: RichUser) => [u.name, u.riskLevel, u.status, u.lastActivity, u.depressionScore, u.anxietyScore, u.stressScore];

  // "Generate System Summary" header button
  const handleGenerateSummary = () => {
    if (loading) return;
    setGenerating(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      downloadCSV(`system-summary-${date}.csv`, CSV_HEADERS, sortedUsers.map(toCSVRow));
    } finally {
      setGenerating(false);
    }
  };

  // Per-report download buttons
  const handleReportDownload = (reportId: string) => {
    if (loading) return;
    const date = new Date().toISOString().split('T')[0];
    const highRisk = sortedUsers.filter(u => u.riskLevel === 'Critical' || u.riskLevel === 'High');
    const critical = users.filter(u => u.riskLevel === 'Critical');

    switch (reportId) {
      case 'R1':
        downloadCSV(`weekly-health-summary-${date}.csv`, CSV_HEADERS, sortedUsers.map(toCSVRow));
        break;
      case 'R2':
        downloadCSV(`high-risk-intervention-log-${date}.csv`, CSV_HEADERS, highRisk.map(toCSVRow));
        break;
      case 'R3':
        downloadCSV(`ai-sentiment-report-${date}.csv`,
          ['Name', 'Risk Level', 'Depression Score', 'Anxiety Score', 'Stress Score'],
          sortedUsers.map(u => [u.name, u.riskLevel, u.depressionScore, u.anxietyScore, u.stressScore])
        );
        break;
      case 'R4':
        downloadCSV(`monthly-analytics-${date}.csv`, CSV_HEADERS, sortedUsers.map(toCSVRow));
        break;
      case 'R5':
        downloadCSV(`crisis-audit-${date}.csv`,
          ['Name', 'Risk Level', 'Status', 'Last Activity'],
          highRisk.map(u => [u.name, u.riskLevel, u.status, u.lastActivity])
        );
        break;
    }
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
            <FileText className="text-brand-500" size={32} />
            Reports & Analytics
          </h1>
          <p className="text-slate-500 mt-1">Generate and download detailed reports for clinical review and auditing.</p>
        </div>
        <button
          onClick={handleGenerateSummary}
          disabled={loading || generating}
          className="px-6 py-3 bg-brand-500 text-white rounded-2xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-600 transition-all flex items-center gap-2 self-start disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {generating ? <Loader2 size={20} className="animate-spin" /> : <Calendar size={20} />}
          Generate System Summary
        </button>
      </header>

      {/* Live stats strip */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Users',  value: stats.total,                   color: 'text-brand-600',   bg: 'bg-brand-50'   },
            { label: 'High Risk',    value: stats.critical + stats.high,   color: 'text-red-600',     bg: 'bg-red-50'     },
            { label: 'Monitoring',   value: stats.monitoring,              color: 'text-amber-600',   bg: 'bg-amber-50'   },
            { label: 'Active Today', value: stats.activeToday,             color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`glass-card px-5 py-4 ${bg}`}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* ── sidebar ── */}
        <div className="md:col-span-1 space-y-6">
          <div className="glass-card p-6">
            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Filter size={18} className="text-brand-500" />
              Download Options
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Category</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none">
                  <option>All Categories</option>
                  <option>Clinical</option>
                  <option>System Performance</option>
                  <option>User Analytics</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Timeframe</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none">
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                  <option>Custom Range</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Format</label>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-brand-500 text-white">CSV</span>
                  {(['PDF', 'Excel', 'JSON'] as const).map(f => (
                    <button key={f} disabled title="Coming soon" className="px-3 py-1 bg-slate-100 text-slate-300 rounded-lg text-xs font-bold cursor-not-allowed">
                      {f}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">PDF, Excel & JSON coming soon</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 bg-slate-900 text-white border-none">
            <h4 className="font-bold mb-2">Auto-Reporting</h4>
            <p className="text-slate-400 text-xs leading-relaxed mb-4">
              Weekly summaries are automatically generated every Monday at 8:00 AM.
            </p>
            <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors">
              Configure Schedule
            </button>
          </div>
        </div>

        {/* ── report list ── */}
        <div className="md:col-span-3 space-y-4">
          {REPORT_DEFS.map((report) => (
            <div key={report.id} className="glass-card p-4 flex items-center justify-between hover:shadow-md transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-brand-50 transition-colors">
                  <FileSpreadsheet className="text-emerald-500" size={24} />
                </div>
                <div>
                  <h5 className="font-bold text-slate-800 group-hover:text-brand-600 transition-colors">{report.name}</h5>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>{report.date}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="font-bold text-emerald-600">CSV</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="text-emerald-500 font-medium">Live data</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleReportDownload(report.id)}
                disabled={loading}
                title="Download as CSV"
                className="p-3 bg-slate-50 text-slate-400 hover:bg-brand-50 hover:text-brand-600 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={20} />
              </button>
            </div>
          ))}

          <div className="flex justify-center pt-4">
            <button className="text-sm font-bold text-slate-400 hover:text-brand-600 transition-colors">
              Load More Reports
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
