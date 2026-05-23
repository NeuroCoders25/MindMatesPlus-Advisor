import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Search, Users, Wifi, WifiOff, RefreshCw,
  AlertTriangle, CheckCircle, FileText, X, XCircle, Send, Loader2, Lock, Save,
} from 'lucide-react';
import ChatViewer from '../components/ChatViewer';
import { PeerGroup, LiveChatMessage, AdvisorPrivateMessage } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

const GROUPS_COLLECTION = 'peer_groups';
const MESSAGES_SUBCOLLECTION = 'chatMessages';
const PRIVATE_THREAD_SUBCOLLECTION = 'privateThread';

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  return null;
}

function formatTime(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function parseMessage(id: string, data: Record<string, unknown>): LiveChatMessage {
  return {
    id,
    senderId: (data.senderId as string) ?? (data.userId as string) ?? 'unknown',
    senderName: (data.senderName as string) ?? (data.userName as string) ?? 'Unknown',
    text: (data.text as string) ?? (data.message as string) ?? (data.content as string) ?? '',
    timestamp: toDate(data.timestamp ?? data.createdAt ?? data.sentAt),
    isFlagged: Boolean(data.isFlagged ?? data.flagged ?? data.is_flagged ?? false),
    advisorApproved: Boolean(data.advisorApproved ?? false),
    advisorNote: (data.advisorNote as string) ?? undefined,
    deletedByAdvisor: Boolean(data.deletedByAdvisor ?? false),
    deletedByAdvisorName: (data.deletedByAdvisorName as string) ?? undefined,
    reviewStatus: (data.reviewStatus as 'pending' | 'approved' | 'rejected' | 'not_required') ?? undefined,
    reviewedBy: (data.reviewedBy as string) ?? undefined,
    reviewedAt: toDate(data.reviewedAt),
    rejectionReason: (data.rejectionReason as string | null) ?? null,
  };
}

function parsePrivateMessage(id: string, data: Record<string, unknown>): AdvisorPrivateMessage {
  return {
    id,
    senderId: (data.senderId as string) ?? 'unknown',
    senderName: (data.senderName as string) ?? 'Unknown',
    senderRole: (data.senderRole as string) === 'advisor' ? 'advisor' : 'user',
    text: (data.text as string) ?? '',
    createdAt: toDate(data.createdAt ?? data.timestamp),
    isRead: Boolean(data.isRead ?? false),
  };
}

export default function ChatReview() {
  const { currentUser, advisorProfile } = useAuth();

  const [groups, setGroups] = useState<PeerGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<PeerGroup | null>(null);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flagged message panel state
  const [selectedFlaggedMsg, setSelectedFlaggedMsg] = useState<LiveChatMessage | null>(null);
  const [panelTab, setPanelTab] = useState<'actions' | 'chat'>('actions');
  const [noteText, setNoteText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [privateMessages, setPrivateMessages] = useState<AdvisorPrivateMessage[]>([]);
  const [noteSaving, setNoteSaving] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [publicMessageText, setPublicMessageText] = useState('');
  const [sendingPublicMessage, setSendingPublicMessage] = useState(false);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);

  const [flaggedCounts, setFlaggedCounts] = useState<Record<string, number>>({});

  const privateMsgsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    privateMsgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [privateMessages]);

  // Subscribe to pending flagged message counts for all groups
  useEffect(() => {
    if (groups.length === 0) return;

    const unsubscribes = groups.map((group) => {
      const messagesRef = collection(db, GROUPS_COLLECTION, group.id, MESSAGES_SUBCOLLECTION);

      return onSnapshot(query(messagesRef), (snap) => {
        const count = snap.docs.filter(d => {
          const data = d.data();
          const isFlagged = Boolean(data.isFlagged ?? data.flagged ?? data.is_flagged ?? false);
          const reviewStatus = data.reviewStatus as string | undefined;
          const advisorApproved = Boolean(data.advisorApproved ?? false);
          const effectiveStatus = reviewStatus ?? (advisorApproved ? 'approved' : 'pending');
          return isFlagged && effectiveStatus === 'pending';
        }).length;
        setFlaggedCounts(prev => ({ ...prev, [group.id]: count }));
      }, () => {});
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [groups]);

  // Fetch peer groups — only those where group_moderator matches the logged-in advisor's name
  useEffect(() => {
    setLoadingGroups(true);
    const unsubscribe = onSnapshot(
      collection(db, GROUPS_COLLECTION),
      (snap) => {
        const advisorName = advisorProfile?.name ?? '';
        const fetched: PeerGroup[] = snap.docs
          .map((doc) => {
            const d = doc.data() as Record<string, unknown>;
            return {
              id: doc.id,
              name: (d.group_name as string) ?? (d.name as string) ?? doc.id,
              memberCount: (d.memberCount as number) ?? undefined,
              status: (d.status as string) ?? undefined,
              category: (d.group_category as string) ?? undefined,
              moderator: (d.group_moderator as string) ?? undefined,
              imageUrl: (d.group_image_url as string) ?? (d.group_image as string) ?? (d.imageUrl as string) ?? undefined,
            };
          })
          .filter((g) => g.moderator === advisorName);
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
  }, [advisorProfile?.name]);

  // Real-time messages listener
  useEffect(() => {
    if (!selectedGroup) return;

    setLoadingMessages(true);
    setMessages([]);
    setSelectedFlaggedMsg(null);

    const messagesRef = collection(db, GROUPS_COLLECTION, selectedGroup.id, MESSAGES_SUBCOLLECTION);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const fetched: LiveChatMessage[] = snap.docs.map((doc) =>
          parseMessage(doc.id, doc.data() as Record<string, unknown>)
        );
        setMessages(fetched);
        // Sync selected flagged msg if it was updated
        setSelectedFlaggedMsg(prev => {
          if (!prev) return null;
          return fetched.find(m => m.id === prev.id) ?? prev;
        });
        setLoadingMessages(false);
        setConnected(true);
      },
      (err) => {
        console.error('Error fetching messages:', err);
        getDocs(messagesRef)
          .then((snap) => {
            setMessages(snap.docs.map((doc) => parseMessage(doc.id, doc.data() as Record<string, unknown>)));
          })
          .catch(() => setError('Could not load messages.'));
        setLoadingMessages(false);
        setConnected(false);
      }
    );

    return () => unsubscribe();
  }, [selectedGroup?.id]);

  // Private messages listener for the flagged message panel.
  // Path: peer_groups/{groupId}/chatMessages/{flaggedMessageId}/privateThread
  // Only the advisor and the flagged-message sender can see these (enforced via visibleTo).
  useEffect(() => {
    if (!selectedFlaggedMsg || !selectedGroup || !currentUser) {
      setPrivateMessages([]);
      return;
    }

    const q = query(
      collection(
        db,
        GROUPS_COLLECTION, selectedGroup.id,
        MESSAGES_SUBCOLLECTION, selectedFlaggedMsg.id,
        PRIVATE_THREAD_SUBCOLLECTION,
      ),
      orderBy('timestamp', 'asc'),
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setPrivateMessages(
        snap.docs.map(d => parsePrivateMessage(d.id, d.data() as Record<string, unknown>))
      );
    }, (err) => {
      console.error('Error fetching private thread:', err);
    });

    return () => unsubscribe();
  }, [selectedFlaggedMsg?.id, selectedGroup?.id, currentUser?.uid]);

  const handleFlaggedMessageClick = (msg: LiveChatMessage) => {
    if (selectedFlaggedMsg?.id === msg.id) {
      setSelectedFlaggedMsg(null);
      return;
    }
    setSelectedFlaggedMsg(msg);
    setPanelTab('actions');
    setNoteText(msg.advisorNote ?? '');
    setReplyText('');
    setRejectionReasonText('');
  };

  const handleApprove = async () => {
    if (!selectedFlaggedMsg || !selectedGroup || !currentUser) return;
    setApproving(true);
    try {
      const msgRef = doc(db, GROUPS_COLLECTION, selectedGroup.id, MESSAGES_SUBCOLLECTION, selectedFlaggedMsg.id);
      await updateDoc(msgRef, {
        advisorApproved: true,
        advisorApprovedBy: currentUser.uid,
        advisorApprovedAt: serverTimestamp(),
        reviewStatus: 'approved',
        reviewedBy: currentUser.uid,
        reviewedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error approving message:', err);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedFlaggedMsg || !selectedGroup || !currentUser) return;
    setRejecting(true);
    try {
      const msgRef = doc(db, GROUPS_COLLECTION, selectedGroup.id, MESSAGES_SUBCOLLECTION, selectedFlaggedMsg.id);
      await updateDoc(msgRef, {
        reviewStatus: 'rejected',
        reviewedBy: currentUser.uid,
        reviewedAt: serverTimestamp(),
        rejectionReason: rejectionReasonText.trim() || null,
      });
      setRejectionReasonText('');
    } catch (err) {
      console.error('Error rejecting message:', err);
    } finally {
      setRejecting(false);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedFlaggedMsg || !selectedGroup || !currentUser || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      const msgRef = doc(db, GROUPS_COLLECTION, selectedGroup.id, MESSAGES_SUBCOLLECTION, selectedFlaggedMsg.id);
      await updateDoc(msgRef, {
        advisorNote: noteText.trim(),
        advisorNoteBy: currentUser.uid,
        advisorNoteAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setNoteSaving(false);
    }
  };

  // Sends a private message from the advisor to the flagged-message author.
  // Stored under: peer_groups/{groupId}/chatMessages/{flaggedMessageId}/privateThread
  // Does NOT touch the main chatMessages collection or broadcast to group listeners.
  const handleSendPrivateReply = async () => {
    if (!replyText.trim() || !selectedFlaggedMsg || !selectedGroup || !currentUser) return;
    setReplySending(true);
    try {
      const privateThreadRef = collection(
        db,
        GROUPS_COLLECTION, selectedGroup.id,
        MESSAGES_SUBCOLLECTION, selectedFlaggedMsg.id,
        PRIVATE_THREAD_SUBCOLLECTION,
      );

      await addDoc(privateThreadRef, {
        // Sender — always the advisor here
        senderId:   currentUser.uid,
        senderName: advisorProfile?.name ?? 'Advisor',
        senderRole: 'advisor',
        // Recipient — the user who sent the flagged message
        receiverId:   selectedFlaggedMsg.senderId,
        receiverName: selectedFlaggedMsg.senderName,
        // Content
        text:      replyText.trim(),
        timestamp: serverTimestamp(),
        // Thread metadata
        isPrivate:          true,
        threadType:         'advisor_private_reply',
        flaggedMessageRef:  selectedFlaggedMsg.id,
        visibleTo: [currentUser.uid, selectedFlaggedMsg.senderId],
      });

      setReplyText('');
    } catch (err) {
      console.error('Error sending private reply:', err);
    } finally {
      setReplySending(false);
    }
  };

  const handleSendPublicMessage = async () => {
    if (!publicMessageText.trim() || !selectedGroup || !currentUser) return;
    setSendingPublicMessage(true);
    try {
      const messagesRef = collection(db, GROUPS_COLLECTION, selectedGroup.id, MESSAGES_SUBCOLLECTION);
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: advisorProfile?.name ?? 'Advisor',
        text: publicMessageText.trim(),
        timestamp: serverTimestamp(),
        isFlagged: false,
      });
      setPublicMessageText('');
    } catch (err) {
      console.error('Error sending public message:', err);
    } finally {
      setSendingPublicMessage(false);
    }
  };

  const handleDeleteMessage = async (msg: LiveChatMessage) => {
    if (!selectedGroup || !currentUser) return;
    if (!window.confirm('Delete this message? It will be replaced with a "deleted by advisor" notice visible to all members.')) return;
    setDeletingMsgId(msg.id);
    try {
      const msgRef = doc(db, GROUPS_COLLECTION, selectedGroup.id, MESSAGES_SUBCOLLECTION, msg.id);
      await updateDoc(msgRef, {
        deletedByAdvisor: true,
        deletedByAdvisorName: advisorProfile?.name ?? 'Advisor',
        deletedByAdvisorAt: serverTimestamp(),
      });
      if (selectedFlaggedMsg?.id === msg.id) setSelectedFlaggedMsg(null);
    } catch (err) {
      console.error('Error deleting message:', err);
    } finally {
      setDeletingMsgId(null);
    }
  };

  const visibleMessages = messages.filter(msg => {
    // Deleted messages are always shown so the "deleted by advisor" placeholder
    // is visible to everyone in the thread, regardless of the review filter.
    if (msg.deletedByAdvisor) return true;
    if (!msg.isFlagged) return true;
    if (reviewFilter === 'all') return true;
    const status = msg.reviewStatus ?? (msg.advisorApproved ? 'approved' : 'pending');
    return status === reviewFilter;
  });

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 h-[calc(100vh-120px)] flex flex-col"
    >
      <header className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <MessageSquare className="text-brand-500" size={32} />
            Chat Monitoring
          </h1>
          <p className="text-slate-500 mt-1">Monitor real-time peer group conversations.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold mt-2">
          {connected ? (
            <span className="flex items-center gap-1 text-emerald-500"><Wifi size={14} /> Live</span>
          ) : (
            <span className="flex items-center gap-1 text-red-400"><WifiOff size={14} /> Disconnected</span>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 shrink-0">
          {error}
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Group list */}
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
                    selectedGroup?.id === group.id ? 'bg-brand-50' : 'hover:bg-slate-50'
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
                  {(flaggedCounts[group.id] ?? 0) > 0 && (
                    <span className="ml-1 min-w-4.5 h-4.5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                      {flaggedCounts[group.id]}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {selectedGroup ? (
            <>
              <div className="glass-card p-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
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
                <div className="flex items-center gap-3">
                  {selectedFlaggedMsg && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full flex items-center gap-1">
                      <AlertTriangle size={10} />
                      Reviewing flagged message
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </div>
              </div>

              <div className="flex-1 glass-card flex flex-col overflow-hidden min-h-0">
                <div className="p-6 pb-3 shrink-0">
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    Conversation
                    {loadingMessages && <RefreshCw size={12} className="animate-spin text-slate-400" />}
                  </h4>
                  <div className="flex items-center gap-1.5 mb-2">
                    {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setReviewFilter(f)}
                        className={cn(
                          'text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors',
                          reviewFilter === f
                            ? f === 'pending' ? 'bg-amber-400 text-white border-amber-400'
                              : f === 'approved' ? 'bg-emerald-500 text-white border-emerald-500'
                              : f === 'rejected' ? 'bg-red-500 text-white border-red-500'
                              : 'bg-slate-600 text-white border-slate-600'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                        )}
                      >
                        {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                  {messages.some(m => m.isFlagged) && (
                    <p className="text-[10px] text-slate-400">
                      Click on a <span className="text-red-500 font-bold">Flagged</span> message to review, approve, or reply privately.
                    </p>
                  )}
                </div>
                <div className="flex-1 px-6 min-h-0 overflow-hidden flex flex-col">
                  <ChatViewer
                    messages={visibleMessages}
                    currentUserId={currentUser?.uid}
                    selectedFlaggedMsgId={selectedFlaggedMsg?.id}
                    onFlaggedMessageClick={handleFlaggedMessageClick}
                    onDeleteMessage={handleDeleteMessage}
                  />
                </div>
                <div className="p-4 border-t border-slate-100 shrink-0">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={publicMessageText}
                      onChange={(e) => setPublicMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendPublicMessage();
                        }
                      }}
                      placeholder={`Message ${selectedGroup?.name ?? 'group'}...`}
                      className="flex-1 text-sm bg-slate-50 border border-slate-200 focus:border-brand-300 rounded-xl px-4 py-2.5 outline-none transition-colors"
                    />
                    <button
                      onClick={handleSendPublicMessage}
                      disabled={sendingPublicMessage || !publicMessageText.trim()}
                      className="p-2.5 bg-brand-500 text-white rounded-xl disabled:opacity-40 hover:bg-brand-600 transition-colors shrink-0"
                    >
                      {sendingPublicMessage
                        ? <Loader2 size={16} className="animate-spin" />
                        : <Send size={16} />
                      }
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    Visible to all group members · posting as <span className="font-semibold text-slate-500">{advisorProfile?.name ?? 'Advisor'}</span>
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 glass-card flex items-center justify-center text-slate-400 flex-col gap-3">
              <MessageSquare size={40} />
              <span className="text-sm">Select a group to monitor its chat</span>
            </div>
          )}
        </div>

        {/* Flagged message action panel */}
        <AnimatePresence>
          {selectedFlaggedMsg && (
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2 }}
              className="w-96 shrink-0 glass-card flex flex-col overflow-hidden"
            >
              {/* Panel header */}
              <div className="p-4 border-b border-slate-100 bg-red-50/50 shrink-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded-md">
                        <AlertTriangle size={9} /> Flagged
                      </span>
                      {(() => {
                        const status = selectedFlaggedMsg.reviewStatus ?? (selectedFlaggedMsg.advisorApproved ? 'approved' : 'pending');
                        if (status === 'approved') return (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                            <CheckCircle size={9} /> Approved
                          </span>
                        );
                        if (status === 'rejected') return (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md">
                            <XCircle size={9} /> Removed
                          </span>
                        );
                        return null;
                      })()}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 line-clamp-2">
                      "{selectedFlaggedMsg.text}"
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      by <span className="font-bold">{selectedFlaggedMsg.senderName}</span>
                      {selectedFlaggedMsg.timestamp && (
                        <span> · {formatTime(selectedFlaggedMsg.timestamp)}</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedFlaggedMsg(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 shrink-0">
                <button
                  onClick={() => setPanelTab('actions')}
                  className={cn(
                    'flex-1 py-2.5 text-xs font-bold transition-colors',
                    panelTab === 'actions'
                      ? 'text-brand-600 border-b-2 border-brand-500 bg-brand-50/30'
                      : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  Actions
                </button>
                <button
                  onClick={() => setPanelTab('chat')}
                  className={cn(
                    'flex-1 py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-1',
                    panelTab === 'chat'
                      ? 'text-brand-600 border-b-2 border-brand-500 bg-brand-50/30'
                      : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  <Lock size={10} /> Private Chat
                  {privateMessages.length > 0 && (
                    <span className="ml-1 w-4 h-4 bg-brand-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {privateMessages.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Actions tab */}
              {panelTab === 'actions' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Review Status */}
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <h6 className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-1.5">
                      <CheckCircle size={13} className="text-emerald-500" />
                      Review Status
                    </h6>
                    {(() => {
                      const status = selectedFlaggedMsg.reviewStatus ?? (selectedFlaggedMsg.advisorApproved ? 'approved' : 'pending');
                      if (status === 'approved') return (
                        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-xs font-bold">
                          <CheckCircle size={14} />
                          Message has been approved
                        </div>
                      );
                      if (status === 'rejected') return (
                        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs font-bold">
                          <XCircle size={14} />
                          Message has been removed
                        </div>
                      );
                      return (
                        <>
                          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs font-bold mb-3">
                            <AlertTriangle size={14} />
                            Awaiting review
                          </div>
                          <div className="flex gap-2 mb-3">
                            <button
                              onClick={handleApprove}
                              disabled={approving || rejecting}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                            >
                              {approving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                              Approve
                            </button>
                            <button
                              onClick={handleReject}
                              disabled={approving || rejecting}
                              className="flex-1 flex items-center justify-center gap-1.5 border border-red-400 text-red-600 hover:bg-red-50 text-xs font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                            >
                              {rejecting ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                              Reject
                            </button>
                          </div>
                          <input
                            type="text"
                            value={rejectionReasonText}
                            onChange={(e) => setRejectionReasonText(e.target.value)}
                            placeholder="Rejection reason (optional)"
                            className="w-full text-xs bg-white border border-slate-200 focus:border-red-300 rounded-xl px-3 py-2 outline-none transition-colors"
                          />
                        </>
                      );
                    })()}
                    <p className="text-[10px] text-slate-400 mt-2">
                      Approve to allow the message; reject to hide it from group members.
                    </p>
                  </div>

                </div>
              )}

              {/* Private chat tab */}
              {panelTab === 'chat' && (
                <div className="flex-1 flex flex-col overflow-hidden">

                  {/* Privacy notice */}
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 shrink-0 flex items-center gap-1.5">
                    <Lock size={9} className="text-amber-600 shrink-0" />
                    <p className="text-[10px] text-amber-700">
                      Only you and{' '}
                      <span className="font-bold">{selectedFlaggedMsg.senderName}</span>{' '}
                      can see these messages.
                    </p>
                  </div>

                  {/* Flagged message context reference */}
                  <div className="mx-3 mt-3 mb-1 shrink-0 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle size={10} className="text-red-500 shrink-0" />
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Flagged message · context</span>
                    </div>
                    <p className="text-xs text-red-800 font-medium leading-snug line-clamp-3">
                      "{selectedFlaggedMsg.text}"
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-red-500">
                        — <span className="font-semibold">{selectedFlaggedMsg.senderName}</span>
                        {selectedFlaggedMsg.timestamp && (
                          <span className="text-red-400 ml-1">· {formatTime(selectedFlaggedMsg.timestamp)}</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Message thread */}
                  <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-3 bg-slate-50/50">
                    {privateMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-2 py-6">
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
                          <MessageSquare size={20} className="text-brand-400" />
                        </div>
                        <p className="text-center text-slate-500 text-[11px] font-medium">
                          Start a private conversation with<br />
                          <span className="font-bold text-slate-700">{selectedFlaggedMsg.senderName}</span>
                        </p>
                        <p className="text-[10px] text-slate-300 text-center">
                          Other group members won't see this
                        </p>
                      </div>
                    ) : (
                      privateMessages.map((msg) => {
                        const isMe = msg.senderRole === 'advisor';
                        return (
                          <div key={msg.id} className={cn('flex flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}>
                            <span className="text-[9px] font-semibold text-slate-400 px-1">
                              {isMe ? (advisorProfile?.name ?? 'You') : msg.senderName}
                            </span>
                            <div className={cn(
                              'max-w-[85%] px-3 py-2 rounded-2xl text-xs shadow-sm',
                              isMe
                                ? 'bg-brand-500 text-white rounded-tr-sm'
                                : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                            )}>
                              <p className="leading-relaxed">{msg.text}</p>
                              <p className={cn(
                                'text-[9px] mt-1 opacity-60',
                                isMe ? 'text-right' : 'text-left'
                              )}>
                                {msg.createdAt ? formatTime(msg.createdAt) : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={privateMsgsEndRef} />
                  </div>

                  {/* Input area */}
                  <div className="p-3 border-t border-slate-100 bg-white shrink-0">
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendPrivateReply();
                          }
                        }}
                        placeholder={`Message ${selectedFlaggedMsg.senderName} privately…`}
                        className="flex-1 text-xs bg-slate-50 border border-slate-200 focus:border-brand-300 rounded-xl px-3 py-2.5 outline-none transition-colors"
                      />
                      <button
                        onClick={handleSendPrivateReply}
                        disabled={replySending || !replyText.trim()}
                        className="p-2.5 bg-brand-500 text-white rounded-xl disabled:opacity-40 hover:bg-brand-600 transition-colors shrink-0"
                      >
                        {replySending
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Send size={14} />
                        }
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                      <Lock size={8} className="shrink-0" />
                      Private · not posted to the group
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
