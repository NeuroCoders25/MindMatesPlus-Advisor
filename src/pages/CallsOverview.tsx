// src/pages/CallsOverview.tsx
// Full call-management hub: per-group start / schedule / end,
// plus an in-portal ZEGOCLOUD embed that slides in from the right.

import { useState, useEffect } from 'react';
import { Video, Users, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { GroupCallPanel } from '../components/GroupCallPanel';
import { ActiveCallSidebar } from '../components/ActiveCallSidebar';
import { type GroupCall, listenToGroupCalls, endGroupCall } from '../services/groupCallService';
import { type PeerGroup } from '../types';
import { cn } from '../lib/utils';

const GROUPS_COLLECTION = 'peer_groups';

// ─── Component ────────────────────────────────────────────────────────────────

export default function CallsOverview() {
  const { advisorProfile } = useAuth();

  const [groups, setGroups]             = useState<PeerGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<PeerGroup | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [searchQuery, setSearchQuery]   = useState('');

  // ── Call state ───────────────────────────────────────────────────────────────
  const [activeCall, setActiveCall]           = useState<GroupCall | null>(null);
  const [showCallSidebar, setShowCallSidebar] = useState(false);

  // Real-time listener for the selected group's live call
  useEffect(() => {
    if (!selectedGroup) {
      setActiveCall(null);
      return;
    }
    setActiveCall(null);
    setShowCallSidebar(false);

    const unsub = listenToGroupCalls(selectedGroup.id, (calls) => {
      setActiveCall(calls.find((c) => c.status === 'live') ?? null);
    });
    return unsub;
  }, [selectedGroup?.id]);

  // Fetch the advisor's peer groups
  useEffect(() => {
    setLoadingGroups(true);
    const unsub = onSnapshot(
      collection(db, GROUPS_COLLECTION),
      (snap) => {
        const advisorName = advisorProfile?.name ?? '';
        const fetched: PeerGroup[] = snap.docs
          .map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              name: (data.group_name as string) ?? (data.name as string) ?? d.id,
              memberCount: (data.memberCount as number) ?? undefined,
              status: (data.status as string) ?? undefined,
              category: (data.group_category as string) ?? undefined,
              moderator: (data.group_moderator as string) ?? undefined,
              imageUrl:
                (data.group_image_url as string) ??
                (data.group_image as string) ??
                (data.imageUrl as string) ??
                undefined,
            };
          })
          .filter((g) => g.moderator === advisorName);

        setGroups(fetched);
        if (fetched.length > 0 && !selectedGroup) {
          setSelectedGroup(fetched[0]);
        }
        setLoadingGroups(false);
      },
      (err) => {
        console.error('[CallsOverview] fetch groups failed:', err);
        setLoadingGroups(false);
      },
    );
    return unsub;
  }, [advisorProfile?.name]);

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 h-[calc(100vh-120px)] flex flex-col"
    >
      {/* Page header */}
      <header className="shrink-0">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Video className="text-brand-500" size={32} />
          Group Calls
        </h1>
        <p className="text-slate-500 mt-1">
          Start, schedule, and manage video calls for your peer groups.
        </p>
      </header>

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">

        {/* ── Group list ──────────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 glass-card flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search groups..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-brand-300 rounded-xl outline-none text-xs transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingGroups ? (
              <div className="flex flex-col gap-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm gap-2">
                <Users size={28} />
                <span>No groups found</span>
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => setSelectedGroup(group)}
                  className={cn(
                    'p-4 border-b border-slate-50 cursor-pointer transition-all flex items-center gap-3',
                    selectedGroup?.id === group.id ? 'bg-brand-50' : 'hover:bg-slate-50',
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm shrink-0 overflow-hidden">
                    {group.imageUrl ? (
                      <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" />
                    ) : (
                      group.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-sm font-bold text-slate-800 truncate">{group.name}</h5>
                    <p className="text-[10px] text-slate-400 truncate">
                      {group.category ?? ''}
                      {group.memberCount !== undefined ? ` · ${group.memberCount} members` : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Call management panel ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto pr-1">
          {selectedGroup ? (
            <>
              {/* Group info */}
              <div className="glass-card p-5 flex items-center gap-4 shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xl overflow-hidden">
                  {selectedGroup.imageUrl ? (
                    <img src={selectedGroup.imageUrl} alt={selectedGroup.name} className="w-full h-full object-cover" />
                  ) : (
                    selectedGroup.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{selectedGroup.name}</h3>
                  <div className="flex items-center gap-3">
                    {selectedGroup.memberCount !== undefined && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Users size={11} /> {selectedGroup.memberCount} members
                      </span>
                    )}
                    {selectedGroup.category && (
                      <span className="text-[10px] font-medium text-brand-500 bg-brand-50 px-2 py-0.5 rounded-full">
                        {selectedGroup.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Per-group call controls (start / schedule / end / upcoming) */}
              <div className="shrink-0">
                <GroupCallPanel
                  groupId={selectedGroup.id}
                  groupName={selectedGroup.name}
                  onCallStarted={(call) => {
                    setActiveCall(call);
                    setShowCallSidebar(true);
                  }}
                />
              </div>

              {/* Rejoin banner — shown when a call is live but the panel is collapsed */}
              {activeCall && !showCallSidebar && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="text-xs font-semibold text-amber-800 truncate">
                      A call is in progress
                    </span>
                    <span className="text-xs text-amber-600 truncate hidden sm:block">
                      · {activeCall.title}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowCallSidebar(true)}
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-xl transition-colors shrink-0"
                  >
                    <Video size={12} />
                    Open call
                  </button>
                </div>
              )}

              {/* ── Inline call panel — fills the remaining height ────────── */}
              <AnimatePresence>
                {showCallSidebar && activeCall && advisorProfile && (
                  <motion.div
                    key="call-inline"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                    className="min-h-120 rounded-2xl overflow-hidden shadow-2xl"
                  >
                    <ActiveCallSidebar
                      call={activeCall}
                      advisorProfile={advisorProfile}
                      onEndCall={async (callId) => {
                        if (!selectedGroup) return;
                        await endGroupCall(selectedGroup.id, callId);
                        setShowCallSidebar(false);
                        setActiveCall(null);
                      }}
                      onClose={() => setShowCallSidebar(false)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="flex-1 glass-card flex items-center justify-center text-slate-400 flex-col gap-3">
              <Video size={40} />
              <span className="text-sm">Select a group to manage its calls</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
