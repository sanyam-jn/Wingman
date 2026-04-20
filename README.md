# Wingman — Live Meeting Suggestions

A real-time AI meeting Wingman that listens to your conversations and surfaces useful suggestions as you speak.

## Live Demo

https://wingman-live-suggestions.vercel.app

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Settings**, paste your Groq API key (`gsk_...`), then click the mic.

---

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Groq SDK**
  - **Whisper Large V3** — speech-to-text transcription
  - **llama-3.3-70b-versatile** — suggestions + chat
  - **llama-3.1-8b-instant** — fast meeting context classification
- **Web Audio API / MediaRecorder** — mic capture + VAD
- No database, no auth — single session, client-side state

---

## Features

### Three-column layout

| Column | What it does |
|--------|-------------|
| **Transcript** (left) | Start/stop mic, live transcript with timestamps, auto-scrolls |
| **Live Suggestions** (middle) | 3 suggestion cards per batch, newest on top, auto-refreshes |
| **Chat** (right) | Click a suggestion to open a focused thread, or type directly |

### Live Suggestions
- **5 suggestion types**: `ANSWER`, `FACT_CHECK`, `QUESTION`, `TALKING_POINT`, `CLARIFICATION`
- Each card shows a **reason** (why it was surfaced) and a **relevance score** — low-scoring suggestions are filtered out before reaching the UI
- Preview text delivers **standalone value** — you get something useful without ever clicking
- Clicking a card opens a **dedicated thread** in the chat panel, scoped to that suggestion
- Keyboard shortcuts: press **1**, **2**, **3** to open the latest suggestions; **R** to refresh

### Smart Audio Pipeline
- **Voice Activity Detection (VAD)**: flushes the audio chunk automatically when silence is detected (default 1.5s), instead of waiting for the full 30s timer — suggestions appear much faster after you stop talking
- **Whisper prompt injection**: passes the last 2 sentences of the previous chunk to Whisper, improving transcription continuity across chunk boundaries
- **Parallel suggestion generation**: kicks off suggestions on the prior transcript while the current chunk is still transcribing — cuts perceived latency roughly in half
- **Text preprocessing**: strips filler words (um, uh, like, you know) and summarizes older context before sending to the LLM

### Meeting Context Detection
After the 2nd transcript chunk, a fast background call classifies the conversation type:
`Technical Discussion` · `Job Interview` · `Sales Call` · `Brainstorm` · `General`

This badge appears in the header and adapts the suggestion prompt — e.g. a Job Interview context prioritizes STAR-format answers; a Sales Call context prioritizes objection handling.

### Settings (all live-editable, no redeploy needed)
- Groq API key (stored in `localStorage`, never hardcoded)
- LLM model name
- Suggestion prompt + chat system prompt (with reset-to-default)
- Context window sizes (segments for suggestions, messages for chat)
- Chunk interval, VAD toggle, VAD silence threshold
- **Test connection** button to verify the API key works

### Export
Downloads the full session as JSON: transcript + all suggestion batches + full chat + thread history.

---

## Architecture

```
app/
  api/
    transcribe/       # Groq Whisper Large V3, accepts whisperPrompt for continuity
    suggestions/      # LLM → 3 suggestion cards with reason + score, meeting-context aware
    chat/             # Streaming LLM response, thread-context aware
    detect-context/   # llama-3.1-8b-instant classifies conversation type
    ping/             # API key health check
  page.tsx            # State orchestration — recording, transcription, suggestions, chat, threads
components/
  MicPanel            # Mic button, audio level display, scrolling transcript
  SuggestionsPanel    # Batched suggestion cards, key hints, reason text
  ChatPanel           # Streaming chat + suggestion thread view
  SettingsModal       # All configurable settings with live sliders
hooks/
  useAudioRecorder    # MediaRecorder + VAD (silence detection) + audio level display
lib/
  types.ts            # All TypeScript interfaces
  defaults.ts         # Default prompts, settings, badge colors, type metadata
  textUtils.ts        # stripFillers, buildSuggestionContext, getWhisperPrompt
```

---

## Prompt Strategy

### Suggestion types — when each fires

| Type | Trigger |
|------|---------|
| `ANSWER` | A direct question was just asked — answer goes directly in the preview |
| `FACT_CHECK` | A verifiable claim was stated — verdict goes in the preview |
| `QUESTION` | A smart follow-up would advance the conversation |
| `TALKING_POINT` | Relevant data or insight would strengthen the discussion |
| `CLARIFICATION` | An ambiguous term or acronym needs defining |

**Critical rule:** The preview must deliver standalone value. A user should get something useful just from reading the card, before clicking. Clicking opens a full thread with a deeper, transcript-grounded answer.

### Context window strategy
- **Suggestions**: last N segments (default 6, ~3 min), with older context summarized and recent segments kept verbatim. Keeps the model focused on what's happening *now*.
- **Chat**: full transcript sent every call (Llama 3.3 70B has 128k context — even a 2-hour session fits). Gives the model complete history for grounded answers.

### Meeting context adaptation
After classification, the suggestion system prompt gets a context-specific instruction appended:
- **Job Interview** → STAR format, clarify ambiguous questions, highlight relevant experience
- **Sales Call** → value propositions, objection handling, ROI framing, next steps
- **Technical Discussion** → architecture trade-offs, implementation details, code examples
- **Brainstorm** → creative divergence, idea expansion, non-obvious angles

### Suggestion scoring + filtering
Each suggestion includes a `score` (1–10) and `reason`. Suggestions scoring below 4 are dropped server-side before returning to the UI. This prevents low-quality suggestions when the transcript is sparse or off-topic.

### Tradeoffs

| Decision | Reasoning |
|----------|-----------|
| VAD over fixed-timer chunking | Suggestions appear right after natural speech pauses, not on an arbitrary clock |
| Whisper `prompt` injection | Fixes cut-off words and proper nouns at chunk boundaries — Groq supports this but few use it |
| Parallel suggestions | Pre-chunk generation hides transcription latency; second generation catches the new text |
| Filler word stripping | Cleaner transcript text → more precise LLM output |
| Suggestion threads over single chat | Keeps follow-up context scoped; avoids polluting the general chat with suggestion answers |
| Fast model for context detection | `llama-3.1-8b-instant` adds ~200ms; not worth using the large model for a binary classification |
| No JSON mode for suggestions | More compatible across Groq model tiers; robust JSON extractor handles edge cases |
| No external state library | Single session, single page — React state + refs is sufficient |
| API routes over direct browser calls | Key never appears in browser network tab; handles CORS cleanly |

---

## Environment

User-provided API keys only — no `.env` required. Keys are stored in `localStorage` and forwarded server-side via Next.js API routes (never exposed in responses).

## Deployment

```bash
npx vercel --prod
```

Stateless — no environment variables needed.
