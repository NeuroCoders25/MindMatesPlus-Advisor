import React, { useState } from 'react';
import { CheckCircle2, Link2, User, Calendar } from 'lucide-react';
import { db } from '../../../lib/firebase';
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import {
  tsToFull,
  tsToRelative,
  getUserDisplayName,
} from '../../../types/userDiagnostic';
import type { UserDiagnosticData } from '../../../types/userDiagnostic';

interface Props {
  data: UserDiagnosticData;
  userId: string;
}

function ConnectButton({ userId, data }: { userId: string; data: UserDiagnosticData }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const { advisorConnection, profile } = data;

  const connStatus = (advisorConnection?.status ?? '').toLowerCase();
  const isConnected = connStatus === 'accepted' || connStatus === 'approved';

  async function handleConnect() {
    if (isConnected || loading || !currentUser) return;
    setLoading(true);
    try {
      if (advisorConnection?.id) {
        await updateDoc(doc(db, 'advisorConnections', advisorConnection.id), {
          status: 'accepted',
          advisorId: currentUser.uid,
          acceptedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const displayName = getUserDisplayName(profile);
        await addDoc(collection(db, 'advisorConnections'), {
          userId,
          advisorId: currentUser.uid,
          status: 'accepted',
          caseType: 'advisor_initiated',
          reason: 'Advisor initiated from monitoring panel',
          userMentalHealthCategory: '',
          userName: displayName,
          userEmail: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await updateDoc(
        doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile'),
        {
          connectedAdvisorId: currentUser.uid,
          advisorConnectionStatus: 'accepted',
          userStatus: 'under_review',
        },
      );
    } catch (err) {
      console.error('[AboutTab] connect:', err);
    } finally {
      setLoading(false);
    }
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold">
        <CheckCircle2 size={16} />
        Connected
        {advisorConnection?.connectedAt || advisorConnection?.createdAt ? (
          <span className="text-slate-400 font-normal text-xs">
            since {tsToFull(advisorConnection.connectedAt ?? advisorConnection.createdAt)}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-bold hover:bg-brand-600 disabled:opacity-50 transition-all"
    >
      <Link2 size={12} />
      {loading ? 'Connecting…' : 'Connect'}
    </button>
  );
}

export default function AboutTab({ data, userId }: Props) {
  const { profile, mentalHealthProfile } = data;

  const createdAt      = profile?.createdAt;
  const lastActive     = profile?.lastActive ?? mentalHealthProfile?.lastUpdated;
  const displayName    = getUserDisplayName(profile);
  const email          = (profile as unknown as Record<string, unknown>)?.email as string | undefined ?? null;
  const connStatus     = (data.advisorConnection?.status ?? profile?.advisorConnectionStatus ?? '').toLowerCase();
  const isConnected    = connStatus === 'accepted' || connStatus === 'approved';
  const advisorId      = data.advisorConnection?.advisorId as string | undefined;
  const connectedSince = data.advisorConnection?.connectedAt ?? data.advisorConnection?.createdAt;

  return (
    <div className="p-4 space-y-4">

      {/* ── User Info ── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          User Profile
        </p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
            <User size={20} className="text-brand-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{displayName || '—'}</p>
            {email && (
              <p className="text-xs text-slate-400 truncate">{email}</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Advisor Connection ── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          Advisor Connection
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-700 capitalize">
                {data.advisorConnection?.status ?? profile?.advisorConnectionStatus ?? 'Not connected'}
              </p>
              {advisorId && (
                <p className="text-xs text-slate-400 font-mono">
                  Advisor: {advisorId.slice(0, 16)}…
                </p>
              )}
            </div>
            <ConnectButton userId={userId} data={data} />
          </div>

          {isConnected && connectedSince && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 size={13} />
              <span>Connected since {tsToFull(connectedSince)}</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Account Dates ── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          Account Details
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wide">
              <Calendar size={11} />
              Account Created
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {tsToFull(createdAt) || '—'}
            </p>
          </div>
          {lastActive && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase tracking-wide">
                <Calendar size={11} />
                Last Active
              </div>
              <p className="text-sm font-semibold text-slate-700">
                {tsToRelative(lastActive)}
              </p>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
