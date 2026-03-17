import React from 'react';
import { 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp,
  Activity
} from 'lucide-react';
import DashboardCard from '../components/DashboardCard';
import AlertPanel from '../components/AlertPanel';
import UserTable from '../components/UserTable';
import { DUMMY_USERS, DUMMY_ALERTS } from '../constants';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion } from 'motion/react';

const trendData = [
  { name: 'Mon', distress: 4, wellness: 7 },
  { name: 'Tue', distress: 3, wellness: 8 },
  { name: 'Wed', distress: 7, wellness: 5 },
  { name: 'Thu', distress: 5, wellness: 6 },
  { name: 'Fri', distress: 8, wellness: 4 },
  { name: 'Sat', distress: 2, wellness: 9 },
  { name: 'Sun', distress: 1, wellness: 10 },
];

const emotionData = [
  { name: 'Anxiety', value: 45, color: '#f59e0b' },
  { name: 'Depression', value: 30, color: '#6366f1' },
  { name: 'Stress', value: 60, color: '#ef4444' },
  { name: 'Loneliness', value: 25, color: '#8b5cf6' },
  { name: 'Anger', value: 15, color: '#ec4899' },
];

export default function Dashboard() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold text-slate-800">Advisor Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back, Dr. Hiroshan. Here's an overview of system health.</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard 
          title="High-Risk Users" 
          value="12" 
          icon={Users} 
          trend={{ value: 8, isUp: true }}
          color="red"
        />
        <DashboardCard 
          title="Active Alerts" 
          value="24" 
          icon={AlertCircle} 
          trend={{ value: 12, isUp: false }}
          color="amber"
        />
        <DashboardCard 
          title="Cases Today" 
          value="08" 
          icon={Activity} 
          trend={{ value: 2, isUp: true }}
          color="brand"
        />
        <DashboardCard 
          title="Interventions" 
          value="42" 
          icon={CheckCircle2} 
          trend={{ value: 15, isUp: true }}
          color="emerald"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-bold text-slate-800">Emotional Trends</h3>
                <p className="text-xs text-slate-400">System-wide distress vs. wellness indicators</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-brand-500"></div>
                  <span className="text-xs font-medium text-slate-500">Wellness</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <span className="text-xs font-medium text-slate-500">Distress</span>
                </div>
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorWellness" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3354ff" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3354ff" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDistress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="wellness" stroke="#3354ff" strokeWidth={3} fillOpacity={1} fill="url(#colorWellness)" />
                  <Area type="monotone" dataKey="distress" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDistress)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Users Requiring Attention</h3>
              <button className="text-sm font-semibold text-brand-600 hover:underline">View All</button>
            </div>
            <UserTable users={DUMMY_USERS.slice(0, 4)} />
          </div>
        </div>
        
        <div className="space-y-8">
          <AlertPanel alerts={DUMMY_ALERTS} />
          
          <div className="glass-card p-6">
            <h3 className="font-bold text-slate-800 mb-6">AI Distress Analysis</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={emotionData} layout="vertical" margin={{ left: -20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                    {emotionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-emerald-500" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Insight</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Stress indicators have increased by <span className="font-bold text-red-500">14%</span> this week, primarily linked to academic deadlines detected in journal entries.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
