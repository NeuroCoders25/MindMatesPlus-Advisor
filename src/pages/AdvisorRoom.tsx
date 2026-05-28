import React, { useState, useEffect, useRef } from 'react';
import { Send, MessagesSquare, ShieldAlert, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import {
  ensureAdvisorRoomMembership,
  listenToAdvisorRoomMessages,
  sendAdvisorRoomMessage,
  AdvisorRoomMessage,
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

export default function AdvisorRoom() {
  const { currentUser, advisorProfile } = useAuth();
  const [messages, setMessages] = useState<AdvisorRoomMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    ensureAdvisorRoomMembership(currentUser.uid).then(() => setReady(true));
  }, [currentUser]);

  useEffect(() => {
    if (!ready) return;
    return listenToAdvisorRoomMessages(setMessages);
  }, [ready]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !currentUser || !advisorProfile || sending) return;

    setSending(true);
    setText('');
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
        <div>
          <h1 className="text-xl font-bold text-slate-800">Advisor Collaboration Room</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            A shared space for advisors to coordinate and discuss general support approaches.
          </p>
        </div>
      </div>

      {/* Privacy banner */}
      <div className="mx-6 mt-4 mb-2 flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl shrink-0">
        <ShieldAlert size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700 font-medium leading-relaxed">
          Keep discussions professional. Do not share identifiable or sensitive user details.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] custom-scrollbar">
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
                  {/* Avatar — other advisors */}
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
                    {/* Sender name */}
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
                      {msg.text}
                    </div>

                    <span className="text-[10px] text-slate-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>

                  {/* Avatar — current user */}
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
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
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
    </motion.div>
  );
}
