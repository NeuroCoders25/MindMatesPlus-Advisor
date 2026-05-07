import React, { useEffect, useState } from 'react';
import {
  X, User, Heart, ClipboardList, AlertTriangle, Clock,
  Mail, Calendar, Brain, Shield, Pill, Zap, Activity, MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { RiskLevel, MentalHealthProfile, UserDetails } from '../types';
import RiskBadge from './RiskBadge';
import { cn } from '../lib/utils';

function toDateString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'object' && 'seconds' in (value as object)) {
    try {
      const d = new Date((value as { seconds: number }).seconds * 1000);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return undefined;
    }
  }
  const s = String(value);
  return s === 'undefined' || s === 'null' || s === '' ? undefined : s;
}

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  riskLevel: RiskLevel;
  onOpenChat?: () => void;
}

function parseMentalHealthProfile(
  data: Record<string, unknown>,
  profileSubDoc?: Record<string, unknown>,
): MentalHealthProfile | undefined {
  // profileSubDoc (mentalHealthProfile/currentProfile) takes priority over nested object in user doc
  const raw = profileSubDoc ??
    (data.mentalHealthProfile ?? data.mentalHealth ?? data.healthProfile ?? {}) as Record<string, unknown>;

  const toStringArray = (v: unknown): string[] | undefined =>
    Array.isArray(v) ? (v as string[]) : typeof v === 'string' && v ? [v] : undefined;

  const profile: MentalHealthProfile = {
    diagnosis: toStringArray(raw.diagnosis ?? data.diagnosis),
    conditions: toStringArray(raw.conditions ?? data.conditions),
    riskFactors: toStringArray(raw.riskFactors ?? raw.risk_factors ?? data.riskFactors),
    currentState: toDateString(raw.currentState ?? raw.current_state ?? data.currentMood ?? data.mood) as string | undefined,
    moodScore: (raw.moodScore ?? raw.mood_score ?? data.moodScore) as number | undefined,
    lastAssessment: toDateString(raw.lastAssessment ?? raw.last_assessment ?? raw.updatedAt ?? data.lastAssessment),
    notes: (raw.notes ?? data.clinicalNotes) as string | undefined,
    medications: toStringArray(raw.medications ?? data.medications),
    triggers: toStringArray(raw.triggers ?? data.triggers),
    classificationLevel: (raw.classificationLevel ?? data.classificationLevel) as MentalHealthProfile['classificationLevel'],
    depressionScore: (raw.depressionScore ?? data.depressionScore) as number | undefined,
    anxietyScore: (raw.anxietyScore ?? data.anxietyScore) as number | undefined,
    stressScore: (raw.stressScore ?? data.stressScore) as number | undefined,
    totalScore: (raw.totalScore ?? data.totalScore) as number | undefined,
    groupCategory: (raw.groupCategory ?? data.groupCategory) as string | undefined,
  };

  return Object.values(profile).some((v) => v !== undefined) ? profile : undefined;
}

function parseUserDetails(
  id: string,
  data: Record<string, unknown>,
  profileSubDoc?: Record<string, unknown>,
): UserDetails {
  return {
    id,
    name: (data.name ?? data.displayName ?? data.userName ?? data.fullName) as string ?? 'Unknown',
    email: data.email as string | undefined,
    age: data.age as number | undefined,
    gender: data.gender as string | undefined,
    joinedDate: toDateString(data.joinedDate ?? data.createdAt ?? data.registeredAt),
    riskLevel: (data.riskLevel ?? data.risk_level) as RiskLevel | undefined,
    status: data.status as string | undefined,
    lastActivity: toDateString(data.lastActivity ?? data.last_active ?? data.lastSeen),
    mentalHealthProfile: parseMentalHealthProfile(data, profileSubDoc),
  };
}

export default function UserDetailsModal({
  isOpen, onClose, userId, userName, riskLevel, onOpenChat,
}: UserDetailsModalProps) {
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;

    setLoading(true);
    setError(null);
    setUserDetails(null);

    const fetchData = async () => {
      try {
        // Fetch user doc and mental health profile subcollection in parallel
        const [userDoc, profileDoc] = await Promise.all([
          getDoc(doc(db, 'users', userId)),
          getDoc(doc(db, 'users', userId, 'mentalHealthProfile', 'currentProfile')).catch(() => null),
        ]);
        const data = userDoc.exists() ? (userDoc.data() as Record<string, unknown>) : {};
        const profileData = profileDoc?.exists() ? (profileDoc.data() as Record<string, unknown>) : undefined;

        setUserDetails(parseUserDetails(userId, { ...data, name: data.name ?? userName }, profileData));
      } catch (err) {
        console.error('Error fetching user details:', err);
        setError('Could not load user details. Check Firestore permissions.');
        setUserDetails({ id: userId, name: userName, riskLevel });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, userId]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col z-10 overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-2xl shrink-0">
                  {userName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{userName}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <RiskBadge level={riskLevel} />
                    {userDetails?.status && (
                      <span className="text-xs text-slate-400 capitalize">{userDetails.status}</span>
                    )}
                    {userDetails?.lastActivity && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock size={10} />
                        {userDetails.lastActivity}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
              >
                <X size={18} className="text-slate-600" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              ) : (
                <ProfileTab userDetails={userDetails} userName={userName} riskLevel={riskLevel} />
              )}
            </div>

            {/* Footer */}
            {onOpenChat && (
              <div className="p-4 border-t border-slate-100 shrink-0">
                <button
                  onClick={onOpenChat}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold transition-colors"
                >
                  <MessageSquare size={18} />
                  Open Chat with {userName}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ProfileTab({
  userDetails,
  userName,
  riskLevel,
}: {
  userDetails: UserDetails | null;
  userName: string;
  riskLevel: RiskLevel;
}) {
  const mhp = userDetails?.mentalHealthProfile;

  const classificationColors: Record<string, string> = {
    severe: 'bg-red-100 text-red-700 border border-red-200',
    moderate: 'bg-amber-100 text-amber-700 border border-amber-200',
    low: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  };

  return (
    <div className="space-y-6">
      {/* Basic info grid */}
      <div className="grid grid-cols-2 gap-3">
        {userDetails?.email && (
          <InfoTile icon={<Mail size={15} className="text-brand-500" />} label="Email" value={userDetails.email} />
        )}
        {userDetails?.age && (
          <InfoTile icon={<User size={15} className="text-brand-500" />} label="Age" value={String(userDetails.age)} />
        )}
        {userDetails?.gender && (
          <InfoTile icon={<User size={15} className="text-brand-500" />} label="Gender" value={userDetails.gender} />
        )}
        {userDetails?.joinedDate && (
          <InfoTile icon={<Calendar size={15} className="text-brand-500" />} label="Joined" value={userDetails.joinedDate} />
        )}
      </div>

      {/* DASS-21 classification panel */}
      {mhp?.classificationLevel && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-brand-500" />
              <h4 className="text-sm font-bold text-slate-700">DASS-21 Assessment</h4>
            </div>
            <span className={cn(
              'text-xs font-bold px-3 py-1 rounded-full capitalize',
              classificationColors[mhp.classificationLevel] ?? classificationColors.low
            )}>
              {mhp.classificationLevel}
            </span>
          </div>
          {(mhp.depressionScore !== undefined || mhp.anxietyScore !== undefined || mhp.stressScore !== undefined) && (
            <div className="grid grid-cols-3 gap-2">
              {mhp.depressionScore !== undefined && (
                <div className="bg-white rounded-xl p-2.5 text-center border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Depression</p>
                  <p className="text-lg font-bold text-slate-800">{mhp.depressionScore}</p>
                </div>
              )}
              {mhp.anxietyScore !== undefined && (
                <div className="bg-white rounded-xl p-2.5 text-center border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Anxiety</p>
                  <p className="text-lg font-bold text-slate-800">{mhp.anxietyScore}</p>
                </div>
              )}
              {mhp.stressScore !== undefined && (
                <div className="bg-white rounded-xl p-2.5 text-center border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Stress</p>
                  <p className="text-lg font-bold text-slate-800">{mhp.stressScore}</p>
                </div>
              )}
            </div>
          )}
          {mhp.groupCategory && (
            <p className="text-xs text-slate-500">
              <span className="font-semibold">Group: </span>{mhp.groupCategory}
            </p>
          )}
          {mhp.lastAssessment && (
            <p className="flex items-center gap-1 text-[10px] text-slate-400">
              <Clock size={9} /> Assessed: {mhp.lastAssessment}
            </p>
          )}
        </div>
      )}

      {(mhp?.diagnosis?.length || mhp?.conditions?.length || mhp?.riskFactors?.length ||
        mhp?.currentState || mhp?.moodScore !== undefined || mhp?.medications?.length ||
        mhp?.triggers?.length || mhp?.notes) ? (
        <>
          {/* Current state + mood score */}
          {(mhp.currentState || mhp.moodScore !== undefined) && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-amber-600" />
                <h4 className="text-sm font-bold text-amber-700">Current Mental State</h4>
              </div>
              {mhp.currentState && <p className="text-sm text-slate-700">{mhp.currentState}</p>}
              {mhp.moodScore !== undefined && (
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Mood Score</span>
                    <span className="font-bold">{mhp.moodScore} / 10</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={cn(
                        'h-2 rounded-full transition-all',
                        mhp.moodScore <= 3 ? 'bg-red-400' :
                        mhp.moodScore <= 6 ? 'bg-amber-400' : 'bg-emerald-400'
                      )}
                      style={{ width: `${(mhp.moodScore / 10) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Diagnosis */}
          {mhp.diagnosis?.length ? (
            <TagSection
              icon={<Heart size={15} className="text-red-400" />}
              label="Diagnosis"
              tags={mhp.diagnosis}
              tagClass="bg-red-50 text-red-700 border border-red-100"
            />
          ) : null}

          {/* Conditions */}
          {mhp.conditions?.length ? (
            <TagSection
              icon={<Shield size={15} className="text-brand-500" />}
              label="Conditions"
              tags={mhp.conditions}
              tagClass="bg-brand-50 text-brand-700 border border-brand-100"
            />
          ) : null}

          {/* Risk factors */}
          {mhp.riskFactors?.length ? (
            <div>
              <SectionLabel icon={<AlertTriangle size={15} className="text-amber-500" />} label="Risk Factors" />
              <ul className="space-y-1.5 mt-2">
                {mhp.riskFactors.map((rf, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0" />
                    {rf}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Medications */}
          {mhp.medications?.length ? (
            <TagSection
              icon={<Pill size={15} className="text-slate-500" />}
              label="Medications"
              tags={mhp.medications}
              tagClass="bg-slate-100 text-slate-600"
            />
          ) : null}

          {/* Triggers */}
          {mhp.triggers?.length ? (
            <TagSection
              icon={<Zap size={15} className="text-orange-500" />}
              label="Known Triggers"
              tags={mhp.triggers}
              tagClass="bg-orange-50 text-orange-700 border border-orange-100"
            />
          ) : null}

          {/* Clinical notes */}
          {mhp.notes && (
            <div className="bg-slate-50 rounded-xl p-4">
              <SectionLabel icon={<ClipboardList size={15} className="text-slate-400" />} label="Clinical Notes" />
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{mhp.notes}</p>
            </div>
          )}

        </>
      ) : !mhp?.classificationLevel ? (
        <EmptyState
          icon={<Heart size={38} className="text-slate-300" />}
          title="No mental health profile data"
          subtitle="Data will appear once the user completes the onboarding questionnaire."
        />
      ) : null}
    </div>
  );
}


function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-slate-700 truncate">{value}</p>
      </div>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h4 className="text-sm font-bold text-slate-700">{label}</h4>
    </div>
  );
}

function TagSection({
  icon, label, tags, tagClass,
}: {
  icon: React.ReactNode;
  label: string;
  tags: string[];
  tagClass: string;
}) {
  return (
    <div>
      <SectionLabel icon={icon} label={label} />
      <div className="flex flex-wrap gap-2 mt-2">
        {tags.map((t, i) => (
          <span key={i} className={cn('text-xs font-medium px-3 py-1 rounded-full', tagClass)}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-4">{icon}</div>
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">{subtitle}</p>
    </div>
  );
}
