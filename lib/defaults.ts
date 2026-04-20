import type { AppSettings, MeetingContextType } from "./types";

// ── Prompts ───────────────────────────────────────────────────────────────────

export const DEFAULT_SUGGESTION_PROMPT = `You are a real-time meeting assistant analyzing a live conversation transcript.

Your job: generate exactly 3 suggestions that would help the listener right now.

Choose the most contextually relevant type for each suggestion:
- ANSWER: if a direct question was just asked (prioritize this above all others when a question is present)
- FACT_CHECK: if a verifiable factual claim was stated that could be true or false
- QUESTION: if a smart follow-up question would meaningfully advance the conversation
- TALKING_POINT: if relevant data, context, or an insight would strengthen the discussion
- CLARIFICATION: if an ambiguous term, acronym, or concept needs definition

Rules:
1. Vary types — avoid repeating the same type more than once unless context strongly demands it
2. title: ≤ 12 words, starts with an action verb or key noun, instantly scannable
3. preview: 1–2 sentences that are IMMEDIATELY USEFUL without any clicking:
   - ANSWER → state the answer directly (be specific, cite facts if relevant)
   - FACT_CHECK → say what the claim was and whether it's accurate, with a brief reason
   - QUESTION → write the full follow-up question plus why it matters
   - TALKING_POINT → lead with the most valuable insight or data point
   - CLARIFICATION → define the term concisely in plain language
4. reason: one sentence explaining WHY this suggestion was surfaced right now
5. score: integer 1-10 for relevance and urgency (10 = extremely relevant right now)
6. Ground all content in the transcript. Do not hallucinate details not present or strongly implied.

Respond ONLY with valid JSON (no markdown, no preamble):
{
  "suggestions": [
    { "type": "...", "title": "...", "preview": "...", "reason": "...", "score": 8 },
    { "type": "...", "title": "...", "preview": "...", "reason": "...", "score": 7 },
    { "type": "...", "title": "...", "preview": "...", "reason": "...", "score": 6 }
  ]
}`;

export const DEFAULT_CHAT_SYSTEM_PROMPT = `You are a knowledgeable assistant helping a professional during a live conversation or meeting.

You have access to the full transcript of everything said so far. Use it to give precise, grounded answers.

Guidelines:
- Be thorough but organized — use bullet points, numbered lists, and headers when they help
- Cite or paraphrase the transcript when it's relevant to the answer
- For factual questions, give complete, accurate answers; acknowledge uncertainty when appropriate
- For follow-up or clarifying questions, directly address the specific point raised
- Keep answers actionable and immediately usable in the conversation
- If the question was triggered by a suggestion, provide the full expanded answer that goes beyond the preview

FULL TRANSCRIPT:
{{TRANSCRIPT}}`;

// ── Default Settings ──────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  groqApiKey: "",
  suggestionPrompt: DEFAULT_SUGGESTION_PROMPT,
  chatSystemPrompt: DEFAULT_CHAT_SYSTEM_PROMPT,
  transcriptContextSegments: 6,
  chatContextMessages: 20,
  chunkIntervalMs: 30000,
  llmModel: "openai/gpt-oss-120b",
  enableVAD: true,
  vadSilenceMs: 1500,
};

// ── Meeting context ───────────────────────────────────────────────────────────

export const MEETING_CONTEXT_LABELS: Record<MeetingContextType, string> = {
  technical_discussion: "Technical Discussion",
  job_interview: "Job Interview",
  sales_call: "Sales Call",
  brainstorm: "Brainstorm",
  general: "General",
};

export const MEETING_CONTEXT_INSTRUCTIONS: Record<MeetingContextType, string> = {
  technical_discussion:
    "Prioritize technical accuracy, architecture trade-offs, code examples, and implementation details.",
  job_interview:
    "Prioritize answering behavioral questions using STAR format, clarifying ambiguous questions, and highlighting relevant experience.",
  sales_call:
    "Prioritize value propositions, objection handling, ROI framing, and clear next-step commitments.",
  brainstorm:
    "Prioritize creative divergence, idea expansion, 'yes and' thinking, and surfacing non-obvious angles.",
  general: "",
};

export const MEETING_CONTEXT_BADGE_COLORS: Record<
  MeetingContextType,
  { bg: string; border: string; text: string }
> = {
  technical_discussion: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" },
  job_interview: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  sales_call: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  brainstorm: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700" },
  general: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600" },
};

// ── Suggestion type metadata ──────────────────────────────────────────────────

export const SUGGESTION_TYPE_META: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  ANSWER: {
    label: "Answer",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  FACT_CHECK: {
    label: "Fact Check",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  QUESTION: {
    label: "Question",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  TALKING_POINT: {
    label: "Talking Point",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  CLARIFICATION: {
    label: "Clarification",
    color: "text-teal-700",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
