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
  getDoc
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
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: any;
}

export default function AdvisorChat() {
  const { currentUser, advisorProfile } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
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
      const adminList: Admin[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (doc.id !== currentUser?.uid) { // Don't show current user in the list
          adminList.push({
            id: doc.id,
            name: data.name || 'Anonymous',
            status: 'ONLINE',
            color: 'bg-brand-500',
            role: data.role || 'Admin'
          });
        }
      });
      setAdmins(adminList);
      if (adminList.length > 0 && !selectedAdmin) {
        setSelectedAdmin(adminList[0]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch messages for selected chat
  useEffect(() => {
    if (!selectedAdmin || !currentUser) return;

    const chatId = [currentUser.uid, selectedAdmin.id].sort().join('_');
    const messagesQuery = query(
      collection(db, 'advisor_chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgList: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgList.push({
          id: doc.id,
          text: data.text,
          senderId: data.senderId,
          timestamp: data.timestamp
        });
      });
      setMessages(msgList);
    });

    return () => unsubscribe();
  }, [selectedAdmin, currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedAdmin || !currentUser) return;

    const chatId = [currentUser.uid, selectedAdmin.id].sort().join('_');
    const chatRef = doc(db, 'advisor_chats', chatId);
    
    // Ensure chat document exists
    await setDoc(chatRef, {
      lastMessage: newMessage,
      lastTimestamp: serverTimestamp(),
      users: [currentUser.uid, selectedAdmin.id]
    }, { merge: true });

    await addDoc(collection(db, 'advisor_chats', chatId, 'messages'), {
      text: newMessage,
      senderId: currentUser.uid,
      senderName: advisorProfile?.name || 'Admin',
      timestamp: serverTimestamp()
    });

    setNewMessage('');
  };

  const filteredAdmins = admins.filter(admin => 
    admin.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            {filteredAdmins.map((admin) => (
              <button
                key={admin.id}
                onClick={() => setSelectedAdmin(admin)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group",
                  selectedAdmin?.id === admin.id 
                    ? "bg-white shadow-md border border-slate-100" 
                    : "hover:bg-white/60"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg relative shadow-sm",
                  admin.color || 'bg-brand-500'
                )}>
                  {admin.name.charAt(0).toLowerCase()}
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full bg-green-500"
                  )} />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-bold truncate",
                    selectedAdmin?.id === admin.id ? "text-slate-900" : "text-slate-600 group-hover:text-slate-900"
                  )}>
                    {admin.name}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    {admin.status || 'ONLINE'}
                  </p>
                </div>
              </button>
            ))}
            {filteredAdmins.length === 0 && (
              <div className="text-center py-10">
                <p className="text-sm text-slate-400">No admins found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Content: Chat Area */}
      <div className="flex-1 flex flex-col bg-white relative">
        {selectedAdmin ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm",
                  selectedAdmin.color || 'bg-brand-500'
                )}>
                  {selectedAdmin.name.charAt(0).toLowerCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedAdmin.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{selectedAdmin.status || 'ONLINE'}</span>
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
                            <p className="text-sm leading-relaxed">{msg.text}</p>
                          </div>
                          <p className={cn(
                            "text-[10px] font-medium mt-1 text-slate-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                            isMe ? "justify-end" : "justify-start"
                          )}>
                            {formatTime(msg.timestamp)}
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
