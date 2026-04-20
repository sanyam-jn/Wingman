import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import type { DetectContextApiRequest, DetectContextApiResponse, MeetingContextType } from "@/lib/types";
import { MEETING_CONTEXT_LABELS } from "@/lib/defaults";

export const maxDuration = 15;

const VALID_TYPES: MeetingContextType[] = [
  "technical_discussion",
  "job_interview",
  "sales_call",
  "brainstorm",
  "general",
];

const FALLBACK: DetectContextApiResponse = {
  type: "general",
  label: "General",
  confidence: 0,
};

export async function POST(req: NextRequest) {
  try {
    const body: DetectContextApiRequest = await req.json();
    const { transcriptText, apiKey } = body;

    if (!apiKey?.trim() || !transcriptText?.trim()) {
      return NextResponse.json(FALLBACK);
    }

    const groq = new Groq({ apiKey: apiKey.trim() });

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant", // fast small model, only needs to classify
      messages: [
        {
          role: "system",
          content: `Classify the meeting/conversation type from the transcript excerpt.
Respond ONLY with valid JSON: { "type": "...", "confidence": 0.0 }
Type must be exactly one of: technical_discussion, job_interview, sales_call, brainstorm, general
confidence is a float 0.0–1.0.`,
        },
        {
          role: "user",
          content: `TRANSCRIPT:\n${transcriptText.slice(0, 1000)}\n\nClassify this conversation type.`,
        },
      ],
      temperature: 0.1,
      max_tokens: 60,
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    let parsed: { type?: string; confidence?: number } = {};
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(FALLBACK);
    }

    const type = VALID_TYPES.includes(parsed.type as MeetingContextType)
      ? (parsed.type as MeetingContextType)
      : "general";

    const confidence =
      typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.5;

    return NextResponse.json({
      type,
      label: MEETING_CONTEXT_LABELS[type],
      confidence,
    } satisfies DetectContextApiResponse);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
