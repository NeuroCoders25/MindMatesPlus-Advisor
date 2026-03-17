import React from 'react';
import { StickyNote, Search, Plus, Filter, Clock, User } from 'lucide-react';
import { DUMMY_NOTES, DUMMY_USERS } from '../constants';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function AdvisorNotes() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <StickyNote className="text-brand-500" size={32} />
            Advisor Notes
          </h1>
          <p className="text-slate-500 mt-1">Internal documentation and logs of user interactions and interventions.</p>
        </div>
        <button className="px-6 py-3 bg-brand-500 text-white rounded-2xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-600 transition-all flex items-center gap-2 self-start">
          <Plus size={20} />
          Add New Note
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search notes by content or user..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-brand-300 rounded-xl outline-none text-sm transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">
            <Filter size={16} />
            Category
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">
            Advisor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {DUMMY_NOTES.map((note) => {
          const user = DUMMY_USERS.find(u => u.id === note.userId);
          return (
            <div key={note.id} className="glass-card p-6 border-l-4 border-l-brand-500">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                    <User size={16} />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">{user?.name}</h5>
                    <p className="text-[10px] text-slate-400">User ID: {note.userId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                    note.category === 'Intervention' ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
                  )}>
                    {note.category}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock size={12} />
                    <span>{new Date(note.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-2xl p-4 mb-4">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {note.content}
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-600">
                    HV
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">Logged by Dr. Hiroshan</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-xs font-bold text-slate-400 hover:text-brand-600 transition-colors">Edit</button>
                  <span className="text-slate-200">|</span>
                  <button className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
