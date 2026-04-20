// ── Transcription ─────────────────────────────────────────────────────────────

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
}

// ── Meeting Context ───────────────────────────────────────────────────────────

export type MeetingContextType =
  | "technical_discussion"
  | "job_interview"
  | "sales_call"
  | "brainstorm"
  | "general";

export interface MeetingContext {
  type: MeetingContextType;
  label: string;
  confidence: number;
}

// ── Suggestions ───────────────────────────────────────────────────────────────

export type SuggestionType =
  | "ANSWER"
  | "FACT_CHECK"
  | "QUESTION"
  | "TALKING_POINT"
  | "CLARIFICATION";

export interface Suggestion {
  id: string;
  type: SuggestionType;
  title: string;
  preview: string;
  reason?: string;
  score?: number;
  isLoadingAnswer: boolean;
  answeredInChatId?: string;
}

export interface SuggestionBatch {
  id: string;
  suggestions: Suggestion[];
  createdAt: number;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  isStreaming?: boolean;
  sourceSuggestionId?: string;
  timestamp: number;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface AppSettings {
  groqApiKey: string;
  suggestionPrompt: string;
  chatSystemPrompt: string;
  transcriptContextSegments: number;
  chatContextMessages: number;
  chunkIntervalMs: number;
  llmModel: string;
  enableVAD: boolean;
  vadSilenceMs: number;
}

// ── Export ────────────────────────────────────────────────────────────────────

export interface SessionExport {
  exportedAt: string;
  durationMs: number;
  transcript: TranscriptSegment[];
  suggestionBatches: SuggestionBatch[];
  chatHistory: ChatMessage[];
}

// ── API Shapes ────────────────────────────────────────────────────────────────

export interface SuggestionsApiRequest {
  transcriptText: string;
  apiKey: string;
  systemPrompt: string;
  model: string;
  meetingContext?: MeetingContext | null;
}

export interface SuggestionsApiResponse {
  suggestions: Array<{
    type: SuggestionType;
    title: string;
    preview: string;
    reason?: string;
    score?: number;
  }>;
}

export interface ChatApiRequest {
  messages: Array<{ role: ChatRole; content: string }>;
  transcriptContext: string;
  apiKey: string;
  systemPrompt: string;
  model: string;
  threadContext?: {
    suggestionType: SuggestionType;
    suggestionTitle: string;
    suggestionPreview: string;
  };
}

export interface DetectContextApiRequest {
  transcriptText: string;
  apiKey: string;
}

export interface DetectContextApiResponse {
  type: MeetingContextType;
  label: string;
  confidence: number;
}
