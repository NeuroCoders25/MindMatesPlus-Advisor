import React from 'react';
import { BarChart3, TrendingUp, Brain, Zap, Info } from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis,
  Tooltip
} from 'recharts';
import { motion } from 'motion/react';

const radarData = [
  { subject: 'Anxiety', A: 120, B: 110, fullMark: 150 },
  { subject: 'Depression', A: 98, B: 130, fullMark: 150 },
  { subject: 'Stress', A: 86, B: 130, fullMark: 150 },
  { subject: 'Loneliness', A: 99, B: 100, fullMark: 150 },
  { subject: 'Anger', A: 85, B: 90, fullMark: 150 },
  { subject: 'Hope', A: 65, B: 85, fullMark: 150 },
];

const pieData = [
  { name: 'Positive', value: 400, color: '#10b981' },
  { name: 'Neutral', value: 300, color: '#94a3b8' },
  { name: 'Negative', value: 300, color: '#f59e0b' },
  { name: 'Risky', value: 100, color: '#ef4444' },
];

export default function AIInsights() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Brain className="text-brand-500" size={32} />
          AI Insights
        </h1>
        <p className="text-slate-500 mt-1">Deep dive into emotional intelligence data and predictive risk modeling.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-bold text-slate-800">Emotional Profile</h3>
              <p className="text-xs text-slate-400">Comparison of current week vs. previous week</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-brand-500"></div>
                <span className="text-xs font-medium text-slate-500">Current</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                <span className="text-xs font-medium text-slate-500">Previous</span>
              </div>
            </div>
          </div>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} />
                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                <Radar name="Current" dataKey="B" stroke="#3354ff" fill="#3354ff" fillOpacity={0.4} />
                <Radar name="Previous" dataKey="A" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-8">
          <h3 className="font-bold text-slate-800 mb-2">Sentiment Distribution</h3>
          <p className="text-xs text-slate-400 mb-8">Overall emotional tone of all platform interactions</p>
          
          <div className="h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-3xl font-bold text-slate-800">1.1k</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Events</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-xs font-semibold text-slate-600">{item.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-800">{((item.value / 1100) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="glass-card p-6 bg-brand-500 text-white border-none">
          <Zap size={24} className="mb-4" />
          <h4 className="font-bold text-lg mb-2">Predictive Alert</h4>
          <p className="text-brand-100 text-sm leading-relaxed">
            AI models suggest a <span className="text-white font-bold">22% increase</span> in depression indicators over the next 48 hours based on current social isolation patterns.
          </p>
        </div>
        
        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={20} className="text-emerald-500" />
              <h4 className="font-bold text-slate-800">Wellness Growth</h4>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              Peer support engagement is up by 15%, showing a strong correlation with reduced anxiety scores.
            </p>
          </div>
          <button className="text-brand-600 text-xs font-bold mt-4 flex items-center gap-1 hover:underline">
            View Correlation Study
          </button>
        </div>

        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Info size={20} className="text-brand-500" />
              <h4 className="font-bold text-slate-800">Model Accuracy</h4>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              Current sentiment detection accuracy is at 94.2% based on advisor feedback loops.
            </p>
          </div>
          <button className="text-brand-600 text-xs font-bold mt-4 flex items-center gap-1 hover:underline">
            Improve Model
          </button>
        </div>
      </div>
    </motion.div>
  );
}
