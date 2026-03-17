import React from 'react';
import { RiskLevel } from '../types';
import { cn } from '../lib/utils';

interface RiskBadgeProps {
  level: RiskLevel;
}

export default function RiskBadge({ level }: RiskBadgeProps) {
  const styles = {
    Low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    Medium: 'bg-amber-50 text-amber-700 border-amber-100',
    High: 'bg-red-50 text-red-700 border-red-100',
    Critical: 'bg-red-100 text-red-900 border-red-200 font-bold animate-pulse',
  };

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-xs font-medium border",
      styles[level]
    )}>
      {level}
    </span>
  );
}
