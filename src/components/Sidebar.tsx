import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  MessageSquare,
  BookOpen,
  BarChart3,
  FileText,
  Settings,
  Library,
  Video,
  MessagesSquare,
  HeadphonesIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: AlertTriangle, label: 'Critical Cases', path: '/critical-cases' },
  { icon: HeadphonesIcon, label: 'Listener Requests', path: '/listener-requests' },
  { icon: Users, label: 'User Monitoring', path: '/monitoring' },
  { icon: MessageSquare, label: 'Chat Monitoring', path: '/chat-review' },
  { icon: Video, label: 'Group Calls', path: '/calls' },
  { icon: BookOpen, label: 'Journal Review', path: '/journal-review' },
  { icon: Library, label: 'Resources', path: '/resources' },
  { icon: BarChart3, label: 'AI Insights', path: '/insights' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: MessageSquare, label: 'Admin Chats', path: '/chat' },
  { icon: MessagesSquare,  label: 'Advisor Room',   path: '/advisor-room' },
  { icon: HeadphonesIcon, label: 'System Support',  path: '/support' },
  { icon: Settings,       label: 'Settings',        path: '/settings' },
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
  const { advisorProfile } = useAuth();

  const name = advisorProfile?.name ?? 'Advisor';
  const role = advisorProfile?.role ?? '';
  const initials = getInitials(name);
  const profileImageUrl = advisorProfile?.profileImageUrl;

  return (
    <aside className="w-64 h-screen bg-[#0f1535] border-r border-[#1e2650] flex flex-col sticky top-0">
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
                ? "bg-[#1e2a52] text-brand-400 font-medium"
                : "text-white/60 hover:bg-white/8 hover:text-white"
            )}
          >
            <item.icon size={20} className="transition-colors" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `block rounded-2xl p-4 transition-all duration-200 ${isActive ? 'bg-[#253060]' : 'bg-[#1a2448] hover:bg-[#1e2a52]'}`
          }
        >
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 text-center">Advisor Mode</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm shrink-0 overflow-hidden">
              {profileImageUrl ? (
                <img src={profileImageUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm">
                  {initials}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{name}</p>
              {role && <p className="text-xs text-white/70 truncate">{role}</p>}
            </div>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
