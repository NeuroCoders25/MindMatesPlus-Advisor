import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import type { AvailabilityStatus } from '../context/AuthContext';

const OPTIONS: {
  value: AvailabilityStatus;
  label: string;
  description: string;
  dot: string;
  ring: string;
  bg: string;
  border: string;
}[] = [
  {
    value: 'online',
    label: 'Online',
    description: 'Available for immediate response',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-200',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  {
    value: 'busy',
    label: 'Busy',
    description: 'Occupied — may respond with delay',
    dot: 'bg-amber-500',
    ring: 'ring-amber-200',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  {
    value: 'away',
    label: 'Away',
    description: 'Temporarily away from portal',
    dot: 'bg-slate-400',
    ring: 'ring-slate-200',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  },
  {
    value: 'offline',
    label: 'Offline',
    description: 'Not currently logged in',
    dot: 'bg-slate-300',
    ring: 'ring-slate-100',
    bg: 'bg-white',
    border: 'border-slate-100',
  },
];

export function availabilityDotClass(status?: AvailabilityStatus): string {
  switch (status) {
    case 'online': return 'bg-emerald-500';
    case 'busy':   return 'bg-amber-500';
    case 'away':   return 'bg-slate-400';
    default:       return 'bg-slate-300';
  }
}

export function availabilityLabel(status?: AvailabilityStatus): string {
  switch (status) {
    case 'online':  return 'Online';
    case 'busy':    return 'Busy';
    case 'away':    return 'Away';
    default:        return 'Offline';
  }
}

export default function AvailabilitySelector() {
  const { advisorProfile, updateAvailability } = useAuth();
  const current = advisorProfile?.availability ?? 'online';
  const [saving, setSaving] = useState<AvailabilityStatus | null>(null);

  async function handleSelect(value: AvailabilityStatus) {
    if (value === current || saving) return;
    setSaving(value);
    try {
      await updateAvailability(value);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="glass-card p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-brand-50 rounded-xl">
          <ShieldCheck size={18} className="text-brand-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">My Availability</h3>
          <p className="text-xs text-slate-400 mt-0.5">Visible to users and admins in chat</p>
        </div>
      </div>

      <div className="space-y-2">
        {OPTIONS.map((opt) => {
          const isSelected = current === opt.value;
          const isSaving = saving === opt.value;

          return (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              whileTap={{ scale: 0.99 }}
              disabled={!!saving}
              className={`
                w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all text-left
                ${isSelected
                  ? `${opt.bg} ${opt.border} shadow-sm ring-1 ${opt.ring}`
                  : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                }
                ${saving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <span className={`w-3 h-3 rounded-full shrink-0 ${opt.dot} ${isSelected ? `ring-4 ${opt.ring}` : ''} transition-all`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{opt.description}</p>
              </div>
              {isSelected && !isSaving && (
                <CheckCircle2 size={18} className="text-brand-500 shrink-0" />
              )}
              {isSaving && (
                <span className="w-4 h-4 border-2 border-brand-300 border-t-brand-500 rounded-full animate-spin shrink-0" />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
