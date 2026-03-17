import React from 'react';
import { X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
}

export default function NotesModal({ isOpen, onClose, userName }: NotesModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Add Advisor Note</h3>
                <p className="text-sm text-slate-500">For user: <span className="font-semibold text-brand-600">{userName}</span></p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Category</label>
                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50 transition-all">
                  <option>General Observation</option>
                  <option>Clinical Assessment</option>
                  <option>Intervention Record</option>
                  <option>Follow-up Required</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Note Content</label>
                <textarea 
                  rows={5}
                  placeholder="Enter detailed observations or intervention steps..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50 transition-all resize-none"
                ></textarea>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <p className="text-[10px] text-amber-700 font-medium">This note will be visible to other advisors but not to the user.</p>
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 flex items-center justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button className="px-6 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-200 hover:bg-brand-600 transition-all flex items-center gap-2">
                <Save size={18} />
                Save Note
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
