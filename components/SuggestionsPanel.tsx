"use client";

import type { Suggestion, SuggestionBatch } from "@/lib/types";
import { SUGGESTION_TYPE_META, formatTimestamp } from "@/lib/defaults";

interface SuggestionsPanelProps {
  batches: SuggestionBatch[];
  isLoading: boolean;
  onSuggestionClick: (suggestion: Suggestion) => void;
  answeredSuggestionIds: Set<string>;
  latestBatchId?: string;
}

function SuggestionCard({
  suggestion,
  onSuggestionClick,
  isAnswered,
  keyHint,
}: {
  suggestion: Suggestion;
  onSuggestionClick: (s: Suggestion) => void;
  isAnswered: boolean;
  keyHint?: string;
}) {
  const meta = SUGGESTION_TYPE_META[suggestion.type] ?? SUGGESTION_TYPE_META.TALKING_POINT;

  return (
    <button
      onClick={() => onSuggestionClick(suggestion)}
      disabled={suggestion.isLoadingAnswer}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-all duration-150 group ${
        isAnswered
          ? "border-gray-100 bg-gray-50 opacity-60 cursor-default"
          : `${meta.borderColor} ${meta.bgColor} hover:shadow-md hover:-translate-y-0.5 active:translate-y-0`
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.color} bg-white/70 border ${meta.borderColor} shrink-0`}
        >
          {meta.label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {keyHint && !isAnswered && (
            <span className="text-[9px] font-mono text-gray-400 border border-gray-200 rounded px-1 py-0.5 leading-none">
              {keyHint}
            </span>
          )}
          {suggestion.isLoadingAnswer ? (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          ) : isAnswered ? (
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>

      <h3 className="mt-2 text-sm font-semibold text-gray-800 leading-snug">{suggestion.title}</h3>
      <p className="mt-1 text-xs text-gray-600 leading-relaxed line-clamp-3">{suggestion.preview}</p>

      {/* Reason — why this was surfaced */}
      {suggestion.reason && (
        <p className="mt-1.5 text-[11px] text-gray-400 italic leading-relaxed">
          {suggestion.reason}
        </p>
      )}
    </button>
  );
}

export default function SuggestionsPanel({
  batches,
  isLoading,
  onSuggestionClick,
  answeredSuggestionIds,
  latestBatchId,
}: SuggestionsPanelProps) {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Live Suggestions</h2>
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
              Generating…
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {batches.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Start recording to get suggestions</p>
            <p className="text-xs text-gray-300 mt-1">Refreshes on silence or every 30s</p>
            <p className="text-xs text-gray-300 mt-0.5">Press 1, 2, 3 to open • R to refresh</p>
          </div>
        ) : (
          [...batches].reverse().map((batch, batchIdx) => (
            <div key={batch.id} className={batchIdx === 0 ? "animate-slide-down" : ""}>
              <p className="text-[10px] text-gray-400 mb-2 px-1">{formatTimestamp(batch.createdAt)}</p>
              <div className="space-y-2">
                {batch.suggestions.map((suggestion, idx) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onSuggestionClick={onSuggestionClick}
                    isAnswered={answeredSuggestionIds.has(suggestion.id)}
                    keyHint={batch.id === latestBatchId && idx < 3 ? String(idx + 1) : undefined}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        {isLoading && batches.length === 0 && (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <div className="h-3 w-20 bg-gray-200 rounded-full" />
                <div className="mt-2 h-4 w-3/4 bg-gray-200 rounded" />
                <div className="mt-1.5 h-3 w-full bg-gray-100 rounded" />
                <div className="mt-1 h-3 w-5/6 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
