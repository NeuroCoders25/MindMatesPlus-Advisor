/**
 * Types and utilities for the User Mental Health Detail Panel.
 * Shared across useUserDiagnosticData hook and all panel components.
 */

import type { RiskLevel } from '../types';
export type { RiskLevel };

// ─── Risk normalisation (identical logic to UserMonitoring.tsx) ───────────────

export function normalizeRiskLevel(value: unknown): RiskLevel {
  const v = String(value ?? '').toLowerCase().trim();
  if (v.includes('extremely') || v.includes('severe') || v === 'critical') return 'Critical';
  if (v.includes('high') || v.includes('moderate') || v === 'moderate') return 'High';
  if (v === 'medium' || v === 'mild') return 'Medium';
  return 'Low';
}

// ─── Timestamp helpers ────────────────────────────────────────────────────────

export function tsToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof (value as { seconds: unknown }).seconds === 'number'
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

export function tsToRelative(value: unknown): string {
  const d = tsToDate(value);
  if (!d) return '—';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function tsToFull(value: unknown): string {
  const d = tsToDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function tsToShort(value: unknown): string {
  const d = tsToDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── DASS-21 helpers ──────────────────────────────────────────────────────────

export type DassType = 'depression' | 'anxiety' | 'stress';

export function getDASSSeverity(type: DassType, score: number): string {
  if (type === 'depression') {
    if (score < 10) return 'Normal';
    if (score < 14) return 'Mild';
    if (score < 21) return 'Moderate';
    if (score < 28) return 'Severe';
    return 'Extremely Severe';
  }
  if (type === 'anxiety') {
    if (score < 8) return 'Normal';
    if (score < 10) return 'Mild';
    if (score < 15) return 'Moderate';
    if (score < 20) return 'Severe';
    return 'Extremely Severe';
  }
  // stress
  if (score < 15) return 'Normal';
  if (score < 19) return 'Mild';
  if (score < 26) return 'Moderate';
  if (score < 34) return 'Severe';
  return 'Extremely Severe';
}

export function getSeverityColorClass(severity: string): string {
  switch (severity) {
    case 'Normal':           return 'bg-emerald-50 text-emerald-700';
    case 'Mild':             return 'bg-yellow-50 text-yellow-700';
    case 'Moderate':         return 'bg-amber-50 text-amber-700';
    case 'Severe':           return 'bg-red-50 text-red-700';
    case 'Extremely Severe': return 'bg-red-100 text-red-900 font-bold';
    default:                 return 'bg-slate-50 text-slate-600';
  }
}

export function getSeverityBarColor(severity: string): string {
  switch (severity) {
    case 'Normal':           return '#10b981';
    case 'Mild':             return '#eab308';
    case 'Moderate':         return '#f59e0b';
    case 'Severe':           return '#ef4444';
    case 'Extremely Severe': return '#991b1b';
    default:                 return '#94a3b8';
  }
}

// ─── Recommendation priority chain ───────────────────────────────────────────

// ─── DASS-21 score extractor (handles both old and new field paths) ───────────

export function getDassScores(mhp: MentalHealthProfileData | null): {
  depression: number | null;
  anxiety:    number | null;
  stress:     number | null;
} {
  if (!mhp) return { depression: null, anxiety: null, stress: null };
  // Primary: initialQuestionnaireScore (new Firestore path)
  const iq = mhp.initialQuestionnaireScore;
  if (iq) {
    const d = typeof iq.depressionScore === 'number' ? iq.depressionScore : null;
    const a = typeof iq.anxietyScore    === 'number' ? iq.anxietyScore    : null;
    const s = typeof iq.stressScore     === 'number' ? iq.stressScore     : null;
    if (d !== null || a !== null || s !== null) return { depression: d, anxiety: a, stress: s };
  }
  // Fallback: legacy dass21Scores map
  const d2 = mhp.dass21Scores ?? {};
  return {
    depression: typeof d2.depression === 'number' ? d2.depression : null,
    anxiety:    typeof d2.anxiety    === 'number' ? d2.anxiety    : null,
    stress:     typeof d2.stress     === 'number' ? d2.stress     : null,
  };
}

// ─── Journal timestamp extractor ─────────────────────────────────────────────

export function getJournalTimestamp(entry: JournalMetaEntry): unknown {
  return entry.date ?? entry.createdAt;
}

// ─── ML entry timestamp extractor ────────────────────────────────────────────

export function getMlTimestamp(entry: MLHistoryEntry): unknown {
  return entry.createdAt ?? entry.timestamp;
}

// ─── Recommendation priority chain ───────────────────────────────────────────

export function resolveActiveRecommendation(
  profile: UserDiagnosticProfile,
  mhp?: MentalHealthProfileData | null,
): { category: string; source: string } {
  // P1 — peerGroupRecommendationCategory (weekly trend; drives HomeScreen)
  const p1 = profile.peerGroupRecommendationCategory ?? profile.weeklyTrendCategory
           ?? mhp?.peerGroupRecommendationCategory   ?? mhp?.weeklyTrendCategory;
  // P2 — KNN output category (blocked if safety flag set)
  const knnMapped = profile.knnMappedCategory ?? mhp?.knnMappedCategory;
  const knnFlag   = (profile.knnSafetyFlag ?? mhp?.knnSafetyFlag) === true;
  // P3 — frozen DASS-21 baseline
  const baseline  = profile.baselineRecommendationCategory ?? mhp?.baselineRecommendationCategory;
  // P4 — stability-based active ML category
  const active    = profile.activeRecommendationCategory   ?? mhp?.activeRecommendationCategory;

  if (p1)                     return { category: p1,       source: 'Weekly Trend' };
  if (knnMapped && !knnFlag)  return { category: knnMapped, source: 'KNN Mapped' };
  if (baseline)               return { category: baseline,  source: 'Baseline' };
  return { category: active ?? 'Unknown', source: 'Active (ML)' };
}

// ─── Display name helper ──────────────────────────────────────────────────────

export function getUserDisplayName(profile: UserDiagnosticProfile | null): string {
  if (!profile) return 'Unknown';
  return (
    (profile.nickname as string | undefined) ??
    (profile.nickName as string | undefined) ??
    (profile.displayName as string | undefined) ??
    (profile.name as string | undefined) ??
    'Unknown'
  );
}

export function normalizeUserStatus(
  profile: UserDiagnosticProfile | null,
  mhp: MentalHealthProfileData | null,
): string {
  const raw = (mhp?.userStatus ?? profile?.userStatus ?? profile?.status ?? '') as string;
  const v = raw.toLowerCase().replace(/_/g, ' ').trim();
  if (v === 'normal' || v === 'active') return 'Active';
  if (v === 'monitoring') return 'Monitoring';
  if (v === 'restricted') return 'Restricted';
  if (v.includes('under') || v.includes('review')) return 'Under Review';
  if (v === 'inactive') return 'Inactive';
  return 'Active';
}

export function getLabelColor(label: string | undefined): string {
  const l = (label ?? '').toLowerCase();
  if (l.includes('depress')) return '#ef4444';
  if (l.includes('anxi')) return '#f59e0b';
  return '#10b981';
}

export function getLabelChipClass(label: string | undefined): string {
  const l = (label ?? '').toLowerCase();
  if (l.includes('depress')) return 'bg-red-100 text-red-700';
  if (l.includes('anxi')) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

export function getSourceIcon(source: string | undefined): string {
  const s = (source ?? '').toLowerCase();
  if (s.includes('journal')) return '📓';
  if (s.includes('group') || s.includes('chat')) return '💬';
  if (s.includes('ai') || s.includes('bot')) return '🤖';
  return '📓';
}

// ─── Category colour accent ───────────────────────────────────────────────────

export function getCategoryColor(category: string | undefined): string {
  const c = (category ?? '').toLowerCase();
  if (c.includes('thriving'))         return '#10b981';
  if (c.includes('stress'))           return '#34d399';
  if (c.includes('emotional'))        return '#6ee7b7';
  if (c.includes('recovery') || c.includes('improvement')) return '#3b82f6';
  if (c.includes('mild'))             return '#f59e0b';
  if (c.includes('moderate'))         return '#ef4444';
  return '#6366f1';
}

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Wellness - Thriving':             'User shows strong resilience and positive emotional indicators.',
  'Wellness - Stress Aware':         'Mild stressors present; user demonstrates good coping strategies.',
  'Wellness - Emotionally Aware':    'User is self-reflective; minor emotional regulation support may help.',
  'Recovery & Improvement':          'User progressing positively after previous distress period.',
  'Mild Support':                    'Low-level distress signals detected. Light peer and advisor check-in advised.',
  'Moderate Support':                'User exhibits moderate distress signals. Peer group and advisor engagement recommended.',
};

// ─── TypeScript interfaces ────────────────────────────────────────────────────

export interface DASS21Scores {
  depression: number;
  anxiety: number;
  stress: number;
}

// Nested questionnaire scores inside currentProfile
export interface InitialQuestionnaireScore {
  depressionScore?: number;  // 0–42
  anxietyScore?: number;     // 0–42
  stressScore?: number;      // 0–42
}

export interface MLStabilityCounter {
  repeatedCount: number;
  lastPrediction: string;    // last BERT label counted (was currentPrediction)
  currentPrediction?: string; // legacy alias — keep for backward compat
  maxCount?: number;         // stability threshold (default 5)
}

export interface KNNResult {
  // Legacy nested form (kept for backward compat)
  group?: string;
  mappedCategory?: string;
  confidence?: number;
  safetyFlag?: boolean;
  fallback?: string;
  lastRun?: unknown;
  groupProbabilities?: Record<string, number>;
}

export interface MentalHealthProfileData {
  // DASS-21 — stored inside initialQuestionnaireScore
  initialQuestionnaireScore?: InitialQuestionnaireScore;
  dass21Scores?: Partial<DASS21Scores>;        // legacy fallback
  // ML stability counter
  mlStabilityCounter?: Partial<MLStabilityCounter>;
  consecutiveDaysAtBottom?: number;
  // KNN — direct fields on currentProfile document
  knnRecommendedGroup?: string;               // raw group e.g. "G4_Anxiety_Management"
  knnMappedCategory?: string;                 // P2 category
  knnProbabilities?: Record<string, number>;  // per-group probabilities
  knnSafetyFlag?: boolean;                    // true = G1 crisis, blocks auto-assign
  knnLastUpdatedAt?: unknown;                 // when KNN last ran
  knnFallbackReason?: string;                 // "backend_unreachable" if KNN failed
  // Legacy nested KNN result (keep for backward compat)
  lastKnnResult?: Partial<KNNResult>;
  // Timestamps
  lastUpdated?: unknown;
  advisorApprovedAt?: unknown;
  // Status
  userStatus?: string;
  advisorConnectionStatus?: string;
  dashboardCategory?: string;
  // Recommendation categories
  wellnessScore?: number;
  activeRecommendationCategory?: string;      // P4 stability-based ML
  baselineRecommendationCategory?: string;    // P3 frozen DASS-21 baseline
  peerGroupRecommendationCategory?: string;   // P1 weekly trend (drives HomeScreen)
  weeklyTrendCategory?: string;               // legacy alias for P1
  resourceRecommendationCategory?: string;
  approvedCategory?: string;
  // Advisor fields
  connectedAdvisorId?: string;
  advisorConnectionId?: string;
  approvedByAdvisorId?: string;
}

// Nested map field stored inside users/{uid}
export interface MlMentalHealthProfileMap {
  anxietyCount?: number;
  depressionCount?: number;
  dominantCategory?: string;
  lastUpdated?: unknown;
}

export interface UserDiagnosticProfile {
  uid: string;
  // Name variants
  nickname?: unknown;
  nickName?: unknown;
  displayName?: unknown;
  name?: unknown;
  // Demographics (from users doc)
  age?: number;
  dob?: string;
  email?: string;
  gender?: string;
  // Wellness
  wellnessScore?: number;
  userStatus?: unknown;
  status?: unknown;
  // Recommendation categories (may also live in mentalHealthProfile/currentProfile)
  activeRecommendationCategory?: string;
  baselineRecommendationCategory?: string;
  peerGroupRecommendationCategory?: string;
  resourceRecommendationCategory?: string;
  weeklyTrendCategory?: string;
  // KNN
  knnMappedCategory?: string;
  knnSafetyFlag?: boolean;
  // Connection
  advisorConnectionStatus?: string;
  riskLevel?: unknown;
  // ML nested map field on users doc
  mlMentalHealthProfile?: MlMentalHealthProfileMap;
  // Timestamps
  createdAt?: unknown;
  lastActive?: unknown;
  lastActivity?: unknown;
}

export interface MLHistoryEntry {
  id: string;
  // Core BERT result
  prediction?: string;       // "depression" | "anxiety" | "normal"
  label?: string;            // legacy alias for prediction
  confidence?: number;       // 0–1
  score?: number;            // legacy alias for confidence
  probabilities?: {          // per-label raw probabilities
    depression?: number;
    anxiety?: number;
    normal?: number;
  };
  // Metadata
  source?: string;           // "journal" | "group_chat" | "ai_chat"
  textPreview?: string;      // first 80 chars of analyzed text
  wellnessScore?: number;
  triggeredCategoryMove?: boolean;
  // Timestamps — mlAnalysisHistory uses createdAt
  createdAt?: unknown;
  timestamp?: unknown;       // legacy alias
}

export interface MLAnalysis {
  prediction?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
}

export interface JournalMetaEntry {
  id: string;
  // mlAnalysisHistory uses 'date' as the primary timestamp field
  date?: unknown;
  createdAt?: unknown;       // legacy fallback
  content?: string;
  mood_tag?: string;
  ml_analysis?: MLAnalysis;  // correct BERT result field name
  bertPrediction?: {         // legacy alias
    label?: string;
    confidence?: number;
    probabilities?: Record<string, number>;
  };
}

export interface FeedbackEntry {
  id: string;
  star_rating?: number;
  peer_comment?: string;
  app_comment?: string;
  createdAt?: unknown;
}

export interface AdvisorConnectionData {
  id: string;
  status?: string;
  advisorId?: string;
  connectedAt?: unknown;
  createdAt?: unknown;
  notes?: string;
  userId?: string;
}

export interface WellnessHistoryEntry {
  id: string;
  newScore?: number;
  previousScore?: number;
  createdAt?: unknown;
  source?: string;
}

export interface UserDiagnosticData {
  profile: UserDiagnosticProfile | null;
  mentalHealthProfile: MentalHealthProfileData | null;
  journalEntries: JournalMetaEntry[];
  mlHistory: MLHistoryEntry[];
  wellnessHistory: WellnessHistoryEntry[];
  feedback: FeedbackEntry[];
  advisorConnection: AdvisorConnectionData | null;
  loading: boolean;
  error: string | null;
}
