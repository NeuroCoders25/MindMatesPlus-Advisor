import React from 'react';
import { ChatMessage } from '../types';
import { cn } from '../lib/utils';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ChatViewerProps {
  messages: ChatMessage[];
}

export default function ChatViewer({ messages }: ChatViewerProps) {
  return (
    <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
      {messages.map((msg) => (
        <div 
          key={msg.id} 
          className={cn(
            "flex flex-col max-w-[80%]",
            msg.sender === 'User' ? "self-end items-end" : "self-start items-start"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{msg.sender}</span>
            <span className="text-[10px] text-slate-300">{msg.timestamp}</span>
          </div>
          
          <div className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
            msg.sender === 'User' 
              ? "bg-brand-500 text-white rounded-tr-none" 
              : "bg-white text-slate-800 border border-slate-200 rounded-tl-none",
            msg.isFlagged && "ring-2 ring-red-400 ring-offset-2"
          )}>
            {msg.text}
          </div>
          
          {msg.isFlagged && (
            <div className="flex items-center gap-1 mt-1 text-red-500 font-bold text-[10px] uppercase tracking-wider">
              <AlertTriangle size={10} />
              AI Flagged: {msg.sentiment}
            </div>
          )}
        </div>
      ))}
      
      <div className="mt-4 pt-4 border-t border-slate-200 flex justify-center">
        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors">
          <CheckCircle2 size={14} />
          Mark Conversation as Reviewed
        </button>
      </div>
    </div>
  );
}
