// ── Transcription ─────────────────────────────────────────────────────────────

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number; // Date.now() when segment arrived
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
  isLoadingAnswer: boolean;
  answeredInChatId?: string; // ID of the chat message that answered this
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
  transcriptContextSegments: number; // # of recent segments for suggestions
  chatContextMessages: number; // # of recent chat messages to include
  chunkIntervalMs: number;
  llmModel: string;
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
}

export interface SuggestionsApiResponse {
  suggestions: Array<{
    type: SuggestionType;
    title: string;
    preview: string;
  }>;
}

export interface ChatApiRequest {
  messages: Array<{ role: ChatRole; content: string }>;
  transcriptContext: string;
  apiKey: string;
  systemPrompt: string;
  model: string;
}
