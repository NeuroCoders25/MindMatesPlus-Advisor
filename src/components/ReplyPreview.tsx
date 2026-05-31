import React from 'react';
import { X } from 'lucide-react';
import { safeText } from '../services/cryptoService';

interface ReplyPreviewProps {
  senderName: string;
  snippet: string;
  onCancel: () => void;
}

export default function ReplyPreview({ senderName, snippet, onCancel }: ReplyPreviewProps) {
  return (
    <div className="flex items-center gap-2 bg-slate-100 border-l-4 border-indigo-500 rounded px-3 py-2 mb-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-indigo-600">
          Replying to {senderName}
        </p>
        <p className="text-xs text-slate-500 truncate">{safeText(snippet)}</p>
      </div>
      <button
        onClick={onCancel}
        className="text-slate-400 hover:text-slate-600 shrink-0 transition-colors"
        aria-label="Cancel reply"
      >
        <X size={14} />
      </button>
    </div>
  );
}
