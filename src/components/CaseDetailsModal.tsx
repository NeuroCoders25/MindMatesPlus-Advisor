import React, { useState, useEffect, useRef } from 'react';
import {
  X, MessageSquare, Send, ShieldCheck, CheckCircle2,
  AlertCircle, Clock, Tag, ExternalLink, Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { AdvisorConnection, CaseMessage, RiskLevel } from '../types';
import {
  fetchCaseUserProfile,
  markCaseReviewed,
  listenToCaseMessages,
  sendAdvisorCaseMessage,
  markUserMessagesAsRead,
  approveUserForNormalAccess,
  updateUserWellnessScoreByAdvisor,
  APPROVED_CATEGORIES,
} from '../lib/advisorConnections';
import { cn } from '../lib/utils';
import UserDetailsModal from './UserDetailsModal';

interface CaseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: AdvisorConnection;
}

function formatTimestamp(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const d = new Date((value as { seconds: number }).seconds * 1000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const s = String(value);
  return s === 'undefined' || s === 'null' || s === '' ? '—' : s;
}

function formatTime(ts: unknown): string {
  if (!ts) return '';
  try {
    const d =
      ts instanceof Timestamp
        ? ts.toDate()
        : new Date((ts as { seconds: number }).seconds * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatPercentValue(value: unknown, multiplyBy100 = false): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  const finalValue = multiplyBy100 ? value * 100 : value;
  return `${finalValue.toFixed(1)}%`;
}

function categoryToRiskLevel(category: string): RiskLevel {
  const c = (category ?? '').toLowerCase();
  if (c.includes('critical') || c.includes('severe') || c.includes('extremely')) return 'Critical';
  if (c.includes('high') || c.includes('moderate')) return 'High';
  if (c.includes('medium') || c.includes('mild')) return 'Medium';
  return 'High';
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-emerald-100 text-emerald-700',
  approved: 'bg-green-100 text-green-700',
};

export default function CaseDetailsModal({ isOpen, onClose, connection }: CaseDetailsModalProps) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);
  const [approvedCategory, setApprovedCategory] = useState<string>('Moderate Support');
  const [advisorNote, setAdvisorNote] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [userProfile, setUserProfile] = useState<Record<string, unknown>>({});
  const [userDoc, setUserDoc] = useState<Record<string, unknown>>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [isFullProfileOpen, setIsFullProfileOpen] = useState(false);
  const [wellnessInput, setWellnessInput] = useState('');
  const [wellnessNote, setWellnessNote] = useState('');
  const [updatingWellness, setUpdatingWellness] = useState(false);
  const [wellnessSuccess, setWellnessSuccess] = useState(false);
  const [wellnessError, setWellnessError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !connection.userId) return;
    setProfileLoading(true);
    setUserProfile({});
    setUserDoc({});
    fetchCaseUserProfile(connection.userId)
      .then(({ user, profile }) => {
        setUserDoc(user);
        setUserProfile(profile);
      })
      .catch(console.error)
      .finally(() => setProfileLoading(false));
  }, [isOpen, connection.userId]);

  // Sync wellness input when profile loads or score is updated externally
  useEffect(() => {
    const score = userProfile.wellnessScore;
    if (typeof score === 'number') {
      setWellnessInput(String(score));
    }
  }, [userProfile.wellnessScore]);

  useEffect(() => {
    if (!isOpen || !connection.id) {
      setMessages([]);
      return;
    }
    return listenToCaseMessages(connection.id, setMessages);
  }, [isOpen, connection.id]);

  useEffect(() => {
    if (!isOpen || !connection.id) return;
    markUserMessagesAsRead(connection.id).catch(console.error);
  }, [isOpen, connection.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setNewMessage('');
      setApproveSuccess(false);
      setApprovedCategory('Moderate Support');
      setAdvisorNote('');
      setWellnessInput('');
      setWellnessNote('');
      setWellnessSuccess(false);
      setWellnessError('');
    }
  }, [isOpen, connection.id]);

  async function handleApprove() {
    if (!currentUser || !approvedCategory || isApproved) return;
    setApproving(true);
    try {
      await approveUserForNormalAccess(
        connection.id,
        connection.userId,
        currentUser.uid,
        approvedCategory,
        advisorNote.trim() || undefined
      );
      setApproveSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      console.error('Error approving case:', err);
    } finally {
      setApproving(false);
    }
  }

  async function handleMarkReviewed() {
    setReviewing(true);
    try {
      await markCaseReviewed(connection.id, connection.userId);
      onClose();
    } catch (err) {
      console.error('Error marking reviewed:', err);
    } finally {
      setReviewing(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;
    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);
    try {
      await sendAdvisorCaseMessage(connection.id, currentUser.uid, connection.userId, text);
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  }

  async function handleUpdateWellnessScore() {
    const parsed = parseInt(wellnessInput, 10);
    if (!currentUser || isNaN(parsed) || parsed < 0 || parsed > 100) {
      setWellnessError('Enter a valid score between 0 and 100.');
      return;
    }
    setUpdatingWellness(true);
    setWellnessSuccess(false);
    setWellnessError('');
    try {
      await updateUserWellnessScoreByAdvisor(
        connection.userId,
        currentUser.uid,
        parsed,
        wellnessScore,
        wellnessNote.trim() || undefined
      );
      setUserProfile((prev) => ({ ...prev, wellnessScore: parsed }));
      setWellnessSuccess(true);
      setWellnessNote('');
    } catch (err) {
      console.error('Error updating wellness score:', err);
      setWellnessError('Failed to update score. Please try again.');
    } finally {
      setUpdatingWellness(false);
    }
  }

  // Resolve nickname in order: connection doc → user doc → mentalHealthProfile subcollection.
  // userDoc may be unreadable due to Firestore advisor rules, so fallback to profile subcollection.
  const nickName =
    connection.nickName ||
    ((userDoc.nickname ?? userDoc.nickName ?? userDoc.anonymousName ??
      userProfile.nickname ?? userProfile.nickName) as string | undefined) ||
    'Anonymous';

  const isApproved = connection.status === 'approved' || approveSuccess;
  const statusLabel = connection.status.charAt(0).toUpperCase() + connection.status.slice(1);
  const statusStyle = STATUS_STYLES[connection.status] ?? 'bg-slate-100 text-slate-600';
  const riskLevel = categoryToRiskLevel(connection.userMentalHealthCategory);

  const classificationLevel = userProfile.classificationLevel ?? userProfile.activeRecommendationCategory;
  const depressionScore = userProfile.depressionScore as number | undefined;
  const anxietyScore = userProfile.anxietyScore as number | undefined;
  const stressScore = userProfile.stressScore as number | undefined;
  const baselineCategory = userProfile.baselineRecommendationCategory as string | undefined;
  const userStatus = userProfile.userStatus as string | undefined;

  const wellnessScore =
    typeof userProfile.wellnessScore === 'number' ? userProfile.wellnessScore : null;

  const latestMlEmotionData = userProfile.latestMlEmotionScore;
  const mlConfidence: number | null =
    latestMlEmotionData !== null && typeof latestMlEmotionData === 'object'
      ? (typeof (latestMlEmotionData as Record<string, unknown>).confidence === 'number'
          ? ((latestMlEmotionData as Record<string, unknown>).confidence as number)
          : null)
      : typeof latestMlEmotionData === 'number'
      ? latestMlEmotionData
      : null;

  const hasProfileSummary =
    !profileLoading &&
    (classificationLevel || depressionScore != null || wellnessScore != null || mlConfidence != null || baselineCategory || userStatus);

  return (
    <>
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
            className="relative flex w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
            style={{ maxHeight: '90vh' }}
          >
            {/* ── Left Panel: Case Details ── */}
            <div className="w-72 shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col overflow-y-auto">
              <div className="p-5 border-b border-slate-200 shrink-0">
                <h2 className="text-base font-bold text-slate-800">Case Details</h2>
              </div>

              <div className="p-5 flex flex-col gap-4 flex-1">
                {/* Avatar + Identity */}
                <div className="flex flex-col items-center gap-2.5 py-2">
                  <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 font-bold text-3xl shadow-sm">
                    {nickName.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-800">{nickName}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                      #{connection.id.slice(-8).toUpperCase()}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyle}`}>
                    {statusLabel}
                  </span>
                </div>

                {/* Detail tiles */}
                <div className="space-y-2">
                  {connection.userMentalHealthCategory && (
                    <div className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 border border-slate-100">
                      <Tag size={13} className="text-brand-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">Category</p>
                        <p className="text-sm font-semibold text-slate-700 capitalize truncate">
                          {connection.userMentalHealthCategory}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5 bg-white rounded-xl px-3 py-2.5 border border-slate-100">
                    <AlertCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">Reason</p>
                      <p className="text-sm text-slate-700 leading-relaxed break-words">
                        {connection.reason || 'No reason provided'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 border border-slate-100">
                    <Clock size={13} className="text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">Connected</p>
                      <p className="text-sm font-semibold text-slate-700">
                        {formatTimestamp(connection.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Profile Summary */}
                {profileLoading && (
                  <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
                )}

                {hasProfileSummary && (
                  <div className="bg-brand-50 rounded-xl p-3.5 border border-brand-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity size={13} className="text-brand-500" />
                      <p className="text-[10px] font-bold text-brand-700 uppercase tracking-widest">
                        Profile Summary
                      </p>
                    </div>
                    <div className="space-y-2">
                      {classificationLevel && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">Classification</span>
                          <span className="text-[10px] font-bold capitalize text-slate-700 bg-white px-2 py-0.5 rounded-full border border-slate-100">
                            {String(classificationLevel)}
                          </span>
                        </div>
                      )}
                      {baselineCategory && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-500 shrink-0">Baseline</span>
                          <span className="text-[10px] font-bold capitalize text-slate-700 truncate text-right">
                            {baselineCategory}
                          </span>
                        </div>
                      )}
                      {(wellnessScore !== null || mlConfidence !== null) && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">
                            {wellnessScore !== null ? 'Wellness Score' : 'ML Confidence'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-700">
                            {wellnessScore !== null
                              ? `${wellnessScore}%`
                              : formatPercentValue(mlConfidence, true)}
                          </span>
                        </div>
                      )}
                      {userStatus && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">User Status</span>
                          <span className="text-[10px] font-bold capitalize text-slate-700">
                            {userStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                      )}
                      {(depressionScore !== undefined ||
                        anxietyScore !== undefined ||
                        stressScore !== undefined) && (
                        <div className="flex gap-2 mt-1 pt-1 border-t border-brand-100">
                          {depressionScore !== undefined && (
                            <div className="flex-1 bg-white rounded-lg p-2 text-center border border-slate-100">
                              <p className="text-[8px] text-slate-400">Dep</p>
                              <p className="text-xs font-bold text-slate-700">{depressionScore}</p>
                            </div>
                          )}
                          {anxietyScore !== undefined && (
                            <div className="flex-1 bg-white rounded-lg p-2 text-center border border-slate-100">
                              <p className="text-[8px] text-slate-400">Anx</p>
                              <p className="text-xs font-bold text-slate-700">{anxietyScore}</p>
                            </div>
                          )}
                          {stressScore !== undefined && (
                            <div className="flex-1 bg-white rounded-lg p-2 text-center border border-slate-100">
                              <p className="text-[8px] text-slate-400">Str</p>
                              <p className="text-xs font-bold text-slate-700">{stressScore}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Wellness Score Update */}
                {!profileLoading && (
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5">
                    <div className="flex items-center gap-2 mb-2.5">
                      <Activity size={13} className="text-indigo-400" />
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                        Mental Wellness Score
                      </p>
                    </div>
                    {wellnessScore !== null && (
                      <p className="text-xs text-slate-500 mb-2">
                        Current:{' '}
                        <span className="font-bold text-slate-700">{wellnessScore}%</span>
                        {wellnessScore < 10 && (
                          <span className="ml-1.5 text-[10px] font-semibold text-red-500">
                            Restricted
                          </span>
                        )}
                      </p>
                    )}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={wellnessInput}
                      onChange={(e) => {
                        setWellnessInput(e.target.value);
                        setWellnessSuccess(false);
                        setWellnessError('');
                      }}
                      placeholder="0 – 100"
                      className="w-full text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-300 transition-colors mb-2"
                    />
                    <textarea
                      value={wellnessNote}
                      onChange={(e) => setWellnessNote(e.target.value)}
                      placeholder="Reason for score update (optional)…"
                      rows={2}
                      className="w-full text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-300 transition-colors resize-none placeholder-slate-300 mb-2"
                    />
                    {wellnessSuccess && (
                      <p className="text-[10px] text-emerald-600 font-semibold mb-1.5 flex items-center gap-1">
                        <CheckCircle2 size={11} />
                        Mental wellness score updated successfully.
                      </p>
                    )}
                    {wellnessError && (
                      <p className="text-[10px] text-red-500 font-semibold mb-1.5">
                        {wellnessError}
                      </p>
                    )}
                    <button
                      onClick={handleUpdateWellnessScore}
                      disabled={updatingWellness || !wellnessInput.trim()}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs transition-all"
                    >
                      <Activity size={13} />
                      {updatingWellness ? 'Updating…' : 'Update Wellness Score'}
                    </button>
                  </div>
                )}

                {/* Approval Section */}
                <div className="mt-auto space-y-2.5 pt-2">
                  {approveSuccess && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-2.5 rounded-xl">
                      <CheckCircle2 size={14} className="shrink-0" />
                      User approved successfully.
                    </div>
                  )}

                  {!isApproved && (
                    <>
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                          Approved Category
                        </label>
                        <select
                          value={approvedCategory}
                          onChange={(e) => setApprovedCategory(e.target.value)}
                          className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-brand-300 transition-colors"
                        >
                          {APPROVED_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                          Advisor Note <span className="normal-case font-normal">(optional)</span>
                        </label>
                        <textarea
                          value={advisorNote}
                          onChange={(e) => setAdvisorNote(e.target.value)}
                          placeholder="Add a note about this approval…"
                          rows={2}
                          className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-brand-300 transition-colors resize-none placeholder-slate-300"
                        />
                      </div>
                    </>
                  )}

                  <button
                    onClick={handleApprove}
                    disabled={isApproved || approving || !currentUser || !approvedCategory}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all',
                      isApproved
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
                        : 'bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-60 disabled:cursor-not-allowed'
                    )}
                  >
                    <ShieldCheck size={15} />
                    {approving ? 'Approving…' : isApproved ? 'Approved' : 'Approve & Accept'}
                  </button>

                  <button
                    onClick={() => setIsFullProfileOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all"
                  >
                    <ExternalLink size={14} />
                    View Full Profile
                  </button>
                </div>
              </div>
            </div>

            {/* ── Right Panel: Chat ── */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                    <MessageSquare size={17} className="text-brand-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Intervention Chat</p>
                    <p className="text-[10px] text-slate-400">
                      Direct conversation with{' '}
                      <span className="font-semibold text-brand-500">{nickName}</span>
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
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn('flex', isAdvisor ? 'justify-end' : 'justify-start')}
                      >
                        <div className={cn('max-w-[75%]', isAdvisor ? 'items-end' : 'items-start')}>
                          <p
                            className={cn(
                              'text-[10px] font-bold uppercase tracking-wide mb-1',
                              isAdvisor ? 'text-right text-brand-400' : 'text-left text-slate-400'
                            )}
                          >
                            {isAdvisor ? 'ADVISOR' : nickName.split(' ')[0].toUpperCase()}{' '}
                            <span className="font-normal normal-case tracking-normal">
                              {formatTime(msg.createdAt)}
                            </span>
                          </p>
                          <div
                            className={cn(
                              'px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm',
                              isAdvisor
                                ? 'bg-brand-500 text-white rounded-tr-sm'
                                : 'bg-slate-100 text-slate-700 rounded-tl-sm'
                            )}
                          >
                            {msg.messageText}
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
                  onClick={handleMarkReviewed}
                  disabled={reviewing}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 size={14} className="text-slate-300" />
                  {reviewing ? 'Saving…' : 'Mark Conversation as Reviewed'}
                </button>
              </div>

              {/* Message Input */}
              <form onSubmit={handleSend} className="px-5 pb-4 shrink-0">
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
                    disabled={!newMessage.trim() || sending}
                    className="w-8 h-8 bg-brand-500 hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all shrink-0"
                  >
                    <Send size={14} className="text-white" />
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 text-center mt-2 uppercase tracking-widest font-semibold">
                  Messages are stored in case records
                </p>
              </form>
            </div>
          </motion.div>
        </div>
      )}

    </AnimatePresence>

      <UserDetailsModal
        isOpen={isFullProfileOpen}
        onClose={() => setIsFullProfileOpen(false)}
        userId={connection.userId}
        userName={nickName}
        riskLevel={riskLevel}
      />
    </>
  );
}
