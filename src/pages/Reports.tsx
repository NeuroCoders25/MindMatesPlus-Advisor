import React from 'react';
import { FileText, Download, Calendar, Filter, FileSpreadsheet, FileJson } from 'lucide-react';
import { motion } from 'motion/react';

const reports = [
  { id: 'R1', name: 'Weekly System Health Summary', date: 'Mar 17, 2026', type: 'PDF', size: '2.4 MB' },
  { id: 'R2', name: 'High-Risk User Intervention Log', date: 'Mar 16, 2026', type: 'Excel', size: '1.1 MB' },
  { id: 'R3', name: 'AI Sentiment Accuracy Report', date: 'Mar 15, 2026', type: 'PDF', size: '3.8 MB' },
  { id: 'R4', name: 'Monthly Peer Support Analytics', date: 'Mar 01, 2026', type: 'PDF', size: '12.5 MB' },
  { id: 'R5', name: 'Crisis Response Time Audit', date: 'Feb 28, 2026', type: 'JSON', size: '0.5 MB' },
];

export default function Reports() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <FileText className="text-brand-500" size={32} />
            Reports & Analytics
          </h1>
          <p className="text-slate-500 mt-1">Generate and download detailed reports for clinical review and auditing.</p>
        </div>
        <button className="px-6 py-3 bg-brand-500 text-white rounded-2xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-600 transition-all flex items-center gap-2 self-start">
          <Calendar size={20} />
          Generate New Report
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="glass-card p-6">
            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Filter size={18} className="text-brand-500" />
              Filter Reports
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Category</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none">
                  <option>All Categories</option>
                  <option>Clinical</option>
                  <option>System Performance</option>
                  <option>User Analytics</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Timeframe</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none">
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                  <option>Custom Range</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Format</label>
                <div className="flex flex-wrap gap-2">
                  {['PDF', 'Excel', 'JSON', 'CSV'].map(f => (
                    <button key={f} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-brand-50 hover:text-brand-600 transition-colors">
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="glass-card p-6 bg-slate-900 text-white border-none">
            <h4 className="font-bold mb-2">Auto-Reporting</h4>
            <p className="text-slate-400 text-xs leading-relaxed mb-4">
              Weekly summaries are automatically generated every Monday at 8:00 AM.
            </p>
            <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors">
              Configure Schedule
            </button>
          </div>
        </div>

        <div className="md:col-span-3 space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="glass-card p-4 flex items-center justify-between hover:shadow-md transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-brand-50 transition-colors">
                  {report.type === 'PDF' ? <FileText className="text-red-500" size={24} /> : 
                   report.type === 'Excel' ? <FileSpreadsheet className="text-emerald-500" size={24} /> : 
                   <FileJson className="text-amber-500" size={24} />}
                </div>
                <div>
                  <h5 className="font-bold text-slate-800 group-hover:text-brand-600 transition-colors">{report.name}</h5>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>{report.date}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span>{report.size}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="font-bold text-slate-500">{report.type}</span>
                  </div>
                </div>
              </div>
              <button className="p-3 bg-slate-50 text-slate-400 hover:bg-brand-50 hover:text-brand-600 rounded-xl transition-all">
                <Download size={20} />
              </button>
            </div>
          ))}
          
          <div className="flex justify-center pt-4">
            <button className="text-sm font-bold text-slate-400 hover:text-brand-600 transition-colors">Load More Reports</button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
