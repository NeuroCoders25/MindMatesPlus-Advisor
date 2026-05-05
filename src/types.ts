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

export interface PeerGroup {
  id: string;
  name: string;
  memberCount?: number;
  createdAt?: string;
  status?: string;
  category?: string;
}

export interface LiveChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date | null;
}
