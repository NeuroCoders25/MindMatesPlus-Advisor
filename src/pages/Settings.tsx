import { useState } from 'react';
import { Settings as SettingsIcon, Bell, Shield, Globe, Moon } from 'lucide-react';
import { motion } from 'motion/react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('Notifications');

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
        <p className="text-slate-500 mt-1">Manage your notification preferences and system configurations.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-4">
          <nav className="flex flex-col gap-1">
            {[
              { icon: Bell, label: 'Notifications' },
              { icon: Shield, label: 'Security & Privacy' },
              { icon: Globe, label: 'Language & Region' },
              { icon: Moon, label: 'Appearance' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveTab(item.label)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === item.label ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="md:col-span-2 space-y-8">
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
          
        </div>
      </div>
    </motion.div>
  );
}

