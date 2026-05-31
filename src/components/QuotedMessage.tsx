import React from 'react';
import { ReplyTo } from '../types';
import { safeText } from '../services/cryptoService';

interface QuotedMessageProps {
  replyTo: ReplyTo;
  onScrollTo: (messageId: string) => void;
  /** Use 'light' inside dark-background bubbles (advisor's own messages) */
  variant?: 'default' | 'light';
}

export default function QuotedMessage({ replyTo, onScrollTo, variant = 'default' }: QuotedMessageProps) {
  const isLight = variant === 'light';
  return (
    <button
      onClick={() => onScrollTo(replyTo.messageId)}
      className={[
        'flex gap-2 items-stretch text-left rounded px-2 py-1 mb-1 w-full transition-opacity hover:opacity-80',
        isLight ? 'bg-white/10' : 'bg-black/5',
      ].join(' ')}
    >
      <span className="w-1 bg-indigo-400 rounded shrink-0" />
      <span className="min-w-0">
        <span className={['block text-xs font-medium truncate', isLight ? 'text-indigo-200' : 'text-indigo-600'].join(' ')}>
          {replyTo.senderName}
        </span>
        <span className={['block text-xs truncate', isLight ? 'text-white/60' : 'text-slate-500'].join(' ')}>
          {safeText(replyTo.snippet)}
        </span>
      </span>
    </button>
  );
}
