import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Search, Users, RefreshCw,
  AlertTriangle, CheckCircle, X, XCircle, Send, Loader2, Lock,
  Sparkles, ShieldAlert, Brain, CornerUpLeft,
} from 'lucide-react';
import ChatViewer from '../components/ChatViewer';
import ReplyPreview from '../components/ReplyPreview';
import QuotedMessage from '../components/QuotedMessage';
import { PeerGroup, LiveChatMessage, AdvisorPrivateMessage, ReplyTo } from '../types';
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
  limit,
} from 'firebase/firestore';
import {
  generateGroupSummary,
  detectConflict,
  generateAIPrivateReply,
} from '../lib/groq';
import { encryptText, decryptBatch, safeText, EncryptedMessage } from '../services/cryptoService';

const GROUPS_COLLECTION = 'peer_groups';
const MESSAGES_SUBCOLLECTION = 'chatMessages';
const PRIVATE_THREAD_SUBCOLLECTION = 'privateThread';

// Keyword pre-filter before calling the AI — avoids unnecessary API calls
const CONFLICT_KEYWORDS = [
  'hate you', 'shut up', 'kill yourself', 'kys', 'idiot', 'loser',
  'worthless', 'go away', 'you\'re stupid', 'you are stupid', 'nobody cares',
  'fight me', 'i hate', 'stop talking', 'you\'re annoying', 'you are annoying',
  'nobody likes', 'leave me alone', 'freak', 'pathetic',
];

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
    replyTo: (data.replyTo as ReplyTo | undefined | null) ?? null,
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
    replyTo: (data.replyTo as ReplyTo | undefined | null) ?? null,
  };
}

interface ConflictAlert {
  id: string;
  severity: 'medium' | 'high';
  reason: string;
  triggerMessageText: string;
  detectedAt: Date | null;
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

  // Flagged message panel
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

  // ── AI: Feature 2 — Chat summary ──────────────────────────────────────────
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);

  // ── AI: Feature 3 — Conflict alerts ───────────────────────────────────────
  const [conflictAlerts, setConflictAlerts] = useState<ConflictAlert[]>([]);

  // ── AI: Feature 1 — Suggested private reply ───────────────────────────────
  const [aiReplyLoading, setAiReplyLoading] = useState(false);
  const [aiReplySuggestion, setAiReplySuggestion] = useState<string | null>(null);

  // Reply-to state for the public group composer
  const [replyingToGroupMsg, setReplyingToGroupMsg] = useState<LiveChatMessage | null>(null);
  // Reply-to state for the private thread composer
  const [replyingToPrivateMsg, setReplyingToPrivateMsg] = useState<AdvisorPrivateMessage | null>(null);

  // Tracks which message IDs we've already run conflict detection on
  const lastCheckedMsgRef = useRef<Set<string>>(new Set());
  const conflictInitializedRef = useRef(false);

  const privateMsgsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    privateMsgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [privateMessages]);

  // Reset all AI state and reply state when group changes
  useEffect(() => {
    lastCheckedMsgRef.current = new Set();
    conflictInitializedRef.current = false;
    setSummary(null);
    setSummaryVisible(false);
    setAiReplySuggestion(null);
    setReplyingToGroupMsg(null);
  }, [selectedGroup?.id]);

  // Pending flagged counts badge for group list
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

  // Fetch peer groups assigned to this advisor
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
      },
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

    let inFlightMsgs = false;
    const unsubscribe = onSnapshot(
      q,
      async (snap) => {
        if (inFlightMsgs) return;
        inFlightMsgs = true;
        try {
          const rawDocs = snap.docs;
          const rawData = rawDocs.map((d) => d.data() as Record<string, unknown>);

          // Interim: set crash-safe state immediately so React never sees raw objects
          setMessages(rawDocs.map((d, i) => {
            const rawReplyTo = rawData[i].replyTo as Record<string, unknown> | undefined | null;
            return parseMessage(d.id, {
              ...rawData[i],
              text: safeText(rawData[i].text ?? rawData[i].message ?? rawData[i].content),
              replyTo: rawReplyTo
                ? { ...rawReplyTo, snippet: safeText(rawReplyTo.snippet) }
                : null,
            });
          }));
          setLoadingMessages(false);
          setConnected(true);

          const texts = rawData.map(
            (d) => (d.text ?? d.message ?? d.content ?? '') as EncryptedMessage | string,
          );
          const snippets = rawData.map(
            (d) => ((d.replyTo as Record<string, unknown> | undefined)?.snippet ?? '') as EncryptedMessage | string,
          );
          const decrypted = await decryptBatch([...texts, ...snippets]);
          const n = rawDocs.length;
          const fetched: LiveChatMessage[] = rawDocs.map((d, i) => {
            const rawReplyTo = rawData[i].replyTo as Record<string, unknown> | undefined | null;
            const data: Record<string, unknown> = {
              ...rawData[i],
              text: decrypted[i],
              replyTo: rawReplyTo
                ? {
                    messageId: rawReplyTo.messageId as string,
                    snippet: decrypted[n + i],
                    senderName: rawReplyTo.senderName as string,
                    senderId: rawReplyTo.senderId as string,
                  }
                : null,
            };
            return parseMessage(d.id, data);
          });
          setMessages(fetched);
          setSelectedFlaggedMsg(prev => {
            if (!prev) return null;
            return fetched.find(m => m.id === prev.id) ?? prev;
          });
        } finally {
          inFlightMsgs = false;
        }
      },
      (err) => {
        console.error('Error fetching messages:', err);
        getDocs(messagesRef)
          .then(async (snap) => {
            const rawDocs = snap.docs;
            const rawData = rawDocs.map((d) => d.data() as Record<string, unknown>);
            const texts = rawData.map(
              (d) => (d.text ?? d.message ?? d.content ?? '') as EncryptedMessage | string,
            );
            const snippets = rawData.map(
              (d) => ((d.replyTo as Record<string, unknown> | undefined)?.snippet ?? '') as EncryptedMessage | string,
            );
            const decrypted = await decryptBatch([...texts, ...snippets]);
            const n = rawDocs.length;
            setMessages(rawDocs.map((d, i) => {
              const rawReplyTo = rawData[i].replyTo as Record<string, unknown> | undefined | null;
              const data: Record<string, unknown> = {
                ...rawData[i],
                text: decrypted[i],
                replyTo: rawReplyTo
                  ? {
                      messageId: rawReplyTo.messageId as string,
                      snippet: decrypted[n + i],
                      senderName: rawReplyTo.senderName as string,
                      senderId: rawReplyTo.senderId as string,
                    }
                  : null,
              };
              return parseMessage(d.id, data);
            }));
          })
          .catch(() => setError('Could not load messages.'));
        setLoadingMessages(false);
        setConnected(false);
      },
    );
    return () => unsubscribe();
  }, [selectedGroup?.id]);

  // Private thread listener for the flagged message panel
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
    let inFlightThread = false;
    const unsubscribe = onSnapshot(q, async (snap) => {
      if (inFlightThread) return;
      inFlightThread = true;
      try {
        const rawDocs = snap.docs;
        const rawData = rawDocs.map((d) => d.data() as Record<string, unknown>);

        // Interim: crash-safe placeholder state
        setPrivateMessages(rawDocs.map((d, i) => {
          const rawReplyTo = rawData[i].replyTo as Record<string, unknown> | undefined | null;
          return parsePrivateMessage(d.id, {
            ...rawData[i],
            text: safeText(rawData[i].text),
            replyTo: rawReplyTo
              ? { ...rawReplyTo, snippet: safeText(rawReplyTo.snippet) }
              : null,
          });
        }));

        const texts = rawData.map((d) => (d.text ?? '') as EncryptedMessage | string);
        const snippets = rawData.map(
          (d) => ((d.replyTo as Record<string, unknown> | undefined)?.snippet ?? '') as EncryptedMessage | string,
        );
        const decrypted = await decryptBatch([...texts, ...snippets]);
        const n = rawDocs.length;
        setPrivateMessages(
          rawDocs.map((d, i) => {
            const rawReplyTo = rawData[i].replyTo as Record<string, unknown> | undefined | null;
            const data: Record<string, unknown> = {
              ...rawData[i],
              text: decrypted[i],
              replyTo: rawReplyTo
                ? {
                    messageId: rawReplyTo.messageId as string,
                    snippet: decrypted[n + i],
                    senderName: rawReplyTo.senderName as string,
                    senderId: rawReplyTo.senderId as string,
                  }
                : null,
            };
            return parsePrivateMessage(d.id, data);
          }),
        );
      } finally {
        inFlightThread = false;
      }
    }, (err) => {
      console.error('Error fetching private thread:', err);
    });
    return () => unsubscribe();
  }, [selectedFlaggedMsg?.id, selectedGroup?.id, currentUser?.uid]);

  // ── Feature 3: Conflict alert Firestore listener ──────────────────────────
  useEffect(() => {
    if (!selectedGroup) {
      setConflictAlerts([]);
      return;
    }
    const q = query(
      collection(db, GROUPS_COLLECTION, selectedGroup.id, 'conflictAlerts'),
      orderBy('detectedAt', 'desc'),
      limit(10),
    );
    const unsub = onSnapshot(q, snap => {
      setConflictAlerts(
        snap.docs
          .map(d => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              severity: (data.severity as 'medium' | 'high') ?? 'medium',
              reason: (data.reason as string) ?? '',
              triggerMessageText: (data.triggerMessageText as string) ?? '',
              detectedAt: toDate(data.detectedAt),
              status: (data.status as string) ?? 'pending',
            };
          })
          .filter(a => a.status === 'pending')
          .slice(0, 3) as ConflictAlert[],
      );
    }, err => console.error('Conflict alerts listener error:', err));
    return () => unsub();
  }, [selectedGroup?.id]);

  // ── Feature 3: Real-time conflict detection on new messages ───────────────
  useEffect(() => {
    if (!selectedGroup || messages.length === 0) return;

    // First run after group load: seed the checked set, don't analyze old messages
    if (!conflictInitializedRef.current) {
      messages.forEach(m => lastCheckedMsgRef.current.add(m.id));
      conflictInitializedRef.current = true;
      return;
    }

    // Find messages that arrived after the initial load
    const unchecked = messages.filter(
      m => !lastCheckedMsgRef.current.has(m.id) && m.text.trim() !== '' && !m.deletedByAdvisor,
    );
    if (unchecked.length === 0) return;

    // Mark all as seen immediately to prevent duplicate checks
    unchecked.forEach(m => lastCheckedMsgRef.current.add(m.id));

    // Only run AI on the most recent new message to limit API calls
    const latest = unchecked[unchecked.length - 1];
    const lower = latest.text.toLowerCase();
    if (!CONFLICT_KEYWORDS.some(k => lower.includes(k))) return;

    const context = messages.slice(-7, -1).map(m => ({ senderName: m.senderName, text: m.text }));

    detectConflict(context, { senderName: latest.senderName, text: latest.text })
      .then(result => {
        if (!result.isConflict || result.severity === 'low') return;
        return addDoc(
          collection(db, GROUPS_COLLECTION, selectedGroup.id, 'conflictAlerts'),
          {
            severity: result.severity,
            reason: result.reason,
            triggerMessageId: latest.id,
            triggerMessageText: latest.text,
            detectedAt: serverTimestamp(),
            status: 'pending',
          },
        );
      })
      .catch(err => console.error('Conflict detection error:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, selectedGroup?.id]);

  // ── Handlers ──────────────────────────────────────────────────────────────

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
    setAiReplySuggestion(null);
    setReplyingToPrivateMsg(null);
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
      const encryptedReply = await encryptText(replyText.trim());
      let replyToField = null;
      if (replyingToPrivateMsg) {
        replyToField = {
          messageId: replyingToPrivateMsg.id,
          snippet: await encryptText(replyingToPrivateMsg.text.slice(0, 80)),
          senderName: replyingToPrivateMsg.senderName,
          senderId: replyingToPrivateMsg.senderId,
        };
      }
      await addDoc(privateThreadRef, {
        senderId:          currentUser.uid,
        senderName:        advisorProfile?.name ?? 'Advisor',
        senderRole:        'advisor',
        receiverId:        selectedFlaggedMsg.senderId,
        receiverName:      selectedFlaggedMsg.senderName,
        text:              encryptedReply,
        timestamp:         serverTimestamp(),
        isPrivate:         true,
        threadType:        'advisor_private_reply',
        flaggedMessageRef: selectedFlaggedMsg.id,
        visibleTo:         [currentUser.uid, selectedFlaggedMsg.senderId],
        ...(replyToField ? { replyTo: replyToField } : {}),
      });
      setReplyText('');
      setReplyingToPrivateMsg(null);
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
      const encryptedPublic = await encryptText(publicMessageText.trim());
      let replyToField = null;
      if (replyingToGroupMsg) {
        replyToField = {
          messageId: replyingToGroupMsg.id,
          snippet: await encryptText(replyingToGroupMsg.text.slice(0, 80)),
          senderName: replyingToGroupMsg.senderName,
          senderId: replyingToGroupMsg.senderId,
        };
      }
      await addDoc(messagesRef, {
        senderId:   currentUser.uid,
        senderName: advisorProfile?.name ?? 'Advisor',
        text:       encryptedPublic,
        timestamp:  serverTimestamp(),
        isFlagged:  false,
        ...(replyToField ? { replyTo: replyToField } : {}),
      });
      setPublicMessageText('');
      setReplyingToGroupMsg(null);
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
        deletedByAdvisor:     true,
        deletedByAdvisorName: advisorProfile?.name ?? 'Advisor',
        deletedByAdvisorAt:   serverTimestamp(),
      });
      if (selectedFlaggedMsg?.id === msg.id) setSelectedFlaggedMsg(null);
    } catch (err) {
      console.error('Error deleting message:', err);
    } finally {
      setDeletingMsgId(null);
    }
  };

  // ── AI handlers ───────────────────────────────────────────────────────────

  const handleGenerateSummary = async () => {
    if (!selectedGroup || messages.length === 0) return;
    setSummaryLoading(true);
    setSummaryVisible(true);
    setSummary(null);
    try {
      const recentMsgs = messages
        .filter(m => !m.deletedByAdvisor && m.text.trim() !== '')
        .slice(-30)
        .map(m => ({ senderName: m.senderName, text: m.text }));
      const result = await generateGroupSummary(recentMsgs);
      setSummary(result);
      // Persist so advisor can review later
      await addDoc(collection(db, GROUPS_COLLECTION, selectedGroup.id, 'chatSummaries'), {
        content:      result,
        generatedAt:  serverTimestamp(),
        generatedBy:  'ai',
        advisorId:    currentUser?.uid,
        messageCount: recentMsgs.length,
      });
    } catch (err) {
      console.error('Summary generation error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setSummary(`Error: ${msg}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleAISuggestReply = async () => {
    if (!selectedFlaggedMsg) return;
    setAiReplyLoading(true);
    setAiReplySuggestion(null);
    try {
      const suggestion = await generateAIPrivateReply(
        selectedFlaggedMsg.text,
        selectedFlaggedMsg.senderName,
      );
      setAiReplySuggestion(suggestion);
    } catch (err) {
      console.error('AI reply suggestion error:', err);
    } finally {
      setAiReplyLoading(false);
    }
  };

  const handleUseAISuggestion = () => {
    if (!aiReplySuggestion) return;
    setReplyText(aiReplySuggestion);
    setPanelTab('chat');
    setAiReplySuggestion(null);
  };

  const handleAcknowledgeConflict = async (alertId: string) => {
    if (!selectedGroup) return;
    try {
      await updateDoc(
        doc(db, GROUPS_COLLECTION, selectedGroup.id, 'conflictAlerts', alertId),
        {
          status:           'acknowledged',
          acknowledgedBy:   currentUser?.uid,
          acknowledgedAt:   serverTimestamp(),
        },
      );
    } catch (err) {
      console.error('Error acknowledging conflict:', err);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const visibleMessages = messages.filter(msg => {
    if (msg.deletedByAdvisor) return true;
    if (!msg.isFlagged) return true;
    if (reviewFilter === 'all') return true;
    const status = msg.reviewStatus ?? (msg.advisorApproved ? 'approved' : 'pending');
    return status === reviewFilter;
  });

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────

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
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 shrink-0">
          {error}
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">

        {/* ── Group list ──────────────────────────────────────────────── */}
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

        {/* ── Chat panel ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {selectedGroup ? (
            <>
              {/* Group header */}
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
                  {/* Feature 2: AI Summary button */}
                  <button
                    onClick={handleGenerateSummary}
                    disabled={summaryLoading || messages.length === 0}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 rounded-xl transition-colors disabled:opacity-40"
                  >
                    {summaryLoading
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Brain size={13} />
                    }
                    AI Summary
                  </button>
                </div>
              </div>

              {/* Feature 2: AI Summary panel */}
              <AnimatePresence>
                {summaryVisible && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="glass-card overflow-hidden shrink-0"
                  >
                    <div className="p-4 border-b border-violet-100 bg-violet-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Brain size={15} className="text-violet-600" />
                        <span className="text-sm font-bold text-violet-700">AI Chat Summary</span>
                        {summaryLoading && <Loader2 size={12} className="animate-spin text-violet-400" />}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleGenerateSummary}
                          disabled={summaryLoading || messages.length === 0}
                          className="p-1.5 text-violet-400 hover:text-violet-600 hover:bg-violet-100 rounded-lg transition-colors disabled:opacity-40"
                          title="Regenerate"
                        >
                          <RefreshCw size={13} />
                        </button>
                        <button
                          onClick={() => setSummaryVisible(false)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="p-4">
                      {summaryLoading && !summary ? (
                        <div className="flex items-center gap-2 text-violet-400 text-sm">
                          <Loader2 size={14} className="animate-spin" />
                          Analysing the last {Math.min(messages.length, 30)} messages…
                        </div>
                      ) : summary ? (
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{summary}</p>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Conversation card */}
              <div className="flex-1 glass-card flex flex-col overflow-hidden min-h-0">
                <div className="p-6 pb-3 shrink-0">
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    Conversation
                    {loadingMessages && <RefreshCw size={12} className="animate-spin text-slate-400" />}
                  </h4>

                  {/* Feature 3: Conflict alert banners */}
                  <AnimatePresence>
                    {conflictAlerts.map(alert => (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className={cn(
                          'mb-3 rounded-xl border px-3 py-2.5 flex items-start gap-2.5',
                          alert.severity === 'high'
                            ? 'bg-red-50 border-red-200'
                            : 'bg-amber-50 border-amber-200',
                        )}
                      >
                        <ShieldAlert
                          size={14}
                          className={cn(
                            'mt-0.5 shrink-0',
                            alert.severity === 'high' ? 'text-red-500' : 'text-amber-500',
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={cn(
                              'text-[10px] font-bold uppercase tracking-wide',
                              alert.severity === 'high' ? 'text-red-600' : 'text-amber-600',
                            )}>
                              {alert.severity === 'high' ? 'High' : 'Medium'}-severity conflict detected
                            </span>
                            {alert.detectedAt && (
                              <span className="text-[10px] text-slate-400">· {formatTime(alert.detectedAt)}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 leading-snug">{alert.reason}</p>
                          {alert.triggerMessageText && (
                            <p className="text-[10px] text-slate-400 mt-1 truncate">
                              Trigger: "{alert.triggerMessageText}"
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleAcknowledgeConflict(alert.id)}
                          className={cn(
                            'text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 transition-colors',
                            alert.severity === 'high'
                              ? 'text-red-600 hover:bg-red-100'
                              : 'text-amber-600 hover:bg-amber-100',
                          )}
                        >
                          Acknowledge
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

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
                    onReply={(msg) => setReplyingToGroupMsg(msg)}
                  />
                </div>

                <div className="p-4 border-t border-slate-100 shrink-0">
                  {replyingToGroupMsg && (
                    <ReplyPreview
                      senderName={replyingToGroupMsg.senderName}
                      snippet={replyingToGroupMsg.text}
                      onCancel={() => setReplyingToGroupMsg(null)}
                    />
                  )}
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
                    Visible to all group members · posting as{' '}
                    <span className="font-semibold text-slate-500">{advisorProfile?.name ?? 'Advisor'}</span>
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

        {/* ── Flagged message action panel ─────────────────────────────── */}
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
                      "{safeText(selectedFlaggedMsg.text)}"
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

                  {/* Feature 1: AI Assistance — suggest private reply */}
                  <div className="bg-violet-50/60 border border-violet-100 rounded-2xl p-4">
                    <h6 className="text-xs font-bold text-violet-700 mb-3 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-violet-500" />
                      AI Assistance
                    </h6>
                    {aiReplySuggestion ? (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wide">Suggested reply</p>
                        <div className="bg-white border border-violet-200 rounded-xl px-3 py-2.5">
                          <p className="text-xs text-slate-700 leading-relaxed">{aiReplySuggestion}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleUseAISuggestion}
                            className="flex-1 text-xs font-bold py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl transition-colors"
                          >
                            Use This Reply
                          </button>
                          <button
                            onClick={() => setAiReplySuggestion(null)}
                            className="px-3 text-xs font-bold text-slate-400 hover:text-slate-600 border border-slate-200 rounded-xl transition-colors"
                          >
                            Discard
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleAISuggestReply}
                        disabled={aiReplyLoading}
                        className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 border border-violet-300 text-violet-600 hover:bg-violet-100 rounded-xl transition-colors disabled:opacity-50"
                      >
                        {aiReplyLoading
                          ? <><Loader2 size={13} className="animate-spin" /> Generating…</>
                          : <><Sparkles size={13} /> Suggest Private Reply</>
                        }
                      </button>
                    )}
                    <p className="text-[10px] text-slate-400 mt-2">
                      AI drafts an empathetic reply. Review and edit before sending.
                    </p>
                  </div>

                </div>
              )}

              {/* Private chat tab */}
              {panelTab === 'chat' && (
                <div className="flex-1 flex flex-col overflow-hidden">

                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 shrink-0 flex items-center gap-1.5">
                    <Lock size={9} className="text-amber-600 shrink-0" />
                    <p className="text-[10px] text-amber-700">
                      Only you and{' '}
                      <span className="font-bold">{selectedFlaggedMsg.senderName}</span>{' '}
                      can see these messages.
                    </p>
                  </div>

                  <div className="mx-3 mt-3 mb-1 shrink-0 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle size={10} className="text-red-500 shrink-0" />
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Flagged message · context</span>
                    </div>
                    <p className="text-xs text-red-800 font-medium leading-snug line-clamp-3">
                      "{safeText(selectedFlaggedMsg.text)}"
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
                          <div
                            id={`msg-${msg.id}`}
                            key={msg.id}
                            className={cn('group flex flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-semibold text-slate-400 px-1">
                                {isMe ? (advisorProfile?.name ?? 'You') : msg.senderName}
                              </span>
                              <button
                                onClick={() => setReplyingToPrivateMsg(msg)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-300 hover:text-indigo-500 rounded"
                                title="Reply"
                              >
                                <CornerUpLeft size={10} />
                              </button>
                            </div>
                            <div className={cn(
                              'max-w-[85%] px-3 py-2 rounded-2xl text-xs shadow-sm',
                              isMe
                                ? 'bg-brand-500 text-white rounded-tr-sm'
                                : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                            )}>
                              {msg.replyTo && (
                                <QuotedMessage
                                  replyTo={msg.replyTo}
                                  onScrollTo={(id) => {
                                    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }}
                                  variant={isMe ? 'light' : 'default'}
                                />
                              )}
                              <p className="leading-relaxed">{safeText(msg.text)}</p>
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

                  <div className="p-3 border-t border-slate-100 bg-white shrink-0">
                    {replyingToPrivateMsg && (
                      <ReplyPreview
                        senderName={replyingToPrivateMsg.senderName}
                        snippet={replyingToPrivateMsg.text}
                        onCancel={() => setReplyingToPrivateMsg(null)}
                      />
                    )}
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
