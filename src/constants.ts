import { User, Alert, Case, ChatMessage, JournalEntry, AdvisorNote } from './types';

export const DUMMY_USERS: User[] = [
  { id: 'U001', name: 'Alex Johnson', riskLevel: 'High', status: 'Active', lastActivity: '2 mins ago' },
  { id: 'U002', name: 'Sarah Miller', riskLevel: 'Medium', status: 'Monitoring', lastActivity: '15 mins ago' },
  { id: 'U003', name: 'Michael Chen', riskLevel: 'Low', status: 'Active', lastActivity: '1 hour ago' },
  { id: 'U004', name: 'Emma Wilson', riskLevel: 'Critical', status: 'Active', lastActivity: 'Just now' },
  { id: 'U005', name: 'David Brown', riskLevel: 'Low', status: 'Inactive', lastActivity: '2 days ago' },
];

export const DUMMY_ALERTS: Alert[] = [
  { id: 'A1', userId: 'U004', userName: 'Emma Wilson', type: 'Self-Harm', timestamp: '2026-03-17T19:10:00Z', severity: 'Critical', message: 'AI detected self-harm ideation in journal entry.' },
  { id: 'A2', userId: 'U001', userName: 'Alex Johnson', type: 'Distress', timestamp: '2026-03-17T18:45:00Z', severity: 'High', message: 'Repeated mentions of extreme loneliness in chat.' },
  { id: 'A3', userId: 'U002', userName: 'Sarah Miller', type: 'Anxiety', timestamp: '2026-03-17T17:30:00Z', severity: 'Medium', message: 'Elevated heart rate and panic-related keywords detected.' },
];

export const DUMMY_CASES: Case[] = [
  { id: 'C1', userId: 'U004', userName: 'Emma Wilson', riskLevel: 'Critical', lastActivity: 'Just now', reason: 'Self-harm ideation', status: 'Open' },
  { id: 'C2', userId: 'U001', userName: 'Alex Johnson', riskLevel: 'High', lastActivity: '2 mins ago', reason: 'Severe depression indicators', status: 'Open' },
  { id: 'C3', userId: 'U002', userName: 'Sarah Miller', riskLevel: 'Medium', lastActivity: '15 mins ago', reason: 'Panic attack history', status: 'Escalated' },
];

export const DUMMY_MESSAGES: ChatMessage[] = [
  { id: 'M1', sender: 'User', text: "I don't know if I can keep doing this anymore.", timestamp: '19:05', isFlagged: true, sentiment: 'Risky' },
  { id: 'M2', sender: 'AI', text: "I'm here for you. Can you tell me more about what's making you feel this way?", timestamp: '19:05', sentiment: 'Positive' },
  { id: 'M3', sender: 'User', text: "Everything just feels so heavy. Like there's no way out.", timestamp: '19:06', isFlagged: true, sentiment: 'Negative' },
];

export const DUMMY_JOURNALS: JournalEntry[] = [
  { id: 'J1', userId: 'U004', date: '2026-03-17', content: "Today was particularly hard. I felt a darkness I haven't felt in a long time. The thoughts are coming back and they're louder than before.", sentiment: -0.9, tags: ['Darkness', 'Thoughts', 'Struggle'] },
  { id: 'J2', userId: 'U001', date: '2026-03-16', content: "Tried to go for a walk. It helped a bit but the loneliness is still there. I miss my family.", sentiment: -0.4, tags: ['Walk', 'Loneliness', 'Family'] },
];

export const DUMMY_NOTES: AdvisorNote[] = [
  { id: 'N1', userId: 'U004', advisorId: 'ADV01', content: 'Contacted emergency services. User is being monitored by local crisis team.', timestamp: '2026-03-17T19:15:00Z', category: 'Intervention' },
  { id: 'N2', userId: 'U001', advisorId: 'ADV01', content: 'Scheduled a follow-up session for tomorrow morning.', timestamp: '2026-03-17T18:00:00Z', category: 'General' },
];
