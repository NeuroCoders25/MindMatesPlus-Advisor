import React from 'react';
import { BookOpen, Search, Calendar, Smile, Meh, Frown } from 'lucide-react';
import { DUMMY_JOURNALS, DUMMY_USERS } from '../constants';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function JournalReview() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <BookOpen className="text-brand-500" size={32} />
          Journal Review
        </h1>
        <p className="text-slate-500 mt-1">Monitor user journal entries analyzed for sentiment and emotional triggers.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by keywords or user..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-brand-300 rounded-xl outline-none text-sm transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">
            <Calendar size={16} />
            Date Range
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">
            Sentiment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {DUMMY_JOURNALS.map((journal) => {
          const user = DUMMY_USERS.find(u => u.id === journal.userId);
          return (
            <div key={journal.id} className="glass-card p-6 flex flex-col md:flex-row gap-6">
              <div className="md:w-64 shrink-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                    {user?.name.charAt(0)}
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">{user?.name}</h5>
                    <p className="text-[10px] text-slate-400">{journal.date}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">AI Sentiment</p>
                    <div className="flex items-center gap-2">
                      {journal.sentiment < -0.5 ? <Frown className="text-red-500" size={18} /> : 
                       journal.sentiment < 0 ? <Meh className="text-amber-500" size={18} /> : 
                       <Smile className="text-emerald-500" size={18} />}
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full",
                            journal.sentiment < -0.5 ? "bg-red-500" : journal.sentiment < 0 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.abs(journal.sentiment) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-slate-600">{(journal.sentiment * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {journal.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-brand-50 text-brand-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex-1">
                <div className="bg-slate-50 rounded-2xl p-6 relative">
                  <div className="absolute top-4 right-4 text-slate-200">
                    <BookOpen size={48} />
                  </div>
                  <p className="text-slate-700 leading-relaxed italic relative z-10">
                    "{journal.content}"
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-end gap-3">
                  <button className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Flag for Follow-up</button>
                  <button className="px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-bold hover:bg-brand-600 transition-all">Add Note</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
