import React, { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Search, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscribeAlertCount } from './FlaggedMessageAlert';

export default function Navbar() {
  const [alertCount, setAlertCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => subscribeAlertCount(setAlertCount), []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    setDropdownOpen(false);
    await logout();
    navigate('/login');
  }

  return (
    <header className="h-16 bg-[#0f1535] border-b border-[#1e2650] flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input
            type="text"
            placeholder="Search users, groups, or reports..."
            className="w-full pl-10 pr-4 py-2 bg-[#1e2650] border border-[#2a3460] placeholder-white/40 text-white/80 focus:bg-[#242d5a] focus:border-brand-500 rounded-xl outline-none text-sm transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-white/60 hover:bg-white/10 rounded-xl transition-colors relative">
          <Bell size={20} />
          {alertCount > 0 ? (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-white px-0.5">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          ) : (
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          )}
        </button>
        <div className="h-8 w-[1px] bg-white/15 mx-2"></div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-3 cursor-pointer hover:bg-white/10 p-1 pr-3 rounded-xl transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60">
              <User size={18} />
            </div>
            <span className="text-sm font-medium text-white/80">Advisor Portal</span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
