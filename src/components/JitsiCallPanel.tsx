// src/components/JitsiCallPanel.tsx
// Embeds a Jitsi Meet call inside the portal using the Jitsi iFrame API.
// The API script is loaded at runtime from meet.jit.si — no npm package needed.

import React, { useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JitsiCallPanelProps {
  /** Full Jitsi room URL, e.g. "https://meet.jit.si/mindmates-PG001-1748…" */
  roomUrl: string;
  /** Displayed as the Jitsi subject/room title */
  callTitle: string;
  /** Display name shown inside the call */
  advisorName: string;
  /** Advisor's email (from AuthContext currentUser.email) */
  advisorEmail: string;
  /** Fired when the advisor clicks "Hang up" or otherwise leaves the call */
  onCallEnded: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function JitsiCallPanel({
  roomUrl,
  callTitle,
  advisorName,
  advisorEmail,
  onCallEnded,
}: JitsiCallPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const apiRef       = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Inject the Jitsi iFrame API script once
    const script = document.createElement('script');
    script.src   = 'https://meet.jit.si/external_api.js';
    script.async = true;

    script.onload = () => {
      if (!containerRef.current) return;

      // Parse room domain and name from the full URL
      const url      = new URL(roomUrl);
      const domain   = url.hostname;         // "meet.jit.si"
      const roomName = url.pathname.slice(1); // strip leading "/"

      const api = new (window as any).JitsiMeetExternalAPI(domain, {
        roomName,
        parentNode: containerRef.current,
        width:  '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted:   false,
          startWithVideoMuted:   false,
          prejoinPageEnabled:    false,
          disableDeepLinking:    true,
          subject:               callTitle,
          hideConferenceTimer:   false,
          toolbarButtons: [
            'microphone', 'camera', 'chat',
            'raisehand', 'tileview', 'hangup',
          ],
        },
        interfaceConfigOverwrite: {
          SHOW_CHROME_EXTENSION_BANNER: false,
          MOBILE_APP_PROMO:             false,
          TOOLBAR_ALWAYS_VISIBLE:       true,
        },
        userInfo: {
          displayName: advisorName,
          email:       advisorEmail,
        },
      });

      apiRef.current = api;
      setIsLoading(false);

      // Clean up the embed when the advisor hangs up or leaves
      api.addEventListeners({
        readyToClose: () => {
          api.dispose();
          onCallEnded();
        },
        videoConferenceLeft: () => {
          api.dispose();
          onCallEnded();
        },
      });
    };

    document.head.appendChild(script);

    // Cleanup: dispose the Jitsi API instance and remove the injected script
    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
      const injected = document.querySelector(
        'script[src="https://meet.jit.si/external_api.js"]',
      );
      if (injected) {
        document.head.removeChild(injected);
      }
    };
  }, []); // mount-only — room props are stable for the lifetime of this panel

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Loading overlay — shown until the Jitsi iframe signals readiness */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 rounded-lg z-10">
          <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mb-3" />
          <p className="text-white text-sm">Joining call...</p>
        </div>
      )}

      {/* Jitsi renders itself into this div */}
      <div
        ref={containerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}
