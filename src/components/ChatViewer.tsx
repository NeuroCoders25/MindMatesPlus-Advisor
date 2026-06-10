import React, { useEffect, useRef, useState } from 'react';
import { LiveChatMessage } from '../types';
import { cn } from '../lib/utils';
import { safeText } from '../services/cryptoService';
import { AlertTriangle, CheckCircle, CornerUpLeft, FileText, Trash2, XCircle } from 'lucide-react';
import QuotedMessage from './QuotedMessage';

interface ChatViewerProps {
  messages: LiveChatMessage[];
  currentUserId?: string;
  selectedFlaggedMsgId?: string;
  onFlaggedMessageClick?: (msg: LiveChatMessage) => void;
  onDeleteMessage?: (msg: LiveChatMessage) => void;
  onReply?: (msg: LiveChatMessage) => void;
}

function formatTime(timestamp: Date | null): string {
  if (!timestamp) return '';
  return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatViewer({
  messages,
  currentUserId,
  selectedFlaggedMsgId,
  onFlaggedMessageClick,
  onDeleteMessage,
  onReply,
}: ChatViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const scrollToMessage = (id: string) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(id);
    setTimeout(() => setHighlightedId(null), 1500);
  };

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100 min-h-0">
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          No messages yet.
        </div>
      )}

      {messages.map((msg) => {
        const isSelf = currentUserId && msg.senderId === currentUserId;
        const isSelected = selectedFlaggedMsgId === msg.id;
        const isDeleted = Boolean(msg.deletedByAdvisor);
        const effectiveStatus = msg.reviewStatus ?? (msg.advisorApproved ? 'approved' : 'pending');
        const isApproved = msg.isFlagged && effectiveStatus === 'approved';
        const isHighlighted = highlightedId === msg.id;

        return (
          <div
            id={`msg-${msg.id}`}
            key={msg.id}
            className={cn(
              'group flex flex-col max-w-[80%] transition-all',
              isSelf ? 'self-end items-end' : 'self-start items-start',
              !isDeleted && msg.isFlagged && onFlaggedMessageClick && 'cursor-pointer',
              isSelected && 'ring-2 ring-brand-400 ring-offset-2 rounded-2xl',
              isHighlighted && 'ring-2 ring-indigo-400 ring-offset-2 rounded-2xl'
            )}
            onClick={() => !isDeleted && msg.isFlagged && onFlaggedMessageClick?.(msg)}
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {!isDeleted && msg.isFlagged && !isApproved && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md">
                  <AlertTriangle size={9} />
                  Flagged
                </span>
              )}
              {!isDeleted && (msg.reviewStatus === 'approved' || (!msg.reviewStatus && msg.advisorApproved)) && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                  <CheckCircle size={9} />
                  Approved
                </span>
              )}
              {!isDeleted && msg.reviewStatus === 'rejected' && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md">
                  <XCircle size={9} />
                  Removed
                </span>
              )}
              {!isDeleted && msg.advisorNote && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded-md">
                  <FileText size={9} />
                  Note
                </span>
              )}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {msg.senderName}
              </span>
              <span className="text-[10px] text-slate-300">{formatTime(msg.timestamp)}</span>

              {/* Reply button — hover-reveal */}
              {onReply && !isDeleted && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReply(msg);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-300 hover:text-indigo-500 rounded"
                  title="Reply"
                >
                  <CornerUpLeft size={11} />
                </button>
              )}

              {/* Delete button — hover-reveal */}
              {onDeleteMessage && !isDeleted && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteMessage(msg);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-300 hover:text-red-500 rounded"
                  title="Delete message"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>

            {isDeleted ? (
              <div className="px-4 py-2.5 rounded-2xl text-xs italic text-slate-400 bg-slate-100 border border-dashed border-slate-200 flex items-center gap-1.5 select-none">
                🗑 This message was deleted by the advisor.
              </div>
            ) : (
              <div
                className={cn(
                  'px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
                  msg.isFlagged && !isApproved
                    ? isSelected
                      ? 'bg-red-100 border-2 border-red-400 text-red-900'
                      : 'bg-red-50 border border-red-300 text-red-900 hover:bg-red-100 transition-colors'
                    : isSelf
                      ? 'bg-brand-500 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none',
                )}
              >
                {msg.replyTo && (
                  <QuotedMessage
                    replyTo={msg.replyTo}
                    onScrollTo={scrollToMessage}
                    variant={isSelf && !(msg.isFlagged && !isApproved) ? 'light' : 'default'}
                  />
                )}
                {safeText(msg.text)}
              </div>
            )}

            {!isDeleted && msg.isFlagged && !isApproved && onFlaggedMessageClick && (
              <p className="text-[9px] text-slate-400 mt-0.5">
                {isSelected ? 'Selected · click to deselect' : 'Click to review'}
              </p>
            )}
            {!isDeleted && isApproved && onFlaggedMessageClick && (
              <p className="text-[9px] text-emerald-400 mt-0.5">
                {isSelected ? 'Selected · click to deselect' : 'Approved · click to view details'}
              </p>
            )}
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
