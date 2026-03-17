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
