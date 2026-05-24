import { useState } from 'react';
import { 
  Settings as SettingsIcon, Bell, Shield, Globe, Moon,
  Lock, KeyRound, Check, RefreshCw, Eye, EyeOff, AlertCircle, CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';

// Reusable toggle switch component with smooth animations
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ring-offset-2 focus:ring-2 focus:ring-brand-500 ${
      checked ? 'bg-brand-500' : 'bg-slate-200'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

export default function Settings() {
  const [activeTab, setActiveTab] = useState('Notifications');

  // Notifications State
  const [notifications, setNotifications] = useState({
    riskAlerts: true,
    dailySummary: true,
    reviewReminders: false,
    mentions: true,
  });

  // Security & Privacy State
  const [security, setSecurity] = useState({
    twoFactor: false,
    sessionTimeout: '30m',
    loginAlerts: true,
    showOnlineStatus: true,
    shareDiagnostics: false,
  });

  // Password Update Form State
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordStatus, setPasswordStatus] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
  }>({ status: 'idle' });

  // Language & Region State
  const [locale, setLocale] = useState({
    language: 'en-US',
    timezone: 'EST',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '12h',
  });

  // Appearance State
  const [appearance, setAppearance] = useState({
    theme: 'light',
    sidebar: 'expanded',
    fontSize: 'medium',
    density: 'comfortable',
  });

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      setPasswordStatus({ status: 'error', message: 'All password fields are required.' });
      return;
    }
    if (passwords.new !== passwords.confirm) {
      setPasswordStatus({ status: 'error', message: 'New password and confirm password do not match.' });
      return;
    }
    if (passwords.new.length < 8) {
      setPasswordStatus({ status: 'error', message: 'New password must be at least 8 characters long.' });
      return;
    }

    setPasswordStatus({ status: 'loading' });

    // Simulate API call to save settings
    setTimeout(() => {
      setPasswordStatus({ status: 'success', message: 'Password updated successfully!' });
      setPasswords({ current: '', new: '', confirm: '' });
      
      // Clear toast after 3 seconds
      setTimeout(() => {
        setPasswordStatus({ status: 'idle' });
      }, 3000);
    }, 1500);
  };

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
        <p className="text-slate-500 mt-1">Manage your advisor account preferences and system configurations.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Side: Navigation Tabs */}
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
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === item.label 
                    ? 'bg-brand-50 text-brand-600' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Side: Tab Panel Content */}
        <div className="md:col-span-2 space-y-8">
          
          {/* Notifications Tab */}
          {activeTab === 'Notifications' && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-8 space-y-6"
            >
              <div>
                <h3 className="text-lg font-bold text-slate-800">Notification Preferences</h3>
                <p className="text-xs text-slate-500 mt-0.5">Control how you receive updates and alerts regarding system activity.</p>
              </div>
              <div className="space-y-4">
                {[
                  { 
                    id: 'riskAlerts', 
                    label: 'Critical Risk Alerts', 
                    desc: 'Instant notifications for users flagged as critical risk.',
                    checked: notifications.riskAlerts
                  },
                  { 
                    id: 'dailySummary', 
                    label: 'Daily Summary', 
                    desc: 'Receive a daily email digest of system health and cases.',
                    checked: notifications.dailySummary
                  },
                  { 
                    id: 'reviewReminders', 
                    label: 'Chat Review Reminders', 
                    desc: 'Get notified when flagged chats are pending review.',
                    checked: notifications.reviewReminders
                  },
                  { 
                    id: 'mentions', 
                    label: 'Advisor Mentions', 
                    desc: 'Notifications when other advisors mention you in notes.',
                    checked: notifications.mentions
                  },
                ].map(pref => (
                  <div key={pref.id} className="flex items-center justify-between p-4 bg-slate-50/70 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{pref.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{pref.desc}</p>
                    </div>
                    <Toggle 
                      checked={pref.checked} 
                      onChange={() => setNotifications({ ...notifications, [pref.id]: !pref.checked })} 
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Security & Privacy Tab */}
          {activeTab === 'Security & Privacy' && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Security Preferences */}
              <div className="glass-card p-8 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Security Settings</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Protect your account and control authentication requirements.</p>
                </div>
                
                <div className="space-y-4">
                  {/* 2FA */}
                  <div className="flex items-center justify-between p-4 bg-slate-50/70 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Two-Factor Authentication (2FA)</p>
                      <p className="text-xs text-slate-500 mt-0.5">Add an extra layer of security to your advisor account.</p>
                    </div>
                    <Toggle 
                      checked={security.twoFactor} 
                      onChange={() => setSecurity({ ...security, twoFactor: !security.twoFactor })} 
                    />
                  </div>

                  {/* Session Timeout */}
                  <div className="flex items-center justify-between p-4 bg-slate-50/70 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Auto Session Timeout</p>
                      <p className="text-xs text-slate-500 mt-0.5">Automatically log out after inactivity.</p>
                    </div>
                    <select
                      value={security.sessionTimeout}
                      onChange={(e) => setSecurity({ ...security, sessionTimeout: e.target.value })}
                      className="bg-white border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-2 outline-none focus:border-brand-500 transition-all font-semibold"
                    >
                      <option value="15m">15 Minutes</option>
                      <option value="30m">30 Minutes</option>
                      <option value="1h">1 Hour</option>
                      <option value="never">Never</option>
                    </select>
                  </div>

                  {/* Login Security Alerts */}
                  <div className="flex items-center justify-between p-4 bg-slate-50/70 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Login Security Alerts</p>
                      <p className="text-xs text-slate-500 mt-0.5">Receive warnings for unrecognized logins.</p>
                    </div>
                    <Toggle 
                      checked={security.loginAlerts} 
                      onChange={() => setSecurity({ ...security, loginAlerts: !security.loginAlerts })} 
                    />
                  </div>
                </div>
              </div>

              {/* Password Form */}
              <div className="glass-card p-8 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Update Password</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Change your password to ensure your account security.</p>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  {passwordStatus.status === 'success' && (
                    <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2 border border-emerald-100">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      {passwordStatus.message}
                    </div>
                  )}
                  
                  {passwordStatus.status === 'error' && (
                    <div className="p-4 bg-rose-50 text-rose-800 rounded-xl text-sm font-semibold flex items-center gap-2 border border-rose-100">
                      <AlertCircle size={16} className="text-rose-600 shrink-0" />
                      {passwordStatus.message}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Current Password</label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        value={passwords.current}
                        onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white transition-all text-slate-800 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">New Password</label>
                      <div className="relative">
                        <input
                          type={showPasswords.new ? 'text' : 'password'}
                          value={passwords.new}
                          onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                          placeholder="Min. 8 characters"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white transition-all text-slate-800 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? 'text' : 'password'}
                          value={passwords.confirm}
                          onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                          placeholder="Confirm new password"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white transition-all text-slate-800 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={passwordStatus.status === 'loading'}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-semibold hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                  >
                    {passwordStatus.status === 'loading' ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Updating...
                      </>
                    ) : 'Update Password'}
                  </button>
                </form>
              </div>

              {/* Privacy Settings */}
              <div className="glass-card p-8 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Privacy Preferences</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Control how your presence and activity data is stored and displayed.</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50/70 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Show Online Status</p>
                      <p className="text-xs text-slate-500 mt-0.5">Allow other advisors to see when you are active on the portal.</p>
                    </div>
                    <Toggle 
                      checked={security.showOnlineStatus} 
                      onChange={() => setSecurity({ ...security, showOnlineStatus: !security.showOnlineStatus })} 
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50/70 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Diagnostic Logs Sharing</p>
                      <p className="text-xs text-slate-500 mt-0.5">Help improve the portal by sharing anonymized error logs.</p>
                    </div>
                    <Toggle 
                      checked={security.shareDiagnostics} 
                      onChange={() => setSecurity({ ...security, shareDiagnostics: !security.shareDiagnostics })} 
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Language & Region Tab */}
          {activeTab === 'Language & Region' && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-8 space-y-6"
            >
              <div>
                <h3 className="text-lg font-bold text-slate-800">Language & Region</h3>
                <p className="text-xs text-slate-500 mt-0.5">Configure your localization preferences for dates, times, and language.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Language Select */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">System Language</label>
                  <select
                    value={locale.language}
                    onChange={(e) => setLocale({ ...locale, language: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 focus:bg-white transition-all font-semibold"
                  >
                    <option value="en-US">English (United States)</option>
                    <option value="en-GB">English (United Kingdom)</option>
                    <option value="es-ES">Español (España)</option>
                    <option value="fr-FR">Français (France)</option>
                    <option value="de-DE">Deutsch (Deutschland)</option>
                  </select>
                </div>

                {/* Time Zone Select */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">Time Zone</label>
                  <select
                    value={locale.timezone}
                    onChange={(e) => setLocale({ ...locale, timezone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 focus:bg-white transition-all font-semibold"
                  >
                    <option value="EST">Eastern Time (EST, UTC-5)</option>
                    <option value="PST">Pacific Time (PST, UTC-8)</option>
                    <option value="UTC">Coordinated Universal Time (UTC)</option>
                    <option value="GMT">Greenwich Mean Time (GMT, UTC+0)</option>
                    <option value="IST">India Standard Time (IST, UTC+5:30)</option>
                  </select>
                </div>

                {/* Date Format Select */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 block mb-1">Date Format</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD', preview: '2026-05-24' },
                      { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY', preview: '24/05/2026' },
                      { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY', preview: '05/24/2026' },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setLocale({ ...locale, dateFormat: fmt.id })}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          locale.dateFormat === fmt.id
                            ? 'border-brand-500 bg-brand-50/50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-700">{fmt.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{fmt.preview}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Format */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 block mb-1">Time Format</label>
                  <div className="flex gap-3">
                    {[
                      { id: '12h', label: '12-Hour Clock', preview: '8:01 PM' },
                      { id: '24h', label: '24-Hour Clock', preview: '20:01' },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setLocale({ ...locale, timeFormat: fmt.id })}
                        className={`flex-1 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          locale.timeFormat === fmt.id
                            ? 'border-brand-500 bg-brand-50/50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-700">{fmt.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{fmt.preview}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'Appearance' && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-8 space-y-6"
            >
              <div>
                <h3 className="text-lg font-bold text-slate-800">Appearance Settings</h3>
                <p className="text-xs text-slate-500 mt-0.5">Customize the interface appearance, sizing, and style preferences.</p>
              </div>

              <div className="space-y-6">
                {/* Theme Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">Color Theme</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'light', label: 'Light Mode', preview: 'bg-white border-slate-200', text: 'text-slate-800', bar: 'bg-slate-100 border-slate-200', box: 'bg-slate-200', card: 'bg-brand-100' },
                      { id: 'dark', label: 'Dark Mode', preview: 'bg-slate-900 border-slate-800', text: 'text-slate-100', bar: 'bg-slate-800 border-slate-700', box: 'bg-slate-700', card: 'bg-brand-900' },
                      { id: 'system', label: 'System Default', preview: 'bg-slate-50 border-slate-200', text: 'text-slate-800', bar: 'bg-slate-100 border-slate-200', box: 'bg-slate-200', card: 'bg-brand-100' }
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setAppearance({ ...appearance, theme: t.id })}
                        className={`relative text-left rounded-xl border-2 p-3 transition-all cursor-pointer ${
                          appearance.theme === t.id 
                            ? 'border-brand-500 ring-2 ring-brand-100 bg-brand-50/10' 
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        {t.id === 'system' ? (
                          <div className="h-16 rounded-lg border border-slate-100 mb-2 overflow-hidden flex">
                            <div className="w-1/2 bg-white border-r border-slate-200 flex flex-col">
                              <div className="h-3 bg-slate-100 border-b border-slate-200 px-1.5 flex items-center gap-0.5">
                                <div className="w-1 h-1 rounded-full bg-red-400" />
                                <div className="w-1 h-1 rounded-full bg-yellow-400" />
                              </div>
                              <div className="flex-1 p-1 space-y-0.5">
                                <div className="h-1 w-6 rounded bg-slate-200" />
                                <div className="h-2 w-8 rounded bg-brand-100" />
                              </div>
                            </div>
                            <div className="w-1/2 bg-slate-900 flex flex-col">
                              <div className="h-3 bg-slate-800 border-b border-slate-700 px-1.5 flex items-center gap-0.5 justify-end">
                                <div className="w-1 h-1 rounded-full bg-green-400" />
                              </div>
                              <div className="flex-1 p-1 space-y-0.5">
                                <div className="h-1 w-6 rounded bg-slate-700" />
                                <div className="h-2 w-8 rounded bg-brand-900" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className={`h-16 rounded-lg ${t.id === 'dark' ? 'bg-slate-900' : 'bg-slate-50'} border border-slate-100 mb-2 overflow-hidden flex flex-col`}>
                            {/* Mock Title Bar */}
                            <div className={`h-3 border-b px-1.5 flex items-center gap-1 ${t.bar}`}>
                              <div className="w-1 h-1 rounded-full bg-red-400" />
                              <div className="w-1 h-1 rounded-full bg-yellow-400" />
                              <div className="w-1 h-1 rounded-full bg-green-400" />
                            </div>
                            {/* Mock Content */}
                            <div className="flex-1 p-1.5 space-y-1">
                              <div className={`h-1.5 w-8 rounded ${t.box}`} />
                              <div className={`h-2.5 w-12 rounded ${t.card}`} />
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">{t.label}</span>
                          {appearance.theme === t.id && (
                            <Check size={14} className="text-brand-600 bg-brand-50 rounded-full p-0.5" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sidebar Style */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 block mb-1">Sidebar Layout</label>
                  <div className="flex gap-3">
                    {[
                      { id: 'expanded', label: 'Expanded Sidebar', desc: 'Standard side panel displaying labels alongside icons.' },
                      { id: 'compact', label: 'Compact Sidebar', desc: 'Icon-only sidebar layout to maximize workspace.' },
                    ].map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setAppearance({ ...appearance, sidebar: style.id })}
                        className={`flex-1 p-4 rounded-xl border text-left cursor-pointer transition-all ${
                          appearance.sidebar === style.id
                            ? 'border-brand-500 bg-brand-50/50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <p className="text-sm font-bold text-slate-800">{style.label}</p>
                        <p className="text-xs text-slate-500 mt-1">{style.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size Adjustment */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 block mb-1">Font Size</label>
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-xs font-semibold text-slate-500">A</span>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      {[
                        { id: 'small', label: 'Small' },
                        { id: 'medium', label: 'Medium' },
                        { id: 'large', label: 'Large' },
                      ].map((sz) => (
                        <button
                          key={sz.id}
                          type="button"
                          onClick={() => setAppearance({ ...appearance, fontSize: sz.id })}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            appearance.fontSize === sz.id
                              ? 'bg-white text-brand-600 shadow-sm border border-slate-200'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {sz.label}
                        </button>
                      ))}
                    </div>
                    <span className="text-lg font-semibold text-slate-800">A</span>
                  </div>
                </div>

                {/* Interface Density */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 block mb-1">Interface Density</label>
                  <div className="flex gap-3">
                    {[
                      { id: 'comfortable', label: 'Comfortable', desc: 'Standard padding and spacing layout.' },
                      { id: 'compact', label: 'Compact', desc: 'Saves space by using tighter grid margins.' },
                    ].map((den) => (
                      <button
                        key={den.id}
                        type="button"
                        onClick={() => setAppearance({ ...appearance, density: den.id })}
                        className={`flex-1 p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          appearance.density === den.id
                            ? 'border-brand-500 bg-brand-50/50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <p className="text-sm font-bold text-slate-800">{den.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{den.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </motion.div>
  );
}


