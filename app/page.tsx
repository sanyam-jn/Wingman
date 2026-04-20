"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AppSettings,
  ChatMessage,
  SessionExport,
  Suggestion,
  SuggestionBatch,
  TranscriptSegment,
} from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import MicPanel from "@/components/MicPanel";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import ChatPanel from "@/components/ChatPanel";
import SettingsModal from "@/components/SettingsModal";

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  type: "error" | "info";
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  // ── Settings: start with defaults to avoid SSR/client hydration mismatch.
  // Load from localStorage in useEffect (client-only).
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Load from localStorage once on mount (client only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("twinmind-settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        // Migrate away from old/unavailable model IDs
        const BAD_MODELS = ["meta-llama/llama-4-maverick-17b-128e-instruct"];
        if (BAD_MODELS.includes(parsed.llmModel)) {
          parsed.llmModel = DEFAULT_SETTINGS.llmModel;
        }
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch {}
    setSettingsLoaded(true);
  }, []);

  // Persist to localStorage whenever settings change (after initial load)
  useEffect(() => {
    if (!settingsLoaded) return;
    localStorage.setItem("twinmind-settings", JSON.stringify(settings));
  }, [settings, settingsLoaded]);

  // Open settings if no API key (after loading)
  useEffect(() => {
    if (settingsLoaded && !settings.groqApiKey) setShowSettings(true);
  }, [settingsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toasts ────────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast["type"] = "error") => {
    const id = randomId();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  // ── Session state ─────────────────────────────────────────────────────────────
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [suggestionBatches, setSuggestionBatches] = useState<SuggestionBatch[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [isStreamingChat, setIsStreamingChat] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);

  const transcriptRef = useRef<TranscriptSegment[]>([]);
  transcriptRef.current = transcriptSegments;

  const isGeneratingRef = useRef(false);

  // Session timer
  useEffect(() => {
    if (!sessionStartTime) return;
    const interval = setInterval(() => setSessionDuration(Date.now() - sessionStartTime), 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // ── Transcription ─────────────────────────────────────────────────────────────
  const transcribeChunk = useCallback(async (blob: Blob, mimeType: string): Promise<string> => {
    const key = settingsRef.current.groqApiKey;
    if (!key) return "";

    const formData = new FormData();
    formData.append("audio", blob);
    formData.append("apiKey", key);
    formData.append("mimeType", mimeType);

    const res = await fetch("/api/transcribe", { method: "POST", body: formData });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Transcription failed: ${errText}`);
    }
    const data = await res.json();
    return (data.text as string) || "";
  }, []);

  // ── Suggestions ───────────────────────────────────────────────────────────────
  const generateSuggestions = useCallback(async (segments: TranscriptSegment[]) => {
    const cfg = settingsRef.current;
    if (!cfg.groqApiKey || isGeneratingRef.current) return;

    const recent = segments.slice(-cfg.transcriptContextSegments);
    if (recent.length === 0) return;

    const transcriptText = recent.map((s) => s.text).join("\n\n");
    isGeneratingRef.current = true;
    setIsGeneratingSuggestions(true);

    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptText,
          apiKey: cfg.groqApiKey,
          systemPrompt: cfg.suggestionPrompt,
          model: cfg.llmModel,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        showToast(`Suggestions failed: ${err.error ?? res.statusText}`);
        return;
      }

      const data = await res.json();
      const rawSuggestions: Array<{ type: Suggestion["type"]; title: string; preview: string }> =
        data.suggestions ?? [];

      if (rawSuggestions.length === 0) return;

      const suggestions: Suggestion[] = rawSuggestions.map((s) => ({
        id: randomId(),
        type: s.type,
        title: s.title,
        preview: s.preview,
        isLoadingAnswer: false,
      }));

      setSuggestionBatches((prev) => [
        ...prev,
        { id: randomId(), suggestions, createdAt: Date.now() },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Suggestions error: ${msg}`);
    } finally {
      isGeneratingRef.current = false;
      setIsGeneratingSuggestions(false);
    }
  }, [showToast]);

  // ── Audio chunk handler ───────────────────────────────────────────────────────
  const handleChunk = useCallback(
    async (blob: Blob, mimeType: string) => {
      if (!settingsRef.current.groqApiKey) return;
      setIsTranscribing(true);

      try {
        const text = await transcribeChunk(blob, mimeType);
        if (!text.trim()) return;

        const segment: TranscriptSegment = { id: randomId(), text, timestamp: Date.now() };
        const next = [...transcriptRef.current, segment];
        transcriptRef.current = next;
        setTranscriptSegments(next);
        generateSuggestions(next);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(`Transcription error: ${msg}`);
      } finally {
        setIsTranscribing(false);
      }
    },
    [transcribeChunk, generateSuggestions, showToast]
  );

  // ── Audio recorder ────────────────────────────────────────────────────────────
  const { isRecording, audioLevel, permissionError, startRecording, stopRecording, flushChunk } =
    useAudioRecorder({ chunkIntervalMs: settings.chunkIntervalMs, onChunk: handleChunk });

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      if (!sessionStartTime) setSessionStartTime(Date.now());
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording, sessionStartTime]);

  const handleRefresh = useCallback(() => {
    if (isRecording) {
      flushChunk();
    } else if (transcriptRef.current.length > 0) {
      generateSuggestions(transcriptRef.current);
    }
  }, [isRecording, flushChunk, generateSuggestions]);

  // ── Chat ──────────────────────────────────────────────────────────────────────
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;

  const sendChatMessage = useCallback(
    async (userText: string, sourceSuggestionId?: string) => {
      if (isStreamingChat) return;

      const userMsg: ChatMessage = {
        id: randomId(),
        role: "user",
        content: userText,
        sourceSuggestionId,
        timestamp: Date.now(),
      };

      const assistantMsgId = randomId();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
        timestamp: Date.now(),
      };

      setChatMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreamingChat(true);

      try {
        const cfg = settingsRef.current;
        const fullTranscript = transcriptRef.current.map((s) => s.text).join("\n\n");

        // Use ref to get current messages without stale closure
        const history = [...chatMessagesRef.current, userMsg]
          .slice(-cfg.chatContextMessages)
          .map(({ role, content }) => ({ role, content }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            transcriptContext: fullTranscript,
            apiKey: cfg.groqApiKey,
            systemPrompt: cfg.chatSystemPrompt,
            model: cfg.llmModel,
          }),
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "Unknown error");
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: `Error: ${errText}`, isStreaming: false }
                : m
            )
          );
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const snapshot = accumulated;
          setChatMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: snapshot } : m))
          );
        }

        setChatMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: `Error: ${msg}`, isStreaming: false } : m
          )
        );
      } finally {
        setIsStreamingChat(false);
      }
    },
    [isStreamingChat]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: Suggestion) => {
      if (isStreamingChat) return;

      setSuggestionBatches((prev) =>
        prev.map((batch) => ({
          ...batch,
          suggestions: batch.suggestions.map((s) =>
            s.id === suggestion.id ? { ...s, isLoadingAnswer: true } : s
          ),
        }))
      );

      const message = `[${suggestion.type}] ${suggestion.title}\n\n${suggestion.preview}\n\nPlease provide a comprehensive, detailed answer.`;

      sendChatMessage(message, suggestion.id).then(() => {
        setSuggestionBatches((prev) =>
          prev.map((batch) => ({
            ...batch,
            suggestions: batch.suggestions.map((s) =>
              s.id === suggestion.id ? { ...s, isLoadingAnswer: false } : s
            ),
          }))
        );
      });
    },
    [isStreamingChat, sendChatMessage]
  );

  // ── Answered suggestions ──────────────────────────────────────────────────────
  const answeredSuggestionIds = useMemo<Set<string>>(
    () =>
      new Set(
        chatMessages
          .filter((m) => m.sourceSuggestionId)
          .map((m) => m.sourceSuggestionId as string)
      ),
    [chatMessages]
  );

  // ── Export ────────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const data: SessionExport = {
      exportedAt: new Date().toISOString(),
      durationMs: sessionStartTime ? Date.now() - sessionStartTime : 0,
      transcript: transcriptSegments,
      suggestionBatches,
      chatHistory: chatMessages,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `twinmind-session-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transcriptSegments, suggestionBatches, chatMessages, sessionStartTime]);

  // ── Render ────────────────────────────────────────────────────────────────────
  const hasContent =
    transcriptSegments.length > 0 || suggestionBatches.length > 0 || chatMessages.length > 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Topbar */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-900">TwinMind</span>
          <span className="text-xs text-gray-400 hidden sm:block">Live Suggestions</span>
        </div>

        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-red-600 font-medium">Live</span>
            </div>
          )}
          <button
            onClick={handleExport}
            disabled={!hasContent}
            title="Export session"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
            {settingsLoaded && !settings.groqApiKey && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            )}
          </button>
        </div>
      </header>

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden divide-x divide-gray-100">
        <div className="w-[26%] min-w-[220px] overflow-hidden">
          <MicPanel
            isRecording={isRecording}
            audioLevel={audioLevel}
            permissionError={permissionError}
            transcriptSegments={transcriptSegments}
            isTranscribing={isTranscribing}
            onToggleRecording={handleToggleRecording}
            onRefresh={handleRefresh}
            hasApiKey={settingsLoaded && !!settings.groqApiKey}
            sessionDuration={sessionDuration}
          />
        </div>

        <div className="w-[37%] min-w-[280px] overflow-hidden">
          <SuggestionsPanel
            batches={suggestionBatches}
            isLoading={isGeneratingSuggestions}
            onSuggestionClick={handleSuggestionClick}
            answeredSuggestionIds={answeredSuggestionIds}
          />
        </div>

        <div className="flex-1 min-w-[280px] overflow-hidden">
          <ChatPanel
            messages={chatMessages}
            onSendMessage={sendChatMessage}
            isStreaming={isStreamingChat}
          />
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-slide-down max-w-sm pointer-events-auto ${
              toast.type === "error"
                ? "bg-red-600 text-white"
                : "bg-gray-900 text-white"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
