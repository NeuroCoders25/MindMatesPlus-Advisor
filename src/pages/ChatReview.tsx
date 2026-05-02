import React, { useState, useEffect } from 'react';
import { MessageSquare, Search, Users, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import ChatViewer from '../components/ChatViewer';
import { PeerGroup, LiveChatMessage } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  getDocs,
} from 'firebase/firestore';

const GROUPS_COLLECTION = 'peer_groups';
const MESSAGES_SUBCOLLECTION = 'chatMessages';

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  return null;
}

function parseMessage(id: string, data: Record<string, unknown>): LiveChatMessage {
  return {
    id,
    senderId: (data.senderId as string) ?? (data.userId as string) ?? 'unknown',
    senderName: (data.senderName as string) ?? (data.userName as string) ?? 'Unknown',
    text: (data.text as string) ?? (data.message as string) ?? (data.content as string) ?? '',
    timestamp: toDate(data.timestamp ?? data.createdAt ?? data.sentAt),
  };
}

export default function ChatReview() {
  const [groups, setGroups] = useState<PeerGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<PeerGroup | null>(null);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch peer groups once, then use real-time listener for messages
  useEffect(() => {
    setLoadingGroups(true);
    const unsubscribe = onSnapshot(
      collection(db, GROUPS_COLLECTION),
      (snap) => {
        const fetched: PeerGroup[] = snap.docs.map((doc) => {
          const d = doc.data() as Record<string, unknown>;
          return {
            id: doc.id,
            name: (d.group_name as string) ?? (d.name as string) ?? doc.id,
            memberCount: (d.memberCount as number) ?? undefined,
            status: (d.status as string) ?? undefined,
            category: (d.group_category as string) ?? undefined,
          };
        });
        setGroups(fetched);
        if (fetched.length > 0 && !selectedGroup) {
          setSelectedGroup(fetched[0]);
        }
        setLoadingGroups(false);
        setConnected(true);
        setError(null);
      },
      (err) => {
        console.error('Error fetching groups:', err);
        setError('Could not load groups. Check Firestore permissions.');
        setConnected(false);
        setLoadingGroups(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Real-time messages listener for the selected group
  useEffect(() => {
    if (!selectedGroup) return;

    setLoadingMessages(true);
    setMessages([]);

    const messagesRef = collection(
      db,
      GROUPS_COLLECTION,
      selectedGroup.id,
      MESSAGES_SUBCOLLECTION
    );

    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const fetched: LiveChatMessage[] = snap.docs.map((doc) =>
          parseMessage(doc.id, doc.data() as Record<string, unknown>)
        );
        setMessages(fetched);
        setLoadingMessages(false);
        setConnected(true);
      },
      (err) => {
        console.error('Error fetching messages:', err);
        // Fallback: try without orderBy in case timestamp field is missing
        getDocs(messagesRef)
          .then((snap) => {
            const fetched = snap.docs.map((doc) =>
              parseMessage(doc.id, doc.data() as Record<string, unknown>)
            );
            setMessages(fetched);
          })
          .catch(() => setError('Could not load messages.'));
        setLoadingMessages(false);
        setConnected(false);
      }
    );

    return () => unsubscribe();
  }, [selectedGroup?.id]);

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 h-[calc(100vh-120px)]"
    >
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <MessageSquare className="text-brand-500" size={32} />
            Chat Monitoring
          </h1>
          <p className="text-slate-500 mt-1">
            Monitor real-time peer group conversations.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold mt-2">
          {connected ? (
            <span className="flex items-center gap-1 text-emerald-500">
              <Wifi size={14} /> Live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400">
              <WifiOff size={14} /> Disconnected
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        {/* Group list */}
        <div className="lg:col-span-1 glass-card flex flex-col overflow-hidden">
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
                    selectedGroup?.id === group.id ? 'bg-brand-50' : 'hover:bg-slate-50'
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm shrink-0">
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
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

        {/* Chat panel */}
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
          {selectedGroup ? (
            <>
              <div className="glass-card p-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xl">
                    {selectedGroup.name.charAt(0).toUpperCase()}
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
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </div>
              </div>

              <div className="flex-1 glass-card p-6 flex flex-col overflow-hidden min-h-0">
                <h4 className="font-bold text-slate-800 mb-4 shrink-0">
                  Conversation
                  {loadingMessages && (
                    <RefreshCw size={12} className="inline ml-2 animate-spin text-slate-400" />
                  )}
                </h4>
                <ChatViewer messages={messages} />
              </div>
            </>
          ) : (
            <div className="flex-1 glass-card flex items-center justify-center text-slate-400 flex-col gap-3">
              <MessageSquare size={40} />
              <span className="text-sm">Select a group to monitor its chat</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
