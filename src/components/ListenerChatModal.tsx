import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, MessageCircle, Send, CheckCircle2, Clock, Users, Headphones,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { AdvisorConnection, CaseMessage } from '../types';
import {
  listenToActiveListenerChats,
  listenToCaseMessages,
  sendAdvisorCaseMessage,
  markUserMessagesAsRead,
  markCaseReviewed,
} from '../lib/advisorConnections';
import { safeText } from '../services/cryptoService';

function formatTime(value: unknown): string {
  if (!value || typeof value !== 'object' || !('seconds' in value)) return '';
  const d = new Date((value as { seconds: number }).seconds * 1000);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value: unknown): string {
  if (!value || typeof value !== 'object' || !('seconds' in value)) return '—';
  const d = new Date((value as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialConnectionId?: string;
}

export default function ListenerChatModal({ isOpen, onClose, initialConnectionId }: Props) {
  const { currentUser } = useAuth();

  const [chats, setChats] = useState<AdvisorConnection[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-select when a specific connection is provided (on open or when id changes)
  useEffect(() => {
    if (initialConnectionId) setSelectedId(initialConnectionId);
  }, [initialConnectionId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedId(null);
      setMessages([]);
      setMessageText('');
    }
  }, [isOpen]);

  // Subscribe to active listener chats
  useEffect(() => {
    if (!isOpen || !currentUser) { setLoadingChats(false); return; }
    setLoadingChats(true);
    const unsub = listenToActiveListenerChats(
      currentUser.uid,
      (conns) => { setChats(conns); setLoadingChats(false); },
      () => setLoadingChats(false),
    );
    return unsub;
  }, [isOpen, currentUser]);

  // Subscribe to messages of selected chat
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    const unsub = listenToCaseMessages(selectedId, (msgs) => setMessages(msgs));
    markUserMessagesAsRead(selectedId).catch(() => {});
    return unsub;
  }, [selectedId]);

  // Mark incoming messages as read
  useEffect(() => {
    if (!selectedId || messages.length === 0) return;
    const hasUnread = messages.some((m) => m.senderRole === 'user' && !m.isRead);
    if (hasUnread) markUserMessagesAsRead(selectedId).catch(() => {});
  }, [messages, selectedId]);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!currentUser || !selectedId || !messageText.trim()) return;
    const chat = chats.find((c) => c.id === selectedId);
    if (!chat) return;
    setSending(true);
    try {
      await sendAdvisorCaseMessage(selectedId, currentUser.uid, chat.userId, messageText.trim());
      setMessageText('');
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  }, [currentUser, selectedId, messageText, chats]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMarkResolved = async () => {
    if (!selectedId) return;
    const chat = chats.find((c) => c.id === selectedId);
    if (!chat) return;
    if (!window.confirm('Mark this conversation as resolved and close it?')) return;
    setResolving(true);
    try {
      await markCaseReviewed(selectedId, chat.userId);
      setSelectedId(null);
    } finally {
      setResolving(false);
    }
  };

  const selectedChat = chats.find((c) => c.id === selectedId) ?? null;
  const displayName = selectedChat ? (selectedChat.nickName || selectedChat.userName || 'Unknown') : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative flex w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
            style={{ maxHeight: '90vh' }}
          >
            {/* ── Left: Conversation list ── */}
            <div className="w-72 shrink-0 flex flex-col bg-slate-50 border-r border-slate-200 overflow-hidden">
              <div className="px-4 py-4 border-b border-slate-200 flex items-center gap-2 shrink-0">
                <Headphones size={16} className="text-blue-500" />
                <h2 className="text-sm font-bold text-slate-800">Listener Chats</h2>
                {chats.length > 0 && (
                  <span className="ml-auto bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {chats.length}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingChats ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : chats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <Users size={32} className="text-slate-300 mb-3" />
                    <p className="text-sm text-slate-500 font-medium">No active chats</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Accept listener requests to start conversations.
                    </p>
                  </div>
                ) : (
                  chats.map((chat) => {
                    const name = chat.nickName || chat.userName || 'Unknown';
                    const initial = name.charAt(0).toUpperCase();
                    const isSelected = chat.id === selectedId;
                    return (
                      <button
                        key={chat.id}
                        onClick={() => setSelectedId(chat.id)}
                        className={[
                          'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-slate-100',
                          isSelected
                            ? 'bg-blue-50 border-l-2 border-l-blue-500'
                            : 'hover:bg-white border-l-2 border-l-transparent',
                        ].join(' ')}
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock size={10} />
                            {formatDate(chat.acceptedAt ?? chat.createdAt)}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Right: Chat area ── */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                {selectedChat ? (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{displayName}</p>
                      <p className="text-xs text-slate-400">Listener Support</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <MessageCircle size={18} className="text-blue-500" />
                    <p className="text-sm font-bold text-slate-800">Select a conversation</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {selectedChat && (
                    <button
                      onClick={handleMarkResolved}
                      disabled={resolving}
                      className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <CheckCircle2 size={13} />
                      {resolving ? 'Resolving…' : 'Mark Resolved'}
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                  >
                    <X size={15} className="text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
                {!selectedChat ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <MessageCircle size={44} className="text-slate-200 mb-3" />
                    <p className="text-sm font-semibold text-slate-400">No conversation selected</p>
                    <p className="text-xs text-slate-300 mt-1">
                      Choose a student from the list on the left to open the chat.
                    </p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <MessageCircle size={40} className="text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400 font-medium">No messages yet</p>
                    <p className="text-xs text-slate-300 mt-1">Say hello to get the conversation started.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAdvisor = msg.senderRole === 'advisor';
                    return (
                      <div key={msg.id} className={`flex ${isAdvisor ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={[
                            'max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                            isAdvisor
                              ? 'bg-blue-500 text-white rounded-tr-sm'
                              : 'bg-slate-100 text-slate-800 rounded-tl-sm',
                          ].join(' ')}
                        >
                          <p>{safeText(msg.messageText)}</p>
                          <p className={`text-xs mt-1 text-right ${isAdvisor ? 'text-blue-100' : 'text-slate-400'}`}>
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input — only shown when a chat is selected */}
              {selectedChat && (
                <div className="px-5 pb-5 shrink-0">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                      rows={1}
                      className="flex-1 resize-none bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-300 rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                    />
                    <button
                      onClick={handleSend}
                      disabled={sending || !messageText.trim()}
                      className="w-10 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl transition-colors shrink-0"
                      aria-label="Send message"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
