import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Phone,
  Video,
  MoreVertical,
  Send,
  MessageSquare,
  User,
  ShieldCheck,
  Loader2,
  Paperclip,
  CornerUpLeft,
} from 'lucide-react';
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
  setDoc,
  getDoc,
  where,
  updateDoc,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { availabilityDotClass, availabilityLabel } from '../components/AvailabilitySelector';
import type { AvailabilityStatus } from '../context/AuthContext';
import { encryptText, decryptBatch, safeText, EncryptedMessage } from '../services/cryptoService';
import ReplyPreview from '../components/ReplyPreview';
import QuotedMessage from '../components/QuotedMessage';
import { ReplyTo } from '../types';

function normalizeAvailability(raw: unknown): AvailabilityStatus {
  const v = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (v === 'busy')    return 'busy';
  if (v === 'away')    return 'away';
  if (v === 'offline') return 'offline';
  return 'online';
}

interface Admin {
  id: string;
  name: string;
  availability: AvailabilityStatus;
  color?: string;
  role?: string;
  email?: string;
  profileImageUrl?: string;
}

interface Chat {
  id: string;
  chatType: 'admin_advisor';
  participants: string[];
  participantRoles: Record<string, string>;
  lastMessage: string;
  lastMessageAt: any;
  lastMessageSenderId: string;
  updatedAt: any;
  unreadCount?: number;
}

interface Message {
  id: string;
  messageText: string;
  senderId: string;
  senderRole: string;
  receiverId: string;
  messageType: string;
  createdAt: any;
  isRead: boolean;
  replyTo?: ReplyTo | null;
}

interface AdvisorChatProps {
  embedded?: boolean;
  initialAdminId?: string | null;
}

function getProfileImageUrl(data: Record<string, unknown>) {
  return (
    data.profileImageUrl ||
    data.profilePicture ||
    data.profile_picture ||
    data.photoURL ||
    data.avatarUrl ||
    data.avatar ||
    data.imageUrl ||
    data.image_url ||
    ''
  ) as string;
}

async function getAdminProfileImageUrl(adminId: string, data: Record<string, unknown>) {
  const directUrl = getProfileImageUrl(data);
  if (directUrl) return directUrl;

  const fallbackCollections = ['adminProfiles', 'admin', 'users', 'advisors'];
  for (const collectionName of fallbackCollections) {
    const snap = await getDoc(doc(db, collectionName, adminId)).catch(() => null);
    if (snap?.exists()) {
      const fallbackUrl = getProfileImageUrl(snap.data());
      if (fallbackUrl) return fallbackUrl;
    }
  }

  return '';
}

export default function AdvisorChat({ embedded = false, initialAdminId = null }: AdvisorChatProps) {
  const { currentUser, advisorProfile } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [admins, setAdmins] = useState<Record<string, Admin>>({});
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToMessage = (id: string) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMsgId(id);
    setTimeout(() => setHighlightedMsgId(null), 1500);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch all admins
  useEffect(() => {
    const q = query(collection(db, 'admins'), orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const adminMap: Record<string, Admin> = {};
      await Promise.all(snapshot.docs.map(async (adminDoc) => {
        const data = adminDoc.data();
        if (adminDoc.id !== currentUser?.uid) {
          adminMap[adminDoc.id] = {
            id: adminDoc.id,
            name: data.name || 'Anonymous',
            availability: normalizeAvailability(data.availability ?? data.status),
            color: 'bg-brand-500',
            role: data.role || 'Admin',
            email: data.email,
            profileImageUrl: await getAdminProfileImageUrl(adminDoc.id, data),
          };
        }
      }));
      setAdmins(adminMap);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch private chats
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'privateChats'),
      where('participants', 'array-contains', currentUser.uid),
      where('chatType', '==', 'admin_advisor'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatList: Chat[] = [];
      snapshot.forEach((doc) => {
        chatList.push({ id: doc.id, ...doc.data() } as Chat);
      });
      const lastMsgs = chatList.map(c => (c.lastMessage ?? '') as EncryptedMessage | string);
      const plains = await decryptBatch(lastMsgs);
      const decryptedList = chatList.map((c, i) => ({ ...c, lastMessage: plains[i] }));
      setChats(decryptedList);

      // If we have a selected chat, update it with fresh data
      if (selectedChat) {
        const updated = decryptedList.find(c => c.id === selectedChat.id);
        if (updated) setSelectedChat(updated);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!initialAdminId || !admins[initialAdminId]) return;
    if (selectedChat?.participants.includes(initialAdminId)) return;
    handleSelectAdmin(admins[initialAdminId]);
  }, [initialAdminId, admins, selectedChat]);

  // Fetch messages for selected chat
  useEffect(() => {
    if (!selectedChat || !currentUser) {
      setMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(db, 'privateChats', selectedChat.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    let inFlightMsgs = false;
    const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
      if (inFlightMsgs) return;
      inFlightMsgs = true;
      try {
        const rawDocs = [...snapshot.docs];
        const rawData = rawDocs.map((d) => d.data());

        // Interim: crash-safe placeholder state immediately
        setMessages(rawDocs.map((d, i) => {
          const rawReplyTo = rawData[i].replyTo as Record<string, unknown> | undefined | null;
          return {
            id: d.id,
            messageText: safeText(rawData[i].messageText ?? rawData[i].text),
            senderId: rawData[i].senderId,
            senderRole: rawData[i].senderRole || '',
            receiverId: rawData[i].receiverId || '',
            messageType: rawData[i].messageType || 'text',
            createdAt: rawData[i].createdAt || rawData[i].timestamp,
            isRead: rawData[i].isRead || false,
            replyTo: rawReplyTo
              ? { messageId: rawReplyTo.messageId as string, snippet: safeText(rawReplyTo.snippet), senderName: rawReplyTo.senderName as string, senderId: rawReplyTo.senderId as string }
              : null,
          } as Message;
        }));

        const texts = rawData.map(
          (d) => (d.messageText ?? d.text ?? '') as EncryptedMessage | string,
        );
        const snippets = rawData.map(
          (d) => ((d.replyTo as Record<string, unknown> | undefined)?.snippet ?? '') as EncryptedMessage | string,
        );
        const decrypted = await decryptBatch([...texts, ...snippets]);
        const n = rawDocs.length;
        const msgList: Message[] = [];
        const unreadIds: string[] = [];

        rawDocs.forEach((d, i) => {
          const data = rawData[i];
          const rawReplyTo = data.replyTo as Record<string, unknown> | undefined | null;
          const msg: Message = {
            id: d.id,
            messageText: decrypted[i],
            senderId: data.senderId,
            senderRole: data.senderRole || '',
            receiverId: data.receiverId || '',
            messageType: data.messageType || 'text',
            createdAt: data.createdAt || data.timestamp,
            isRead: data.isRead || false,
            replyTo: rawReplyTo
              ? {
                  messageId: rawReplyTo.messageId as string,
                  snippet: decrypted[n + i],
                  senderName: rawReplyTo.senderName as string,
                  senderId: rawReplyTo.senderId as string,
                }
              : null,
          };
          msgList.push(msg);
          if (msg.senderRole === 'admin' && !msg.isRead) {
            unreadIds.push(d.id);
          }
        });
        setMessages(msgList);

        if (unreadIds.length > 0) {
          const batch = writeBatch(db);
          unreadIds.forEach((id) => {
            const msgRef = doc(db, 'privateChats', selectedChat.id, 'messages', id);
            batch.update(msgRef, { isRead: true });
          });
          batch.commit().catch(err => console.error("Error marking messages as read:", err));
        }
      } finally {
        inFlightMsgs = false;
      }
    });

    return () => unsubscribe();
  }, [selectedChat, currentUser]);

  // Track unread counts per chat (admin messages not yet read by this advisor)
  useEffect(() => {
    if (!currentUser || chats.length === 0) return;

    const unsubscribes = chats.map((chat) => {
      const q = query(
        collection(db, 'privateChats', chat.id, 'messages'),
        where('senderRole', '==', 'admin'),
        where('isRead', '==', false)
      );
      return onSnapshot(q, (snap) => {
        setUnreadCounts(prev => ({ ...prev, [chat.id]: snap.size }));
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [currentUser, chats]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !currentUser) return;

    const adminId = selectedChat.participants.find(id => id !== currentUser.uid);
    if (!adminId) return;

    const chatId = selectedChat.id;
    const messageText = newMessage.trim();
    const pendingReply = replyingTo;
    setNewMessage('');
    setReplyingTo(null);

    try {
      const chatRef = doc(db, 'privateChats', chatId);
      const encrypted = await encryptText(messageText);

      let replyToField = null;
      if (pendingReply) {
        const senderName =
          pendingReply.senderId === currentUser.uid
            ? (advisorProfile?.name ?? 'You')
            : (admins[pendingReply.senderId]?.name ?? 'Admin');
        replyToField = {
          messageId: pendingReply.id,
          snippet: await encryptText(pendingReply.messageText.slice(0, 80)),
          senderName,
          senderId: pendingReply.senderId,
        };
      }

      await addDoc(collection(db, 'privateChats', chatId, 'messages'), {
        senderId: currentUser.uid,
        senderRole: 'advisor',
        receiverId: adminId,
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
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSelectAdmin = async (admin: Admin) => {
    if (!currentUser) return;

    // Use adminId_advisorId as per requirement
    const chatId = `${admin.id}_${currentUser.uid}`;

    // Check if chat exists in our local list first
    const existingChat = chats.find(c => c.id === chatId);
    if (existingChat) {
      setSelectedChat(existingChat);
      return;
    }

    // Check Firestore for the chat
    const chatRef = doc(db, 'privateChats', chatId);
    const chatDoc = await getDoc(chatRef);

    if (chatDoc.exists()) {
      setSelectedChat({ id: chatDoc.id, ...chatDoc.data() } as Chat);
    } else {
      // Create new chat
      const newChat: Partial<Chat> = {
        chatType: 'admin_advisor',
        participants: [admin.id, currentUser.uid],
        participantRoles: {
          [admin.id]: 'admin',
          [currentUser.uid]: 'advisor'
        },
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: '',
        updatedAt: serverTimestamp()
      };
      await setDoc(chatRef, newChat);
      setSelectedChat({ id: chatId, ...newChat } as Chat);
    }
  };

  const sortedAdmins = Object.values(admins).filter(admin =>
    admin.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    const chatA = chats.find(c => c.participants.includes(a.id));
    const chatB = chats.find(c => c.participants.includes(b.id));

    if (chatA && chatB) {
      const timeA = chatA.updatedAt instanceof Timestamp ? chatA.updatedAt.toMillis() : (chatA.updatedAt?.seconds ? chatA.updatedAt.seconds * 1000 : 0);
      const timeB = chatB.updatedAt instanceof Timestamp ? chatB.updatedAt.toMillis() : (chatB.updatedAt?.seconds ? chatB.updatedAt.seconds * 1000 : 0);
      return timeB - timeA;
    }
    if (chatA) return -1;
    if (chatB) return 1;
    return a.name.localeCompare(b.name);
  });

  const selectedChatAdmin = selectedChat
    ? admins[selectedChat.participants.find(id => id !== currentUser?.uid) || '']
    : null;

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-white border border-slate-200',
          embedded ? 'h-[520px] rounded-2xl' : 'h-[calc(100vh-140px)] rounded-3xl'
        )}
      >
        <Loader2 className="text-brand-500 animate-spin" size={40} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex bg-white border border-slate-200 overflow-hidden shadow-sm',
        embedded
          ? 'h-[560px] flex-col rounded-2xl'
          : 'h-[calc(100vh-140px)] rounded-3xl'
      )}
    >
      {/* Left Sidebar: Admin List */}
      <div
        className={cn(
          'border-slate-100 flex flex-col bg-slate-50/50',
          embedded ? 'w-full max-h-56 border-b' : 'w-80 border-r'
        )}
      >
        <div className={cn('space-y-6', embedded ? 'p-4' : 'p-6')}>
          <div>
            <h1 className={cn('font-bold text-slate-800', embedded ? 'text-lg' : 'text-2xl')}>Admin Chats</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Admin Network</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search admins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-brand-400 rounded-xl outline-none text-sm transition-all shadow-sm"
            />
          </div>
        </div>

        <div className={cn('flex-1 overflow-y-auto px-3 custom-scrollbar', embedded ? 'pb-3' : 'pb-6')}>
          <div className="space-y-1">
            {sortedAdmins.map((admin) => {
              const chat = chats.find(c => c.participants.includes(admin.id));
              const isSelected = selectedChat?.participants.includes(admin.id);
              const unread = chat ? (unreadCounts[chat.id] ?? 0) : 0;

              return (
                <button
                  key={admin.id}
                  onClick={() => handleSelectAdmin(admin)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group",
                    isSelected
                      ? "bg-white shadow-md border border-slate-100"
                      : "hover:bg-white/60"
                  )}
                >
                  <div className="w-12 h-12 relative shrink-0">
                    <div className={cn(
                      "w-full h-full rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm overflow-hidden",
                      admin.color || 'bg-brand-500'
                    )}>
                      {admin.profileImageUrl ? (
                        <img
                          src={admin.profileImageUrl}
                          alt={admin.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        admin.name.charAt(0).toLowerCase()
                      )}
                    </div>
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full",
                      availabilityDotClass(admin.availability)
                    )} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className={cn(
                        "text-sm truncate",
                        unread > 0 ? "font-extrabold text-slate-900" : isSelected ? "font-bold text-slate-900" : "font-bold text-slate-600 group-hover:text-slate-900"
                      )}>
                        {admin.name}
                      </p>
                      {chat?.lastMessageAt && (
                        <span className={cn(
                          "text-[10px] font-medium shrink-0 ml-1",
                          unread > 0 ? "text-brand-500" : "text-slate-400"
                        )}>
                          {formatTime(chat.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      {chat?.lastMessage ? (
                        <p className={cn(
                          "text-xs truncate",
                          unread > 0 ? "font-semibold text-slate-700" : "font-medium text-slate-500"
                        )}>
                          {safeText(chat.lastMessage)}
                        </p>
                      ) : (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                          {admin.role || 'Admin'}
                        </p>
                      )}
                      {unread > 0 && (
                        <span className="ml-2 shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {sortedAdmins.length === 0 && (
              <div className="text-center py-10">
                <p className="text-sm text-slate-400">No admins found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Content: Chat Area */}
      <div className="flex-1 min-h-0 flex flex-col bg-white relative">
        {selectedChat && selectedChatAdmin ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm overflow-hidden",
                  selectedChatAdmin.color || 'bg-brand-500'
                )}>
                  {selectedChatAdmin.profileImageUrl ? (
                    <img
                      src={selectedChatAdmin.profileImageUrl}
                      alt={selectedChatAdmin.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    selectedChatAdmin.name.charAt(0).toLowerCase()
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedChatAdmin.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${availabilityDotClass(selectedChatAdmin.availability)}`} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{availabilityLabel(selectedChatAdmin.availability)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-xl transition-all">
                  <Phone size={20} />
                </button>
                <button className="p-2.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-xl transition-all">
                  <Video size={20} />
                </button>
                <button className="p-2.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-xl transition-all">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-slate-200 flex items-center justify-center mb-6 border border-slate-100">
                    <MessageSquare className="text-brand-500" size={32} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 mb-2">Secure Consultation</h2>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto">
                    This conversation is encrypted and private between you and the admin.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center mb-8">
                    <span className="px-4 py-1.5 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest shadow-sm">
                      Secure Channel
                    </span>
                  </div>
                  {messages.map((msg) => {
                    const isMe = msg.senderId === currentUser?.uid;
                    const isHighlighted = highlightedMsgId === msg.id;
                    return (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        className={cn(
                          'flex w-full',
                          isMe ? 'justify-end' : 'justify-start',
                          isHighlighted && 'ring-2 ring-indigo-400 ring-offset-2 rounded-2xl'
                        )}
                      >
                        <div className={cn(
                          'max-w-[70%] group',
                          isMe ? 'items-end' : 'items-start'
                        )}>
                          <div className={cn(
                            'px-4 py-2.5 rounded-2xl shadow-sm relative',
                            isMe
                              ? 'bg-brand-500 text-white rounded-tr-none'
                              : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                          )}>
                            {msg.replyTo && (
                              <QuotedMessage
                                replyTo={msg.replyTo}
                                onScrollTo={scrollToMessage}
                                variant={isMe ? 'light' : 'default'}
                              />
                            )}
                            <p className="text-sm leading-relaxed">{safeText(msg.messageText)}</p>
                          </div>
                          <div className={cn(
                            'flex items-center gap-2 mt-1',
                            isMe ? 'justify-end' : 'justify-start'
                          )}>
                            <p className="text-[10px] font-medium text-slate-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {formatTime(msg.createdAt)}
                              {isMe && <ShieldCheck size={10} className="text-brand-400" />}
                            </p>
                            <button
                              onClick={() => setReplyingTo(msg)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-300 hover:text-indigo-500 rounded"
                              title="Reply"
                            >
                              <CornerUpLeft size={12} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-6 border-t border-slate-100 bg-white">
              {replyingTo && (
                <ReplyPreview
                  senderName={
                    replyingTo.senderId === currentUser?.uid
                      ? (advisorProfile?.name ?? 'You')
                      : (admins[replyingTo.senderId]?.name ?? 'Admin')
                  }
                  snippet={replyingTo.messageText}
                  onCancel={() => setReplyingTo(null)}
                />
              )}
              <div className="flex items-center gap-3">
                <button type="button" className="p-2.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-xl transition-all">
                  <Paperclip size={20} />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Share your thoughts..."
                    className="w-full pl-6 pr-12 py-3.5 bg-slate-50 border-transparent focus:bg-white focus:border-brand-200 rounded-2xl outline-none text-sm transition-all shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-brand-500 hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-all"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400">Select an admin to start chatting</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
