import type { AppSettings } from "./types";

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
4. Ground all content in the transcript. Do not hallucinate details not present or strongly implied.
5. If the conversation is early/sparse, still generate useful, generic-but-relevant suggestions.

Respond ONLY with valid JSON (no markdown, no preamble):
{
  "suggestions": [
    { "type": "...", "title": "...", "preview": "..." },
    { "type": "...", "title": "...", "preview": "..." },
    { "type": "...", "title": "...", "preview": "..." }
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
  transcriptContextSegments: 6,  // last ~3 minutes of conversation
  chatContextMessages: 20,
  chunkIntervalMs: 30000,
  llmModel: "llama-3.3-70b-versatile",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

export function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
