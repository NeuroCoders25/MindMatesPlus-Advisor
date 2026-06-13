// Groq API helper — uses fetch directly (no SDK needed).
// Set VITE_GROQ_API_KEY in your .env file.
// NOTE: This key is visible in the client bundle. Acceptable for an
// advisor-only internal tool; move to a backend proxy for public apps.

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function groqChat(
  systemPrompt: string,
  userContent: string,
  model = GROQ_MODEL,
): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY is not set in your .env file');

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API ${res.status}: ${body}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}

// ── Feature 2: Chat summary for advisor ──────────────────────────────────────

export async function generateGroupSummary(
  messages: { senderName: string; text: string }[],
): Promise<string> {
  const transcript = messages.map(m => `${m.senderName}: ${m.text}`).join('\n');
  return groqChat(
    `You are summarizing a peer mental health support group chat for a counsellor/advisor.
Identify: key topics discussed, the overall emotional tone, any members who seem distressed,
and whether advisor intervention is recommended.
Format as short bullet points. Start with a one-line overall mood assessment on the first line.
Be concise — the advisor needs a quick overview, not a transcript.`,
    `Recent chat transcript:\n${transcript}`,
    GROQ_MODEL,
  );
}

// ── Feature 3: Conflict / hostility detection ────────────────────────────────

export interface ConflictResult {
  isConflict: boolean;
  severity: 'low' | 'medium' | 'high';
  reason: string;
}

export async function detectConflict(
  recentContext: { senderName: string; text: string }[],
  newMessage: { senderName: string; text: string },
): Promise<ConflictResult> {
  const contextText = recentContext.map(m => `${m.senderName}: ${m.text}`).join('\n');
  const raw = await groqChat(
    `You are a safety monitor for a peer mental health support group chat.
Analyze if the new message indicates interpersonal conflict, hostility, bullying, or harmful group dynamics.
Respond ONLY with valid JSON — no markdown fences, no extra text:
{"isConflict": boolean, "severity": "low" | "medium" | "high", "reason": "one sentence"}`,
    `Recent context:\n${contextText}\n\nNew message from ${newMessage.senderName}: "${newMessage.text}"`,
  );
  try {
    const parsed = JSON.parse(raw.trim()) as Partial<ConflictResult>;
    return {
      isConflict: Boolean(parsed.isConflict),
      severity: parsed.severity ?? 'low',
      reason: parsed.reason ?? '',
    };
  } catch {
    return { isConflict: false, severity: 'low', reason: '' };
  }
}

// ── Feature 1: AI-suggested private reply for flagged messages ───────────────

export async function generateAIPrivateReply(
  flaggedText: string,
  senderName: string,
): Promise<string> {
  return groqChat(
    `You are a compassionate mental health peer support assistant.
A group member's message was flagged and the advisor is reviewing it.
Write a short, warm private reply acknowledging the person and letting them know a counsellor has been alerted and will follow up soon.
Keep it to 2–3 sentences. Be empathetic, not clinical. Do not make promises. Do not sign off with a name.`,
    `Flagged message from ${senderName}: "${flaggedText}"`,
  );
}
