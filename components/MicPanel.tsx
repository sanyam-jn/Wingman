"use client";

import { useEffect, useRef } from "react";
import type { TranscriptSegment } from "@/lib/types";
import { formatTimestamp } from "@/lib/defaults";

interface MicPanelProps {
  isRecording: boolean;
  audioLevel: number;
  permissionError: string | null;
  transcriptSegments: TranscriptSegment[];
  isTranscribing: boolean;
  onToggleRecording: () => void;
  onRefresh: () => void;
  hasApiKey: boolean;
  sessionDuration: number;
}

export default function MicPanel({
  isRecording,
  audioLevel,
  permissionError,
  transcriptSegments,
  isTranscribing,
  onToggleRecording,
  onRefresh,
  hasApiKey,
  sessionDuration,
}: MicPanelProps) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptSegments]);

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const fullTranscript = transcriptSegments.map((s) => s.text).join(" ");
  const wordCount = fullTranscript.trim() ? fullTranscript.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Transcript</h2>
          <div className="flex items-center gap-2">
            {isRecording && (
              <span className="text-xs text-gray-500 tabular-nums">{formatDuration(sessionDuration)}</span>
            )}
            <button
              onClick={onRefresh}
              disabled={!isRecording && transcriptSegments.length === 0}
              title="Refresh suggestions now"
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mic Button */}
      <div className="flex flex-col items-center py-6 border-b border-gray-100">
        {/* Audio level bars */}
        {isRecording && (
          <div className="flex items-end gap-0.5 h-8 mb-3">
            {Array.from({ length: 12 }).map((_, i) => {
              const barThreshold = (i + 1) / 12;
              const active = audioLevel >= barThreshold * 0.6;
              return (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-75 ${
                    active ? "bg-red-400" : "bg-gray-200"
                  }`}
                  style={{
                    height: `${20 + i * 3}px`,
                    opacity: active ? 0.7 + audioLevel * 0.3 : 0.3,
                  }}
                />
              );
            })}
          </div>
        )}

        <button
          onClick={onToggleRecording}
          disabled={!hasApiKey}
          title={!hasApiKey ? "Enter API key in Settings" : isRecording ? "Stop recording" : "Start recording"}
          className={`relative w-16 h-16 rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 ${
            !hasApiKey
              ? "bg-gray-100 text-gray-300 cursor-not-allowed focus:ring-gray-200"
              : isRecording
              ? "bg-red-500 text-white hover:bg-red-600 focus:ring-red-200 shadow-lg"
              : "bg-gray-900 text-white hover:bg-gray-700 focus:ring-gray-300 shadow-md"
          }`}
        >
          {isRecording && (
            <span className="absolute inset-0 rounded-full bg-red-400 animate-pulse-slow opacity-40" />
          )}
          <span className="relative flex items-center justify-center">
            {isRecording ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zm0 2a2 2 0 00-2 2v7a2 2 0 004 0V5a2 2 0 00-2-2zM7.5 11a.75.75 0 01.75.75 3.75 3.75 0 007.5 0 .75.75 0 011.5 0 5.25 5.25 0 01-4.5 5.197V19.5h2.25a.75.75 0 010 1.5h-6a.75.75 0 010-1.5H11v-2.553A5.25 5.25 0 016.75 11.75.75.75 0 017.5 11z" />
              </svg>
            )}
          </span>
        </button>

        <p className="mt-2 text-xs text-gray-400">
          {!hasApiKey
            ? "Set API key in Settings"
            : isRecording
            ? "Recording — tap to stop"
            : "Tap to start"}
        </p>

        {permissionError && (
          <p className="mt-2 mx-4 text-xs text-red-600 text-center bg-red-50 rounded-md px-3 py-2">
            {permissionError}
          </p>
        )}

        {isTranscribing && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
            <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
            Transcribing…
          </div>
        )}
      </div>

      {/* Stats */}
      {transcriptSegments.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 flex gap-3">
          <span className="text-xs text-gray-400">{wordCount.toLocaleString()} words</span>
          <span className="text-xs text-gray-400">{transcriptSegments.length} chunks</span>
        </div>
      )}

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {transcriptSegments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4z" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Start recording to see transcript</p>
          </div>
        ) : (
          transcriptSegments.map((segment, idx) => (
            <div
              key={segment.id}
              className={`animate-fade-in ${
                idx === transcriptSegments.length - 1 ? "bg-blue-50 rounded-lg px-3 py-2 -mx-1" : ""
              }`}
            >
              <p className="text-xs text-gray-400 mb-0.5">{formatTimestamp(segment.timestamp)}</p>
              <p className="text-sm text-gray-800 leading-relaxed">{segment.text}</p>
            </div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>
    </div>
  );
}
