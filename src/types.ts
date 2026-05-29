export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface User {
  id: string;
  name: string;
  riskLevel: RiskLevel;
  status: 'Active' | 'Inactive' | 'Monitoring';
  lastActivity: string;
  avatar?: string;
}

export interface Alert {
  id: string;
  userId: string;
  userName: string;
  type: 'Distress' | 'Self-Harm' | 'Anxiety' | 'Depression';
  timestamp: string;
  severity: RiskLevel;
  message: string;
}

export interface Case {
  id: string;
  userId: string;
  userName: string;
  riskLevel: RiskLevel;
  lastActivity: string;
  reason: string;
  status: 'Open' | 'Resolved' | 'Escalated';
}

export interface ChatMessage {
  id: string;
  sender: 'User' | 'AI' | 'Peer';
  text: string;
  timestamp: string;
  isFlagged?: boolean;
  sentiment?: 'Positive' | 'Neutral' | 'Negative' | 'Risky';
}

export interface JournalEntry {
  id: string;
  userId: string;
  date: string;
  content: string;
  sentiment: number; // -1 to 1
  tags: string[];
}

export interface AdvisorNote {
  id: string;
  userId: string;
  advisorId: string;
  content: string;
  timestamp: string;
  category: 'General' | 'Clinical' | 'Intervention';
}

export interface MentalHealthProfile {
  diagnosis?: string[];
  conditions?: string[];
  riskFactors?: string[];
  currentState?: string;
  moodScore?: number;
  lastAssessment?: string;
  notes?: string;
  medications?: string[];
  triggers?: string[];
  // DASS-21 classification from onboarding questionnaire
  classificationLevel?: 'low' | 'moderate' | 'severe';
  depressionScore?: number;
  anxietyScore?: number;
  stressScore?: number;
  totalScore?: number;
  groupCategory?: string;
}

export interface QuestionnaireResponse {
  id: string;
  question: string;
  answer: string | number;
  score?: number;
  category?: string;
  timestamp?: string;
}

export interface UserDetails {
  id: string;
  name: string;
  email?: string;
  age?: number;
  gender?: string;
  joinedDate?: string;
  riskLevel?: RiskLevel;
  status?: string;
  lastActivity?: string;
  mentalHealthProfile?: MentalHealthProfile;
}

export interface AdvisorConnection {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  nickName?: string;
  advisorId: string;
  advisorName?: string;
  status: 'pending' | 'accepted' | 'reviewed' | 'approved' | 'declined';
  caseType: string;
  reason: string;
  userMentalHealthCategory: string;
  approvedCategory?: string;
  advisorNote?: string;
  createdAt: unknown;
  updatedAt?: unknown;
  approvedAt?: unknown;
  acceptedAt?: unknown;
  acceptedByAdvisorId?: string;
  declinedAt?: unknown;
  declineReason?: string;
}

export interface PeerGroup {
  id: string;
  name: string;
  memberCount?: number;
  createdAt?: string;
  status?: string;
  category?: string;
  moderator?: string;
  imageUrl?: string;
}

export interface CaseMessage {
  id: string;
  senderId: string;
  senderRole: 'user' | 'advisor';
  receiverId: string;
  messageText: string;
  messageType: string;
  createdAt: unknown;
  isRead: boolean;
}

export interface LiveChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date | null;
  isFlagged?: boolean;
  advisorApproved?: boolean;
  advisorNote?: string;
  deletedByAdvisor?: boolean;
  deletedByAdvisorName?: string;
  reviewStatus?: 'pending' | 'approved' | 'rejected' | 'not_required';
  reviewedBy?: string;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
}

export interface AdvisorPrivateMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'advisor' | 'user';
  receiverId?: string;
  receiverName?: string;
  text: string;
  /** Primary timestamp field for privateThread messages. */
  createdAt: Date | null;
  isRead: boolean;
  isPrivate?: boolean;
  threadType?: string;
  flaggedMessageRef?: string;
  visibleTo?: string[];
}

export interface Resource {
  id: string;
  title: string;
  category: string;
  resource_type: 'text' | 'image';
  resource: string; // text content
  image_url?: string; // image URL if applicable
  author: string;
  authorId: string;
  authorImageUrl?: string;
  createdAt: string;
}

export interface FlaggedAlert {
  id: string;
  source: 'group-chat' | 'ai-chat' | 'journal';
  senderName: string;
  snippet: string;
  timestamp: Date;
  navPath: string;
}

// ─── System Support (Advisor → Admin) ────────────────────────────────────────

export type SupportCategory =
  | 'Technical Issue'
  | 'Urgent Case'
  | 'System Error'
  | 'Consultation'
  | 'Policy Question'
  | 'Other';

export type SupportPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type SupportStatus = 'pending' | 'in_progress' | 'resolved' | 'closed';

export interface SupportRequest {
  id: string;
  advisorId: string;
  advisorName: string;
  adminId?: string;
  adminName?: string;
  category: SupportCategory;
  priority: SupportPriority;
  subject: string;
  description: string;
  status: SupportStatus;
  createdAt: unknown;
  updatedAt?: unknown;
  resolvedAt?: unknown;
  chatId?: string;
}

export interface AdminAvailability {
  id: string;
  name: string;
  email?: string;
  role?: string;
  availability: 'online' | 'busy' | 'away' | 'offline';
  profileImageUrl?: string;
  lastSeen?: unknown;
}
