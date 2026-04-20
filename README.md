
A real-time AI meeting Wingman that listens to your conversations and surfaces useful suggestions as you speak.

## Live Demo

[Deployed URL — add after deployment]

## Stack

- **Next.js 15** (App Router) + **TypeScript** — full-stack framework
- **Tailwind CSS** — styling
- **Groq SDK** — all AI calls
  - **Whisper Large V3** — speech-to-text transcription
  - **meta-llama/llama-4-maverick-17b-128e-instruct** — suggestions + chat (128k context, fast)
- **Web Audio API / MediaRecorder** — browser mic capture
- No database, no auth — single session, client-side state

## Features

| Column | What it does |
|--------|-------------|
| **Transcript** (left) | Start/stop mic, shows live transcript chunks with timestamps, auto-scrolls |
| **Live Suggestions** (middle) | 3 suggestion cards per batch, newest on top, auto-refreshes every ~30s |
| **Chat** (right) | Click a suggestion for a detailed answer, or type directly; streaming responses |

Additional:
- **Settings panel** — paste your Groq API key, edit prompts, tune context windows
- **Export button** — downloads full session as JSON (transcript + suggestion batches + chat)

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Settings**, paste your Groq API key, then click the mic.

## Architecture

```
app/
  api/
    transcribe/     # POST: audio blob → Groq Whisper → text
    suggestions/    # POST: transcript text → LLM → 3 suggestion cards (JSON mode)
    chat/           # POST: messages + transcript → LLM → streaming text response
  page.tsx          # State orchestration: recording, transcription, suggestions, chat
components/
  MicPanel          # Mic button, audio level, transcript list
  SuggestionsPanel  # Batches of suggestion cards, newest on top
  ChatPanel         # Streaming chat interface
  SettingsModal     # API key, prompts, context window sliders
hooks/
  useAudioRecorder  # MediaRecorder abstraction: 30s chunks, audio level, cleanup
lib/
  types.ts          # All TypeScript interfaces
  defaults.ts       # Default prompts, settings, type metadata
```

## Prompt Strategy

### Live Suggestions
The key insight: **the right suggestion type depends entirely on what just happened in the conversation.**

The system prompt instructs the model to:
1. Prioritize `ANSWER` when a direct question was just asked — give the answer in the preview itself
2. Use `FACT_CHECK` when a verifiable claim was stated — assess accuracy directly in the preview  
3. Use `QUESTION` to surface smart follow-ups — write the full question in the preview
4. Use `TALKING_POINT` when an elaboration would add value — lead with the most interesting insight
5. Use `CLARIFICATION` for ambiguous terms — define it right in the preview

**Critical rule:** The preview text must deliver standalone value. A user should get something useful just from reading the card, before ever clicking. Clicking expands to a deeper answer with full context.

**Context window:** Last N transcript segments (default: 6, ~3 min), configurable. This keeps suggestions focused on the recent conversation without noise from much earlier.

### Chat (Detailed Answers)
When a suggestion is clicked, the full message to the chat API is:
```
[ANSWER] What is the ROI timeline for this feature?

Short term gains offset by 6-month dev cost; typical payback is 12–18 months.

Please provide a comprehensive, detailed answer.
```

The chat API receives the **complete transcript** as context (Llama 4 Maverick has 128k context, so even a 2-hour meeting stays well within limits). This gives the model full conversation history to ground the answer.

**Streaming** is used for chat to minimize time-to-first-token (perceived as instant response).

### Tradeoffs

| Decision | Reasoning |
|----------|-----------|
| JSON mode for suggestions | Reliable parsing; no markdown stripping needed |
| Full transcript for chat, windowed for suggestions | Suggestions need recency; chat needs completeness |
| 30s default chunk interval | Balances latency vs. API calls; configurable |
| Whisper Large V3 (not Turbo) | Better accuracy for varied accents and noisy environments |
| No external state library | Overkill for a single-session, single-page app |
| API routes (not direct browser calls) | Keeps key out of browser network logs; handles CORS cleanly |

## Environment

The app uses **user-provided API keys only** — no `.env` required. Keys are stored in `localStorage` and forwarded to Groq via the Next.js API routes.

## Deployment

```bash
# Vercel (recommended)
npx vercel --prod
```

The app is stateless and requires no environment variables for deployment.
