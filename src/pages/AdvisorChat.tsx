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
  Paperclip
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

interface Admin {
  id: string;
  name: string;
  status?: string;
  color?: string;
  role?: string;
  email?: string;
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
}

export default function AdvisorChat() {
  const { currentUser, advisorProfile } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [admins, setAdmins] = useState<Record<string, Admin>>({});
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch all admins
  useEffect(() => {
    const q = query(collection(db, 'admins'), orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const adminMap: Record<string, Admin> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (doc.id !== currentUser?.uid) {
          adminMap[doc.id] = {
            id: doc.id,
            name: data.name || 'Anonymous',
            status: data.status || 'ONLINE',
            color: 'bg-brand-500',
            role: data.role || 'Admin',
            email: data.email
          };
        }
      });
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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList: Chat[] = [];
      snapshot.forEach((doc) => {
        chatList.push({ id: doc.id, ...doc.data() } as Chat);
      });
      setChats(chatList);

      // If we have a selected chat, update it with fresh data
      if (selectedChat) {
        const updated = chatList.find(c => c.id === selectedChat.id);
        if (updated) setSelectedChat(updated);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

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

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgList: Message[] = [];
      const unreadIds: string[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const msg = {
          id: doc.id,
          messageText: data.messageText || data.text || '',
          senderId: data.senderId,
          senderRole: data.senderRole || '',
          receiverId: data.receiverId || '',
          messageType: data.messageType || 'text',
          createdAt: data.createdAt || data.timestamp,
          isRead: data.isRead || false
        } as Message;
        msgList.push(msg);

        // Mark admin messages as read
        if (msg.senderRole === 'admin' && !msg.isRead) {
          unreadIds.push(doc.id);
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
    });

    return () => unsubscribe();
  }, [selectedChat, currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !currentUser) return;

    const adminId = selectedChat.participants.find(id => id !== currentUser.uid);
    if (!adminId) return;

    const chatId = selectedChat.id;
    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      const chatRef = doc(db, 'privateChats', chatId);
      const messageData = {
        senderId: currentUser.uid,
        senderRole: "advisor",
        receiverId: adminId,
        messageText,
        messageType: "text",
        createdAt: serverTimestamp(),
        isRead: false
      };

      await addDoc(collection(db, 'privateChats', chatId, 'messages'), messageData);

      await updateDoc(chatRef, {
        lastMessage: messageText,
        lastMessageSenderId: currentUser.uid,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message:", error);
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
      <div className="h-[calc(100vh-140px)] flex items-center justify-center bg-white rounded-3xl border border-slate-200">
        <Loader2 className="text-brand-500 animate-spin" size={40} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[calc(100vh-140px)] flex bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"
    >
      {/* Left Sidebar: Admin List */}
      <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Admin Chats</h1>
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

        <div className="flex-1 overflow-y-auto px-3 pb-6 custom-scrollbar">
          <div className="space-y-1">
            {sortedAdmins.map((admin) => {
              const chat = chats.find(c => c.participants.includes(admin.id));
              const isSelected = selectedChat?.participants.includes(admin.id);

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
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg relative shadow-sm shrink-0",
                    admin.color || 'bg-brand-500'
                  )}>
                    {admin.name.charAt(0).toLowerCase()}
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full bg-green-500"
                    )} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className={cn(
                        "text-sm font-bold truncate",
                        isSelected ? "text-slate-900" : "text-slate-600 group-hover:text-slate-900"
                      )}>
                        {admin.name}
                      </p>
                      {chat?.lastMessageAt && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatTime(chat.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    {chat?.lastMessage ? (
                      <p className="text-xs text-slate-500 truncate mt-0.5 font-medium">
                        {chat.lastMessage}
                      </p>
                    ) : (
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">
                        {admin.role || 'Admin'}
                      </p>
                    )}
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
      <div className="flex-1 flex flex-col bg-white relative">
        {selectedChat && selectedChatAdmin ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm",
                  selectedChatAdmin.color || 'bg-brand-500'
                )}>
                  {selectedChatAdmin.name.charAt(0).toLowerCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedChatAdmin.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{selectedChatAdmin.status || 'ONLINE'}</span>
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
                    return (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        key={msg.id}
                        className={cn(
                          "flex w-full",
                          isMe ? "justify-end" : "justify-start"
                        )}
                      >
                        <div className={cn(
                          "max-w-[70%] group",
                          isMe ? "items-end" : "items-start"
                        )}>
                          <div className={cn(
                            "px-4 py-2.5 rounded-2xl shadow-sm relative",
                            isMe
                              ? "bg-brand-500 text-white rounded-tr-none"
                              : "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
                          )}>
                            <p className="text-sm leading-relaxed">{msg.messageText}</p>
                          </div>
                          <p className={cn(
                            "text-[10px] font-medium mt-1 text-slate-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                            isMe ? "justify-end" : "justify-start"
                          )}>
                            {formatTime(msg.createdAt)}
                            {isMe && <ShieldCheck size={10} className="text-brand-400" />}
                          </p>
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
