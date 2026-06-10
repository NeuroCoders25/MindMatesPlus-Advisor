import React from 'react';
import { cn } from '../../lib/utils';

export type TabName =
  | 'Overview'
  | 'DASS & Scores'
  | 'ML Pipeline'
  | 'BERT History'
  | 'Journals'
  | 'Feedback'
  | 'About';

const TABS: TabName[] = [
  'Overview',
  'Journals',
  'Feedback',
  'About',
];

interface Props {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

export default function TabBar({ activeTab, onTabChange }: Props) {
  return (
    <div className="shrink-0 flex gap-0 border-b border-slate-200 bg-white overflow-x-auto scrollbar-none">
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={cn(
            'px-4 py-3 text-xs font-semibold whitespace-nowrap transition-all border-b-2 -mb-px',
            activeTab === tab
              ? 'text-brand-600 border-brand-500 bg-brand-50/50'
              : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300',
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
