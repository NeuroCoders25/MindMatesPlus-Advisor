import React from 'react';
import { User } from '../types';
import RiskBadge from './RiskBadge';
import { MoreVertical, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';

interface UserTableProps {
  users: User[];
}

export default function UserTable({ users }: UserTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider">
            <th className="px-6 py-4 font-semibold">User</th>
            <th className="px-6 py-4 font-semibold">Risk Level</th>
            <th className="px-6 py-4 font-semibold">Status</th>
            <th className="px-6 py-4 font-semibold">Last Activity</th>
            <th className="px-6 py-4 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-medium border border-slate-200">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-400">ID: {user.id}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <RiskBadge level={user.riskLevel} />
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    user.status === 'Active' ? 'bg-emerald-500' : 
                    user.status === 'Monitoring' ? 'bg-amber-500' : 'bg-slate-300'
                  )}></span>
                  <span className="text-sm text-slate-600">{user.status}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-slate-500">
                {user.lastActivity}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
                    <ExternalLink size={18} />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                    <MoreVertical size={18} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
