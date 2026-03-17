import React, { useState } from 'react';
import { MessageSquare, Search, Flag, CheckCircle, ChevronRight } from 'lucide-react';
import ChatViewer from '../components/ChatViewer';
import { DUMMY_MESSAGES, DUMMY_USERS } from '../constants';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function ChatReview() {
  const [selectedChat, setSelectedChat] = useState(DUMMY_USERS[3]); // Emma Wilson

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 h-[calc(100vh-120px)]"
    >
      <header>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <MessageSquare className="text-brand-500" size={32} />
          Chat Review
        </h1>
        <p className="text-slate-500 mt-1">Review AI-flagged conversations for potential distress or self-harm indicators.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        <div className="lg:col-span-1 glass-card flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search flagged chats..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-brand-300 rounded-xl outline-none text-xs transition-all"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {DUMMY_USERS.map((user) => (
              <div 
                key={user.id}
                onClick={() => setSelectedChat(user)}
                className={cn(
                  "p-4 border-b border-slate-50 cursor-pointer transition-all flex items-center justify-between group",
                  selectedChat.id === user.id ? "bg-brand-50" : "hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">{user.name}</h5>
                    <p className="text-[10px] text-slate-400">Flagged 2h ago</p>
                  </div>
                </div>
                {user.riskLevel === 'Critical' && (
                  <Flag size={14} className="text-red-500 fill-red-500" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-card p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xl">
                {selectedChat.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">{selectedChat.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">User ID: {selectedChat.id}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className="text-xs font-bold text-red-500 uppercase tracking-widest">{selectedChat.riskLevel} Risk</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">
                View Profile
              </button>
              <button className="px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-200 hover:bg-brand-600 transition-all">
                Intervene
              </button>
            </div>
          </div>

          <div className="flex-1 glass-card p-6 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-slate-800">Conversation Transcript</h4>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400"></div> Risky</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Positive</span>
              </div>
            </div>
            
            <ChatViewer messages={DUMMY_MESSAGES} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
