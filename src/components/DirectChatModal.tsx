import React, { useState, useEffect, useRef } from 'react';
import { X, MessageSquare, Send, ShieldCheck, CheckCircle2, CornerUpLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Case } from '../types';
import { encryptText, decryptBatch, safeText, EncryptedMessage } from '../services/cryptoService';
import RiskBadge from './RiskBadge';
import { cn } from '../lib/utils';
import ReplyPreview from './ReplyPreview';
import QuotedMessage from './QuotedMessage';
import { ReplyTo } from '../types';

interface DirectChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: Case;
  onViewProfile: () => void;
}

interface Message {
  id: string;
  messageText: string;
  senderId: string;
  senderRole: string;
  createdAt: any;
  isRead: boolean;
  replyTo?: ReplyTo | null;
}

export default function DirectChatModal({ isOpen, onClose, caseData, onViewProfile }: DirectChatModalProps) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [aiValidation, setAiValidation] = useState<'approved' | 'disapproved' | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToMessage = (id: string) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMsgId(id);
    setTimeout(() => setHighlightedMsgId(null), 1500);
  };

  const chatId = currentUser ? `advisor_${currentUser.uid}_user_${caseData.userId}` : null;

  // Ensure chat document exists in Firestore
  useEffect(() => {
    if (!isOpen || !currentUser || !chatId) return;
    const chatRef = doc(db, 'privateChats', chatId);
    getDoc(chatRef).then((snap) => {
      if (!snap.exists()) {
        setDoc(chatRef, {
          chatType: 'advisor_user',
          participants: [currentUser.uid, caseData.userId],
          participantRoles: { [currentUser.uid]: 'advisor', [caseData.userId]: 'user' },
          lastMessage: '',
          lastMessageAt: serverTimestamp(),
          lastMessageSenderId: '',
          updatedAt: serverTimestamp(),
        }).catch(console.error);
      }
    }).catch(console.error);
  }, [isOpen, currentUser, chatId, caseData.userId]);

  // Real-time messages listener
  useEffect(() => {
    if (!isOpen || !chatId) {
      setMessages([]);
      return;
    }
    const q = query(collection(db, 'privateChats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    let inFlight = false;
    const unsub = onSnapshot(q, async (snap) => {
      if (inFlight) return;
      inFlight = true;
      try {
        const rawDocs = snap.docs;
        const rawData = rawDocs.map((d) => d.data());

        // Interim: crash-safe placeholder state immediately
        setMessages(rawDocs.map((d, i) => {
          const rawReplyTo = rawData[i].replyTo as Record<string, unknown> | undefined | null;
          return {
            id: d.id,
            messageText: safeText(rawData[i].messageText ?? rawData[i].text),
            senderId: rawData[i].senderId || '',
            senderRole: rawData[i].senderRole || '',
            createdAt: rawData[i].createdAt || rawData[i].timestamp,
            isRead: rawData[i].isRead || false,
            replyTo: rawReplyTo
              ? { messageId: rawReplyTo.messageId as string, snippet: safeText(rawReplyTo.snippet), senderName: rawReplyTo.senderName as string, senderId: rawReplyTo.senderId as string }
              : null,
          };
        }));

        const texts = rawData.map(
          (d) => (d.messageText ?? d.text ?? '') as EncryptedMessage | string,
        );
        const snippets = rawData.map(
          (d) => ((d.replyTo as Record<string, unknown> | undefined)?.snippet ?? '') as EncryptedMessage | string,
        );
        const decrypted = await decryptBatch([...texts, ...snippets]);
        const n = rawDocs.length;
        setMessages(rawDocs.map((d, i) => {
          const rawReplyTo = rawData[i].replyTo as Record<string, unknown> | undefined | null;
          return {
            id: d.id,
            messageText: decrypted[i],
            senderId: rawData[i].senderId || '',
            senderRole: rawData[i].senderRole || '',
            createdAt: rawData[i].createdAt || rawData[i].timestamp,
            isRead: rawData[i].isRead || false,
            replyTo: rawReplyTo
              ? {
                  messageId: rawReplyTo.messageId as string,
                  snippet: decrypted[n + i],
                  senderName: rawReplyTo.senderName as string,
                  senderId: rawReplyTo.senderId as string,
                }
              : null,
          };
        }));
      } finally {
        inFlight = false;
      }
    });
    return unsub;
  }, [isOpen, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset state when modal opens with a new case
  useEffect(() => {
    if (isOpen) {
      setAiValidation(null);
      setReviewed(false);
      setNewMessage('');
      setReplyingTo(null);
    }
  }, [isOpen, caseData.userId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !chatId) return;
    const text = newMessage.trim();
    const pendingReply = replyingTo;
    setNewMessage('');
    setReplyingTo(null);
    try {
      const chatRef = doc(db, 'privateChats', chatId);
      const encrypted = await encryptText(text);
      let replyToField = null;
      if (pendingReply) {
        replyToField = {
          messageId: pendingReply.id,
          snippet: await encryptText(pendingReply.messageText.slice(0, 80)),
          senderName: pendingReply.senderRole === 'advisor' ? 'Advisor' : caseData.userName,
          senderId: pendingReply.senderId,
        };
      }
      await addDoc(collection(db, 'privateChats', chatId, 'messages'), {
        senderId: currentUser.uid,
        senderRole: 'advisor',
        receiverId: caseData.userId,
        messageText: encrypted,
        messageType: 'text',
        createdAt: serverTimestamp(),
        isRead: false,
        ...(replyToField ? { replyTo: replyToField } : {}),
      });
      await updateDoc(chatRef, {
        lastMessage: encrypted,
        lastMessageSenderId: currentUser.uid,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const formatTime = (ts: any) => {
    if (!ts) return '';
    const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative flex w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
            style={{ maxHeight: '85vh' }}
          >
            {/* Left Panel: Case Details */}
            <div className="w-60 shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col p-5 gap-4 overflow-y-auto">
              <h2 className="text-base font-bold text-slate-800">Case Details</h2>

              {/* Avatar + identity */}
              <div className="flex flex-col items-center gap-2.5 py-2">
                <div className="w-20 h-20 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-3xl shadow-sm">
                  {caseData.userName.charAt(0).toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-800 text-sm">{caseData.userName}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">ID: {caseData.userId.slice(0, 8).toUpperCase()}</p>
                </div>
                <RiskBadge level={caseData.riskLevel} />
              </div>

              {/* User System Approval */}
              <div className="border-t border-slate-200 pt-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  User System Approval
                </p>
                <div className="flex">
                  <button
                    onClick={() => setAiValidation('approved')}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-[11px] font-bold w-full',
                      aiValidation === 'approved'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50/50'
                    )}
                  >
                    <ShieldCheck size={16} className={aiValidation === 'approved' ? 'text-emerald-600' : 'text-slate-400'} />
                    Approve
                  </button>
                </div>
              </div>

              {/* View Full Profile */}
              <div className="mt-auto pt-2">
                <button
                  onClick={() => { onClose(); onViewProfile(); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold transition-colors text-sm"
                >
                  View Full Profile
                </button>
              </div>
            </div>

            {/* Right Panel: Chat */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Chat Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                    <MessageSquare size={17} className="text-brand-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Direct Intervention Chat</p>
                    <p className="text-[10px] text-slate-400">
                      Communicating as{' '}
                      <span className="font-semibold text-brand-500">Advisor Portal</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
                >
                  <X size={15} className="text-slate-500" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10">
                    <MessageSquare size={34} className="text-slate-200 mb-3" />
                    <p className="text-sm font-semibold text-slate-400">No messages yet</p>
                    <p className="text-xs text-slate-300 mt-1 max-w-[18rem]">
                      Send a supportive message to start this intervention.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAdvisor = msg.senderRole === 'advisor';
                    const isHighlighted = highlightedMsgId === msg.id;
                    return (
                      <motion.div
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'flex group',
                          isAdvisor ? 'justify-end' : 'justify-start',
                          isHighlighted && 'ring-2 ring-indigo-400 ring-offset-2 rounded-2xl'
                        )}
                      >
                        <div className={cn('max-w-[75%]', isAdvisor ? 'items-end' : 'items-start')}>
                          <div className={cn(
                            'flex items-center gap-1.5 mb-1',
                            isAdvisor ? 'justify-end' : 'justify-start'
                          )}>
                            <p className={cn(
                              'text-[10px] font-bold uppercase tracking-wide',
                              isAdvisor ? 'text-brand-400' : 'text-slate-400'
                            )}>
                              {isAdvisor ? 'ADVISOR' : 'USER'}{' '}
                              <span className="font-normal normal-case tracking-normal">{formatTime(msg.createdAt)}</span>
                            </p>
                            <button
                              onClick={() => setReplyingTo(msg)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-300 hover:text-indigo-500 rounded"
                              title="Reply"
                            >
                              <CornerUpLeft size={11} />
                            </button>
                          </div>
                          <div className={cn(
                            'px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm',
                            isAdvisor
                              ? 'bg-brand-500 text-white rounded-tr-sm'
                              : 'bg-slate-100 text-slate-700 rounded-tl-sm'
                          )}>
                            {msg.replyTo && (
                              <QuotedMessage
                                replyTo={msg.replyTo}
                                onScrollTo={scrollToMessage}
                                variant={isAdvisor ? 'light' : 'default'}
                              />
                            )}
                            {safeText(msg.messageText)}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Mark as Reviewed */}
              <div className="px-5 py-2 flex justify-center shrink-0">
                <button
                  onClick={() => setReviewed(true)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-semibold transition-colors',
                    reviewed ? 'text-emerald-600 cursor-default' : 'text-slate-400 hover:text-emerald-600'
                  )}
                >
                  <CheckCircle2 size={14} className={reviewed ? 'text-emerald-500' : 'text-slate-300'} />
                  {reviewed ? 'Marked as Reviewed' : 'Mark Conversation as Reviewed'}
                </button>
              </div>

              {/* Message Input */}
              <form onSubmit={handleSend} className="px-5 pb-4 shrink-0">
                {replyingTo && (
                  <ReplyPreview
                    senderName={replyingTo.senderRole === 'advisor' ? 'Advisor' : caseData.userName}
                    snippet={replyingTo.messageText}
                    onCancel={() => setReplyingTo(null)}
                  />
                )}
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a supportive message..."
                    className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="w-8 h-8 bg-brand-500 hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all shrink-0"
                  >
                    <Send size={14} className="text-white" />
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 text-center mt-2 uppercase tracking-widest font-semibold">
                  Chat session is encrypted and stored in case records
                </p>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
