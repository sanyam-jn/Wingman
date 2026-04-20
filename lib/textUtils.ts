import type { TranscriptSegment } from "./types";

const FILLER_REGEX =
  /\b(um+|uh+|uhh+|hmm+|like(?=\s)|you\s+know|i\s+mean|basically|literally|actually|so\s+like|right\s+so)\b[,]?\s*/gi;

/**
 * Strips common filler words from transcript text.
 * Preserves sentence structure and collapses extra spaces.
 */
export function stripFillers(text: string): string {
  return text
    .replace(FILLER_REGEX, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s([.,?!])/g, "$1")
    .trim();
}

/**
 * Returns the last `n` complete sentences from text.
 * Falls back to the full text if fewer than n sentences exist.
 */
export function getLastSentences(text: string, n = 2): string {
  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  if (sentences.length <= n) return text.trim();
  return sentences.slice(-n).join(" ").trim();
}

/**
 * Builds the Whisper prompt from the last chunk's text.
 * Passing this to Whisper improves cross-chunk continuity.
 */
export function getWhisperPrompt(prevChunkText: string): string {
  if (!prevChunkText?.trim()) return "";
  return getLastSentences(stripFillers(prevChunkText), 2);
}

/**
 * Builds suggestion context: summarizes older segments, keeps recent ones verbatim.
 * Reduces noise while preserving recency signal for the LLM.
 */
export function buildSuggestionContext(
  segments: TranscriptSegment[],
  verbatimCount: number
): string {
  if (segments.length === 0) return "";

  const verbatim = segments.slice(-verbatimCount);
  const older = segments.slice(0, -verbatimCount);

  const parts: string[] = [];

  if (older.length > 0) {
    const summary = older
      .map((s) => stripFillers(s.text))
      .join(" ")
      .slice(0, 400);
    parts.push(`[Earlier in conversation]: ${summary}${summary.length === 400 ? "…" : ""}`);
  }

  parts.push(...verbatim.map((s) => stripFillers(s.text)));

  return parts.join("\n\n");
}
