import React from 'react';
import { Settings as SettingsIcon, Bell, Shield, User, Globe, Moon, Save } from 'lucide-react';
import { motion } from 'motion/react';

export default function Settings() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-4xl"
    >
      <header>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <SettingsIcon className="text-brand-500" size={32} />
          Settings
        </h1>
        <p className="text-slate-500 mt-1">Manage your advisor profile, notification preferences, and system configurations.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-4">
          <nav className="flex flex-col gap-1">
            {[
              { icon: User, label: 'Profile Settings' },
              { icon: Bell, label: 'Notifications' },
              { icon: Shield, label: 'Security & Privacy' },
              { icon: Globe, label: 'Language & Region' },
              { icon: Moon, label: 'Appearance' },
            ].map((item, idx) => (
              <button 
                key={item.label}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${idx === 0 ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="md:col-span-2 space-y-8">
          <div className="glass-card p-8">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Advisor Profile</h3>
            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-brand-100 flex items-center justify-center text-brand-600 text-3xl font-bold border-4 border-white shadow-lg">
                  HV
                </div>
                <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">
                  Change Photo
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                  <input type="text" defaultValue="Dr. Hiroshan Victor" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Title</label>
                  <input type="text" defaultValue="Senior Psychologist" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50 transition-all" />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                <input type="email" defaultValue="hiroshanvictor@gmail.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50 transition-all" />
              </div>
            </div>
          </div>

          <div className="glass-card p-8">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Notification Preferences</h3>
            <div className="space-y-4">
              {[
                { label: 'Critical Risk Alerts', desc: 'Instant notifications for users flagged as critical risk.', default: true },
                { label: 'Daily Summary', desc: 'Receive a daily email digest of system health and cases.', default: true },
                { label: 'Chat Review Reminders', desc: 'Get notified when flagged chats are pending review.', default: false },
                { label: 'Advisor Mentions', desc: 'Notifications when other advisors mention you in notes.', default: true },
              ].map(pref => (
                <div key={pref.label} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{pref.label}</p>
                    <p className="text-xs text-slate-500">{pref.desc}</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all ${pref.default ? 'bg-brand-500' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-all ${pref.default ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-3">
            <button className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">Discard Changes</button>
            <button className="px-8 py-3 bg-brand-500 text-white rounded-2xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-600 transition-all flex items-center gap-2">
              <Save size={20} />
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
