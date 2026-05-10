import React, { useEffect, useRef } from 'react';
import { LiveChatMessage } from '../types';
import { cn } from '../lib/utils';
import { AlertTriangle } from 'lucide-react';

interface ChatViewerProps {
  messages: LiveChatMessage[];
  currentUserId?: string;
}

function formatTime(timestamp: Date | null): string {
  if (!timestamp) return '';
  return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatViewer({ messages, currentUserId }: ChatViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100 min-h-0">
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          No messages yet.
        </div>
      )}

      {messages.map((msg) => {
        const isSelf = currentUserId && msg.senderId === currentUserId;

        return (
          <div
            key={msg.id}
            className={cn(
              'flex flex-col max-w-[80%]',
              isSelf ? 'self-end items-end' : 'self-start items-start',
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {msg.isFlagged && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md">
                  <AlertTriangle size={9} />
                  Flagged
                </span>
              )}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {msg.senderName}
              </span>
              <span className="text-[10px] text-slate-300">{formatTime(msg.timestamp)}</span>
            </div>

            <div
              className={cn(
                'px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
                msg.isFlagged
                  ? 'bg-red-50 border border-red-300 text-red-900'
                  : isSelf
                    ? 'bg-brand-500 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none',
              )}
            >
              {msg.text}
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
