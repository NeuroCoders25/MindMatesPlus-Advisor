import React, { useState, useEffect, useRef } from 'react';
import { Send, MessagesSquare, ShieldAlert, Loader2, Users, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import {
  ensureAdvisorRoomMembership,
  listenToAdvisorRoomMessages,
  listenToAdvisorRoomMembers,
  sendAdvisorRoomMessage,
  AdvisorRoomMessage,
  AdvisorMember,
} from '../lib/advisorRoom';
import { cn } from '../lib/utils';

function formatTime(ts: any): string {
  if (!ts) return '';
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

function renderMessageText(text: string) {
  const parts = text.split(/(@[^\s]+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="text-brand-500 font-semibold bg-brand-50 rounded px-0.5">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function AdvisorRoom() {
  const { currentUser, advisorProfile } = useAuth();
  const [messages, setMessages] = useState<AdvisorRoomMessage[]>([]);
  const [members, setMembers] = useState<AdvisorMember[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    ensureAdvisorRoomMembership(currentUser.uid).then(() => setReady(true));
  }, [currentUser]);

  useEffect(() => {
    if (!ready) return;
    const unsub1 = listenToAdvisorRoomMessages(setMessages);
    const unsub2 = listenToAdvisorRoomMembers(setMembers);
    return () => { unsub1(); unsub2(); };
  }, [ready]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    const cursorPos = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([^\s@]*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (member: AdvisorMember) => {
    const inputEl = inputRef.current;
    const cursorPos = inputEl?.selectionStart ?? text.length;
    const textBeforeCursor = text.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([^\s@]*)$/);
    if (!match) return;
    const start = cursorPos - match[0].length;
    const newText = text.slice(0, start) + `@${member.name} ` + text.slice(cursorPos);
    setText(newText);
    setMentionQuery(null);
    setTimeout(() => {
      inputEl?.focus();
      const pos = start + member.name.length + 2;
      inputEl?.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !currentUser || !advisorProfile || sending) return;
    setSending(true);
    setText('');
    setMentionQuery(null);
    try {
      await sendAdvisorRoomMessage(
        currentUser.uid,
        advisorProfile.name,
        advisorProfile.role,
        trimmed,
        advisorProfile.profileImageUrl
      );
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const filteredMentionMembers = mentionQuery !== null
    ? members.filter((m) =>
        m.uid !== currentUser?.uid &&
        m.name.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];

  if (!ready) {
    return (
      <div className="h-[calc(100vh-140px)] flex items-center justify-center bg-white rounded-3xl border border-slate-200">
        <Loader2 className="text-brand-500 animate-spin" size={40} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[calc(100vh-140px)] flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="px-8 py-5 border-b border-slate-100 flex items-center gap-4 shrink-0">
        <div className="w-11 h-11 rounded-2xl bg-brand-500 flex items-center justify-center shadow-sm shrink-0">
          <MessagesSquare size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Advisor Collaboration Room</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            A shared space for advisors to coordinate and discuss general support approaches.
          </p>
        </div>
        <button
          onClick={() => setShowMembers((v) => !v)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border',
            showMembers
              ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          )}
        >
          <Users size={15} />
          <span>{members.length}</span>
        </button>
      </div>

      {/* Body: chat + members panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main chat area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Privacy banner */}
          <div className="mx-6 mt-4 mb-2 flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl shrink-0">
            <ShieldAlert size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
              Keep discussions professional. Do not share identifiable or sensitive user details.
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-size-[20px_20px] custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center select-none">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-slate-200 flex items-center justify-center mb-5 border border-slate-100">
                  <MessagesSquare className="text-brand-500" size={30} />
                </div>
                <h2 className="text-base font-bold text-slate-700 mb-1">No messages yet.</h2>
                <p className="text-sm text-slate-400">Start the advisor discussion.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg) => {
                  const isMe = msg.senderId === currentUser?.uid;
                  const initials = getInitials(msg.senderName);

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, scale: 0.96, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className={cn('flex w-full gap-2.5', isMe ? 'justify-end' : 'justify-start')}
                    >
                      {!isMe && (
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs shrink-0 self-end mb-1 overflow-hidden">
                          {msg.senderPhotoUrl ? (
                            <img src={msg.senderPhotoUrl} alt={msg.senderName} className="w-full h-full object-cover" />
                          ) : (
                            initials
                          )}
                        </div>
                      )}

                      <div className={cn('max-w-[65%] group flex flex-col', isMe ? 'items-end' : 'items-start')}>
                        {!isMe && (
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 ml-1">
                            {msg.senderName}
                            {msg.senderRole ? ` · ${msg.senderRole}` : ''}
                          </span>
                        )}

                        <div
                          className={cn(
                            'px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed',
                            isMe
                              ? 'bg-brand-500 text-white rounded-tr-none'
                              : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                          )}
                        >
                          {renderMessageText(msg.text)}
                        </div>

                        <span className="text-[10px] text-slate-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>

                      {isMe && (
                        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-xs shrink-0 self-end mb-1 overflow-hidden">
                          {advisorProfile?.profileImageUrl ? (
                            <img src={advisorProfile.profileImageUrl} alt={advisorProfile.name} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(advisorProfile?.name ?? 'A')
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="px-6 py-5 border-t border-slate-100 bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                {/* @ mention dropdown */}
                <AnimatePresence>
                  {mentionQuery !== null && filteredMentionMembers.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-full mb-2 left-0 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50"
                    >
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-4 pt-3 pb-1">
                        Mention a member
                      </p>
                      {filteredMentionMembers.map((member) => (
                        <button
                          key={member.uid}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); insertMention(member); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs shrink-0 overflow-hidden">
                            {member.profileImageUrl ? (
                              <img src={member.profileImageUrl} alt={member.name} className="w-full h-full object-cover" />
                            ) : (
                              getInitials(member.name)
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{member.name}</p>
                            <p className="text-[10px] text-slate-400">{member.role}</p>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setMentionQuery(null);
                  }}
                  placeholder="Type a message... Use @ to mention"
                  disabled={sending}
                  className="w-full pl-5 pr-12 py-3.5 bg-slate-50 border border-transparent focus:bg-white focus:border-brand-200 rounded-2xl outline-none text-sm transition-all shadow-inner disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-brand-500 hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-all"
                >
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Members panel */}
        <AnimatePresence>
          {showMembers && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="border-l border-slate-100 bg-slate-50 flex flex-col overflow-hidden shrink-0"
            >
              <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-slate-500" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Members · {members.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowMembers(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-1 custom-scrollbar">
                {members.map((member) => {
                  const isMe = member.uid === currentUser?.uid;
                  return (
                    <div
                      key={member.uid}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white rounded-xl mx-2 transition-colors cursor-default"
                    >
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs overflow-hidden">
                          {member.profileImageUrl ? (
                            <img src={member.profileImageUrl} alt={member.name} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(member.name)
                          )}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-slate-50 rounded-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">
                          {member.name}
                          {isMe && <span className="text-[10px] text-brand-400 font-normal ml-1">(you)</span>}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{member.role}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
