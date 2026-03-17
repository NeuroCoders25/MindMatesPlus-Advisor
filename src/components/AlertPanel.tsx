import React from 'react';
import { Alert } from '../types';
import { AlertCircle, Clock, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface AlertPanelProps {
  alerts: Alert[];
}

export default function AlertPanel({ alerts }: AlertPanelProps) {
  return (
    <div className="glass-card flex flex-col h-full">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <AlertCircle size={20} className="text-red-500" />
          Recent Alerts
        </h3>
        <span className="text-xs font-bold bg-red-50 text-red-600 px-2 py-1 rounded-lg">
          {alerts.length} New
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {alerts.map((alert) => (
          <div 
            key={alert.id} 
            className={cn(
              "p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-sm",
              alert.severity === 'Critical' ? "bg-red-50 border-red-100" : "bg-white border-slate-100"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">{alert.userName}</span>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock size={10} />
                <span>{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 line-clamp-2 mb-3">{alert.message}</p>
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider",
                alert.severity === 'Critical' ? "bg-red-200 text-red-900" : "bg-amber-100 text-amber-700"
              )}>
                {alert.severity}
              </span>
              <button className="text-brand-600 text-[10px] font-bold flex items-center gap-1 hover:underline">
                Review <ArrowRight size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t border-slate-100">
        <button className="w-full py-2 text-sm font-semibold text-slate-500 hover:text-brand-600 transition-colors">
          View All Alerts
        </button>
      </div>
    </div>
  );
}
