import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  getUserDisplayName,
  normalizeRiskLevel,
  normalizeUserStatus,
} from '../../types/userDiagnostic';
import type { UserDiagnosticProfile, MentalHealthProfileData } from '../../types/userDiagnostic';

interface Props {
  profile: UserDiagnosticProfile | null;
  mentalHealthProfile: MentalHealthProfileData | null;
  onClose: () => void;
}

const RISK_CHIP: Record<string, string> = {
  Critical: 'bg-red-100 text-red-900 border border-red-200 animate-pulse font-bold',
  High:     'bg-red-50  text-red-700  border border-red-100',
  Medium:   'bg-amber-50 text-amber-700 border border-amber-100',
  Low:      'bg-emerald-50 text-emerald-700 border border-emerald-100',
};

const STATUS_CHIP: Record<string, string> = {
  'Active':       'bg-emerald-50 text-emerald-700',
  'Monitoring':   'bg-amber-50   text-amber-700',
  'Restricted':   'bg-red-50     text-red-700',
  'Under Review': 'bg-blue-50    text-blue-700',
  'Inactive':     'bg-slate-100  text-slate-500',
};

function truncateUid(uid: string): string {
  if (uid.length <= 14) return uid;
  return `${uid.slice(0, 8)}…${uid.slice(-4)}`;
}

export default function PanelHeader({ profile, mentalHealthProfile, onClose }: Props) {
  const navigate = useNavigate();
  const name     = getUserDisplayName(profile);
  const initial  = name.charAt(0).toUpperCase();
  const rawRisk  = profile?.riskLevel
    ?? mentalHealthProfile?.activeRecommendationCategory;
  const risk     = normalizeRiskLevel(rawRisk);
  const status   = normalizeUserStatus(profile, mentalHealthProfile);
  const uid      = profile?.uid ?? '';

  return (
    <div className="shrink-0 bg-[#0f1535] px-5 py-4 flex items-center gap-4 border-b border-[#1e2650]">
      {/* Avatar */}
      <div className="w-11 h-11 rounded-full bg-brand-500/20 border-2 border-brand-500/40 flex items-center justify-center text-white font-bold text-lg shrink-0">
        {initial}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-semibold text-base leading-tight truncate max-w-[180px]">
            {name}
          </span>
          {/* Risk chip */}
          <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', RISK_CHIP[risk])}>
            {risk}
          </span>
          {/* Status chip */}
          <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', STATUS_CHIP[status] ?? STATUS_CHIP['Active'])}>
            {status}
          </span>
        </div>
        <p className="text-white/40 text-[11px] mt-0.5 font-mono">{truncateUid(uid)}</p>
      </div>

      {/* Open full profile */}
      <button
        onClick={() => navigate('/journal-review', { state: { filterUserId: uid } })}
        title="Open journal review for this user"
        className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
      >
        <ExternalLink size={17} />
      </button>

      {/* Close */}
      <button
        onClick={onClose}
        title="Close (ESC)"
        className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X size={20} />
      </button>
    </div>
  );
}
