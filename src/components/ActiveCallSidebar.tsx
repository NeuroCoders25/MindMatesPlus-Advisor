// src/components/ActiveCallSidebar.tsx
// Panel that appears alongside the chat UI while a group call is live.
// Wraps JitsiCallPanel and adds a title bar with a live timer and end-call button.

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { AdvisorProfile } from '../context/AuthContext';
import type { GroupCall } from '../services/groupCallService';
import { ZegoCallPanel } from './ZegoCallPanel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveCallSidebarProps {
  /** The live GroupCall document from Firestore */
  call: GroupCall;
  /** Advisor profile from AuthContext */
  advisorProfile: AdvisorProfile;
  /** Callback to end the call (updates Firestore); caller closes the sidebar after */
  onEndCall: (callId: string) => void;
  /** Collapses the sidebar without ending the call */
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActiveCallSidebar({
  call,
  advisorProfile,
  onEndCall,
  onClose,
}: ActiveCallSidebarProps) {
  const { currentUser } = useAuth();

  const [callDuration, setCallDuration] = useState(0); // seconds since sidebar mounted
  const [isEnding, setIsEnding]         = useState(false);

  // Increment duration counter every second
  useEffect(() => {
    const id = setInterval(() => setCallDuration((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const formattedDuration = formatDuration(callDuration);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col w-full h-full">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white rounded-t-lg shrink-0">
        {/* Call title + live pulse */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-sm font-medium truncate">{call.title}</span>
        </div>

        {/* Duration · End call · Close */}
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <span className="text-xs text-gray-400 font-mono tabular-nums">
            {formattedDuration}
          </span>

          <button
            onClick={() => {
              if (window.confirm('End call for all participants?')) {
                setIsEnding(true);
                onEndCall(call.id);
              }
            }}
            disabled={isEnding}
            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md font-medium disabled:opacity-50 transition-colors"
          >
            {isEnding ? 'Ending…' : 'End call'}
          </button>

          <button
            onClick={onClose}
            aria-label="Collapse call panel"
            className="text-gray-400 hover:text-white text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>
      </div>

      {/* ── ZEGOCLOUD embed (fills remaining height) ─────────────────────── */}
      <div className="flex-1 bg-gray-900 rounded-b-lg overflow-hidden">
        <ZegoCallPanel
          roomID={call.roomUrl}
          callTitle={call.title}
          advisorName={advisorProfile.name}
          advisorEmail={currentUser?.email ?? ''}
          onCallEnded={onClose}
        />
      </div>
    </div>
  );
}
