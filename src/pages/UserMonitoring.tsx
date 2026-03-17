import React from 'react';
import { Users, Search, Download, Filter } from 'lucide-react';
import UserTable from '../components/UserTable';
import { DUMMY_USERS } from '../constants';
import { motion } from 'motion/react';

export default function UserMonitoring() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Users className="text-brand-500" size={32} />
            User Monitoring
          </h1>
          <p className="text-slate-500 mt-1">Real-time overview of all users and their AI-calculated risk scores.</p>
        </div>
        <button className="px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2 self-start shadow-sm">
          <Download size={20} />
          Export Data
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border-b-4 border-b-emerald-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Low Risk</p>
          <h4 className="text-3xl font-bold text-slate-800">1,248</h4>
          <p className="text-xs text-slate-500 mt-2">84% of total users</p>
        </div>
        <div className="glass-card p-6 border-b-4 border-b-amber-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Medium Risk</p>
          <h4 className="text-3xl font-bold text-slate-800">184</h4>
          <p className="text-xs text-slate-500 mt-2">12% of total users</p>
        </div>
        <div className="glass-card p-6 border-b-4 border-b-red-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">High/Critical</p>
          <h4 className="text-3xl font-bold text-slate-800">52</h4>
          <p className="text-xs text-slate-500 mt-2">4% of total users</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name, ID, or email..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-brand-300 rounded-xl outline-none text-sm transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">
              <Filter size={16} />
              Filters
            </button>
            <select className="bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold px-4 py-2 outline-none border-none">
              <option>Sort by: Risk Level</option>
              <option>Sort by: Last Activity</option>
              <option>Sort by: Name</option>
            </select>
          </div>
        </div>
        <UserTable users={DUMMY_USERS} />
        <div className="p-6 border-t border-slate-100 flex items-center justify-between">
          <p className="text-sm text-slate-500">Showing 5 of 1,484 users</p>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold disabled:opacity-50" disabled>Previous</button>
            <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50">Next</button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
