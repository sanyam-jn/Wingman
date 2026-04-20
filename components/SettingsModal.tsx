"use client";

import { useState } from "react";
import type { AppSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/defaults";

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

export default function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [draft, setDraft] = useState<AppSettings>({ ...settings });
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [testError, setTestError] = useState("");

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const resetPrompt = (key: "suggestionPrompt" | "chatSystemPrompt") =>
    update(key, DEFAULT_SETTINGS[key]);

  const handleTestConnection = async () => {
    if (!draft.groqApiKey?.trim()) {
      setTestError("Paste your API key first");
      setTestStatus("error");
      return;
    }
    setTestStatus("loading");
    setTestError("");
    try {
      const res = await fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: draft.groqApiKey, model: draft.llmModel }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestStatus("ok");
      } else {
        setTestStatus("error");
        setTestError(data.error ?? "Unknown error");
      }
    } catch (err) {
      setTestStatus("error");
      setTestError(err instanceof Error ? err.message : "Network error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* API Key */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Groq API Key</h3>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={draft.groqApiKey}
                onChange={(e) => update("groqApiKey", e.target.value)}
                placeholder="gsk_..."
                className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-400">Stored locally. Never sent anywhere except directly to Groq.</p>
              <button
                onClick={handleTestConnection}
                disabled={testStatus === "loading"}
                className="shrink-0 ml-3 px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {testStatus === "loading" ? "Testing…" : "Test connection"}
              </button>
            </div>
            {testStatus === "ok" && (
              <p className="mt-1.5 text-xs text-emerald-600 font-medium">API key works</p>
            )}
            {testStatus === "error" && (
              <p className="mt-1.5 text-xs text-red-600">{testError || "Connection failed"}</p>
            )}
          </section>

          {/* Model */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">LLM Model</h3>
            <input
              type="text"
              value={draft.llmModel}
              onChange={(e) => update("llmModel", e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            />
            <p className="text-xs text-gray-400 mt-1.5">Used for suggestions and chat. Whisper Large V3 is always used for transcription.</p>
          </section>

          {/* Context Windows */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Context Windows</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-xs text-gray-600">Transcript segments for suggestions</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={1} max={20}
                    value={draft.transcriptContextSegments}
                    onChange={(e) => update("transcriptContextSegments", Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium text-gray-700 w-6 text-right">{draft.transcriptContextSegments}</span>
                </div>
                <p className="text-xs text-gray-400">≈ {Math.round(draft.transcriptContextSegments * 0.5)} min of context</p>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs text-gray-600">Chat messages to include</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={2} max={40}
                    value={draft.chatContextMessages}
                    onChange={(e) => update("chatContextMessages", Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium text-gray-700 w-6 text-right">{draft.chatContextMessages}</span>
                </div>
              </label>
            </div>
          </section>

          {/* Recording */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recording</h3>

            <label className="space-y-1.5">
              <span className="text-xs text-gray-600">Max chunk interval (seconds)</span>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={10} max={60} step={5}
                  value={draft.chunkIntervalMs / 1000}
                  onChange={(e) => update("chunkIntervalMs", Number(e.target.value) * 1000)}
                  className="flex-1"
                />
                <span className="text-sm font-medium text-gray-700 w-8 text-right">{draft.chunkIntervalMs / 1000}s</span>
              </div>
            </label>

            {/* VAD toggle */}
            <div className="flex items-center justify-between mt-4">
              <div>
                <span className="text-xs text-gray-600 font-medium">Voice Activity Detection (VAD)</span>
                <p className="text-xs text-gray-400 mt-0.5">
                  Flush chunk automatically when silence is detected — faster suggestions
                </p>
              </div>
              <button
                onClick={() => update("enableVAD", !draft.enableVAD)}
                role="switch"
                aria-checked={draft.enableVAD}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer focus:outline-none ${
                  draft.enableVAD ? "bg-gray-900" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    draft.enableVAD ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* VAD silence threshold */}
            {draft.enableVAD && (
              <label className="space-y-1.5 mt-3 block">
                <span className="text-xs text-gray-600">Silence threshold</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={500} max={3000} step={250}
                    value={draft.vadSilenceMs}
                    onChange={(e) => update("vadSilenceMs", Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium text-gray-700 w-14 text-right">{draft.vadSilenceMs}ms</span>
                </div>
                <p className="text-xs text-gray-400">Silence duration before flush (min 5s chunk duration enforced)</p>
              </label>
            )}
          </section>

          {/* Suggestion Prompt */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Suggestions Prompt</h3>
              <button onClick={() => resetPrompt("suggestionPrompt")} className="text-xs text-blue-600 hover:text-blue-800">
                Reset to default
              </button>
            </div>
            <textarea
              value={draft.suggestionPrompt}
              onChange={(e) => update("suggestionPrompt", e.target.value)}
              rows={8}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-mono leading-relaxed focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 resize-y"
            />
          </section>

          {/* Chat Prompt */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chat System Prompt</h3>
              <button onClick={() => resetPrompt("chatSystemPrompt")} className="text-xs text-blue-600 hover:text-blue-800">
                Reset to default
              </button>
            </div>
            <textarea
              value={draft.chatSystemPrompt}
              onChange={(e) => update("chatSystemPrompt", e.target.value)}
              rows={6}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-mono leading-relaxed focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 resize-y"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Use <code className="bg-gray-100 px-1 rounded">{"{{TRANSCRIPT}}"}</code> to inject the live transcript.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-gray-700 transition-colors">
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
