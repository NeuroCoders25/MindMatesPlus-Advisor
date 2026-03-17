import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Users, 
  MessageSquare, 
  BookOpen, 
  BarChart3, 
  FileText, 
  StickyNote, 
  Settings,
  HeartPulse
} from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: AlertTriangle, label: 'Critical Cases', path: '/critical-cases' },
  { icon: Users, label: 'User Monitoring', path: '/monitoring' },
  { icon: MessageSquare, label: 'Chat Review', path: '/chat-review' },
  { icon: BookOpen, label: 'Journal Review', path: '/journal-review' },
  { icon: BarChart3, label: 'AI Insights', path: '/insights' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: StickyNote, label: 'Advisor Notes', path: '/notes' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-200">
          <HeartPulse size={24} />
        </div>
        <span className="font-bold text-xl tracking-tight text-slate-800">MindMates+</span>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
              isActive 
                ? "bg-brand-50 text-brand-600 font-medium" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
          >
            <item.icon size={20} className={cn(
              "transition-colors",
              "group-hover:text-brand-500"
            )} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Advisor</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 border-2 border-white shadow-sm flex items-center justify-center text-brand-600 font-bold">
              HV
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">Dr. Hiroshan</p>
              <p className="text-xs text-slate-500 truncate">Senior Psychologist</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
