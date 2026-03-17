import React, { useState } from 'react';
import { AlertTriangle, Filter, Search, PlusCircle } from 'lucide-react';
import CaseCard from '../components/CaseCard';
import NotesModal from '../components/NotesModal';
import { DUMMY_CASES } from '../constants';
import { motion } from 'motion/react';

export default function CriticalCases() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');

  const handleAddNote = (userName: string) => {
    setSelectedUser(userName);
    setIsModalOpen(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <AlertTriangle className="text-red-500" size={32} />
            Critical Cases
          </h1>
          <p className="text-slate-500 mt-1">AI-flagged high-risk users requiring immediate advisor review.</p>
        </div>
        <button className="px-6 py-3 bg-brand-500 text-white rounded-2xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-600 transition-all flex items-center gap-2 self-start">
          <PlusCircle size={20} />
          New Intervention
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Filter by name or case ID..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-brand-300 rounded-xl outline-none text-sm transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">
            <Filter size={16} />
            Risk Level
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors">
            Status
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DUMMY_CASES.map((c) => (
          <div key={c.id} onClick={() => handleAddNote(c.userName)}>
            <CaseCard caseData={c} />
          </div>
        ))}
      </div>

      <div className="bg-brand-50 rounded-3xl p-8 border border-brand-100 flex flex-col md:flex-row items-center gap-8">
        <div className="w-20 h-20 bg-brand-500 rounded-3xl flex items-center justify-center text-white shrink-0 shadow-xl shadow-brand-200">
          <AlertTriangle size={40} />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h3 className="text-xl font-bold text-slate-800 mb-2">Protocol Reminder</h3>
          <p className="text-slate-600 leading-relaxed">
            For all <span className="font-bold text-red-600">Critical</span> risk cases, advisors must initiate contact within 15 minutes of detection. Ensure all intervention steps are documented in the Advisor Notes section.
          </p>
        </div>
        <button className="px-8 py-3 bg-white text-brand-600 rounded-2xl font-bold border border-brand-200 hover:bg-brand-50 transition-all">
          View Protocol
        </button>
      </div>

      <NotesModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        userName={selectedUser} 
      />
    </motion.div>
  );
}
