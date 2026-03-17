import React from 'react';
import { Bell, Search, User } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search users, cases, or notes..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-brand-300 focus:ring-4 focus:ring-brand-50 rounded-xl transition-all outline-none text-sm"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
        <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1 pr-3 rounded-xl transition-colors">
          <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600">
            <User size={18} />
          </div>
          <span className="text-sm font-medium text-slate-700">Advisor Portal</span>
        </div>
      </div>
    </header>
  );
}
