import React from 'react';
import { Case } from '../types';
import RiskBadge from './RiskBadge';
import { Clock, AlertCircle, ChevronRight, StickyNote, MessageSquare } from 'lucide-react';

interface CaseCardProps {
  caseData: Case;
  onViewDetails?: () => void;
  onAddNote?: () => void;
  onOpenChat?: () => void;
}

export default function CaseCard({ caseData, onViewDetails, onAddNote, onOpenChat }: CaseCardProps) {
  return (
    <div className="glass-card p-5 hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-brand-500">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-lg">
            {caseData.userName.charAt(0)}
          </div>
          <div>
            <h4 className="font-bold text-slate-800">{caseData.userName}</h4>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={12} />
              <span>{caseData.lastActivity}</span>
            </div>
          </div>
        </div>
        <RiskBadge level={caseData.riskLevel} />
      </div>

      <div className="bg-slate-50 rounded-xl p-3 mb-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-brand-500 mt-0.5 shrink-0" />
        <p className="text-sm text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-800">Reason:</span> {caseData.reason}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onOpenChat && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenChat(); }}
              className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors"
            >
              <MessageSquare size={14} />
              Open Chat
            </button>
          )}
          {onAddNote && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddNote(); }}
              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
              title="Add note"
            >
              <StickyNote size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetails?.(); }}
            className="flex items-center gap-1 text-sm font-semibold text-brand-600 hover:translate-x-1 transition-transform"
          >
            View Details <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
