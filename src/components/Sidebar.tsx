import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  LogOut,
  ChevronUp
} from 'lucide-react';
import { cn } from '../lib/utils';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: AlertTriangle, label: 'Critical Cases', path: '/critical-cases' },
  { icon: Users, label: 'User Monitoring', path: '/monitoring' },
  { icon: MessageSquare, label: 'Chat Monitoring', path: '/chat-review' },
  { icon: BookOpen, label: 'Journal Review', path: '/journal-review' },
  { icon: BarChart3, label: 'AI Insights', path: '/insights' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: StickyNote, label: 'Advisor Notes', path: '/notes' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

export default function Sidebar() {
  const { advisorProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const name = advisorProfile?.name ?? 'Advisor';
  const role = advisorProfile?.role ?? '';
  const initials = getInitials(name);

  async function handleSignOut() {
    await logout();
    navigate('/login');
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <aside className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col sticky top-0">
      <div className="p-12 flex items-center gap-3">
        <div className="flex items-center space-x-2">
          <img src={logo} alt="MindMates" className="h-15 object-contain" />
        </div>
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
            <item.icon size={20} className={cn("transition-colors", "group-hover:text-brand-500")} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100" ref={menuRef}>
        {menuOpen && (
          <div className="mb-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full text-left bg-slate-50 hover:bg-slate-100 rounded-2xl p-4 transition-colors"
        >
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Advisor</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 border-2 border-white shadow-sm flex items-center justify-center text-brand-600 font-bold text-sm flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
              {role && <p className="text-xs text-slate-500 truncate">{role}</p>}
            </div>
            <ChevronUp
              size={16}
              className={cn(
                'text-slate-400 transition-transform flex-shrink-0',
                menuOpen ? 'rotate-180' : 'rotate-0'
              )}
            />
          </div>
        </button>
      </div>
    </aside>
  );
}
