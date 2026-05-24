// src/components/ZegoCallPanel.tsx
// Embeds a ZEGOCLOUD Call Kit room natively inside the portal.
// Replaces the previous JitsiCallPanel — no browser tab is opened.
//
// TODO: Replace generateKitTokenForTest with generateKitTokenForProduction
//       before going live — move serverSecret to a backend token API.

// Suppress missing type declarations from the ZEGOCLOUD package
// (the package ships CJS types but not a proper .d.ts for ESM consumers)
declare module '@zegocloud/zego-uikit-prebuilt';

import { useEffect, useRef, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZegoCallPanelProps {
  /** ZEGOCLOUD room ID stored in the call's roomUrl Firestore field */
  roomID: string;
  /** Displayed as the meeting subject inside the call UI */
  callTitle: string;
  /** Advisor's display name shown inside the call */
  advisorName: string;
  /** Advisor's email (from AuthContext currentUser.email) — used to derive a stable userID */
  advisorEmail: string;
  /** Fired when the advisor clicks "Leave room" or the call ends */
  onCallEnded: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ZegoCallPanel({
  roomID,
  callTitle,
  advisorName,
  advisorEmail,
  onCallEnded,
}: ZegoCallPanelProps) {
  const containerRef      = useRef<HTMLDivElement>(null);
  const zpRef             = useRef<any>(null);
  const cleanupTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    // React StrictMode runs effects twice in development (mount → cleanup → mount).
    // If a deferred destroy is pending from the fake cleanup, cancel it and reuse
    // the existing SDK instance — this prevents the "WebSocket closed before
    // established" warnings caused by tearing down a mid-handshake connection.
    if (cleanupTimerRef.current !== null) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
      return;
    }

    if (zpRef.current) return; // Already initialised
    if (!containerRef.current) return;

    // ── 1. Read and validate credentials ──────────────────────────────────────
    const appID        = Number(import.meta.env.VITE_ZEGO_APP_ID);
    const serverSecret = (import.meta.env.VITE_ZEGO_SERVER_SECRET as string) ?? '';

    if (!appID || isNaN(appID) || appID <= 0) {
      setInitError(
        'ZEGOCLOUD is not configured.\n' +
        'Add VITE_ZEGO_APP_ID (numeric) and VITE_ZEGO_SERVER_SECRET to your .env file, ' +
        'then restart the dev server.',
      );
      return;
    }
    if (!serverSecret || serverSecret === 'your_server_secret_string') {
      setInitError(
        'ZEGOCLOUD server secret is missing.\n' +
        'Add VITE_ZEGO_SERVER_SECRET to your .env file and restart the dev server.',
      );
      return;
    }

    // ── 2. Build a valid ZEGOCLOUD userID ─────────────────────────────────────
    // Only numbers, letters, and underscores; max 36 characters
    const userID = (advisorEmail || 'advisor')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 36);

    // ── 3. Generate kit token (test mode) ─────────────────────────────────────
    // TODO: Replace with generateKitTokenForProduction before going live.
    //       In production, call your own token-generation backend endpoint
    //       instead of embedding the serverSecret in the client bundle.
    let kitToken: string;
    try {
      kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        roomID,
        userID,
        advisorName,
      );
    } catch (err) {
      console.error('[ZegoCallPanel] generateKitTokenForTest failed:', err);
      setInitError('Failed to generate ZEGOCLOUD token. Check your credentials.');
      return;
    }

    // ── 4. Create ZegoUIKit instance ──────────────────────────────────────────
    let zp: any;
    try {
      zp = ZegoUIKitPrebuilt.create(kitToken);
      if (!zp) throw new Error('ZegoUIKitPrebuilt.create() returned undefined');
    } catch (err) {
      console.error('[ZegoCallPanel] ZegoUIKitPrebuilt.create failed:', err);
      setInitError('Failed to initialise ZEGOCLOUD. Check your App ID and Server Secret.');
      return;
    }
    zpRef.current = zp;

    // ── 5. Join the room ──────────────────────────────────────────────────────
    try {
      zp.joinRoom({
        container: containerRef.current,
        sharedLinks: [],            // disable the "share link" button
        scenario: {
          mode: ZegoUIKitPrebuilt.VideoConference,
        },
        // Skip the pre-join setup screen so the advisor enters the room immediately
        showPreJoinView:             false,
        // Start with camera & mic off — advisor can enable manually
        turnOnCameraWhenJoining:     false,
        turnOnMicrophoneWhenJoining: false,
        // Feature flags
        showScreenSharingButton:           false,
        showTurnOffRemoteCameraButton:     false,
        showTurnOffRemoteMicrophoneButton: false,
        showRemoveUserButton:              false,
        maxUsers:                          50,
        // Layout: main speaker fills the frame; others appear in a sidebar grid
        layout:           'Sidebar',
        showLayoutButton: true,
        onLeaveRoom: () => {
          onCallEnded();
        },
      });
    } catch (err) {
      console.error('[ZegoCallPanel] zp.joinRoom failed:', err);
      setInitError('Failed to join the call room. Please try again.');
      return;
    }

    // ── 6. Teardown on unmount ────────────────────────────────────────────────
    return () => {
      // Do NOT null zpRef here — keep the reference valid so StrictMode's second
      // mount can detect the instance is still alive and skip re-initialisation.
      // Only clear it when the destroy actually executes.
      const instance = zpRef.current;
      cleanupTimerRef.current = setTimeout(() => {
        cleanupTimerRef.current = null;
        if (zpRef.current === instance) {
          zpRef.current = null;
          try { instance?.destroy(); } catch (_) { /* ignore */ }
        }
      }, 500);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only — room props are stable for the lifetime of this panel

  // ── Render ──────────────────────────────────────────────────────────────────

  // Show a clear error card instead of a white screen crash
  if (initError) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          minHeight: '400px',
          background: '#111827',
          borderRadius: '0.5rem',
          padding: '2rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '0.75rem',
            padding: '1.5rem 2rem',
            maxWidth: '420px',
            textAlign: 'center',
          }}
        >
          {/* Warning icon */}
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
          <p style={{ color: '#f87171', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            ZEGOCLOUD not configured
          </p>
          {initError.split('\n').map((line, i) => (
            <p key={i} style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              {line}
            </p>
          ))}
          <p style={{ color: '#6b7280', fontSize: '0.72rem', marginTop: '1rem' }}>
            Room ID: <code style={{ color: '#a5b4fc' }}>{roomID}</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/*
        ZegoUIKit renders its own UI into this div.
        An explicit minHeight is required — ZEGOCLOUD will not render
        into a zero-height container.
        overflow: hidden on the wrapper prevents any internal fixed/absolute
        ZEGO elements from escaping the panel boundaries.
      */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', minHeight: '400px', overflow: 'hidden' }}
      />
    </div>
  );
}
