import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import type { SuggestionsApiRequest, SuggestionsApiResponse, SuggestionType } from "@/lib/types";

export const maxDuration = 30;

const VALID_TYPES = new Set<SuggestionType>([
  "ANSWER",
  "FACT_CHECK",
  "QUESTION",
  "TALKING_POINT",
  "CLARIFICATION",
]);

function extractJson(raw: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(raw);
  } catch {}
  // Try extracting JSON block from markdown fences
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }
  // Try extracting first { ... } block
  const braceStart = raw.indexOf("{");
  const braceEnd = raw.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try { return JSON.parse(raw.slice(braceStart, braceEnd + 1)); } catch {}
  }
  return null;
}

function validateSuggestions(raw: unknown): SuggestionsApiResponse["suggestions"] {
  if (!raw || typeof raw !== "object") throw new Error("Invalid suggestions shape");
  const items = (raw as Record<string, unknown>).suggestions;
  if (!Array.isArray(items)) throw new Error("Missing suggestions array");
  return items.slice(0, 3).map((item) => {
    const s = item as Record<string, unknown>;
    const type =
      typeof s.type === "string" && VALID_TYPES.has(s.type as SuggestionType)
        ? (s.type as SuggestionType)
        : "TALKING_POINT";
    return {
      type,
      title: typeof s.title === "string" ? s.title.slice(0, 100) : "Suggestion",
      preview: typeof s.preview === "string" ? s.preview.slice(0, 500) : "",
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const body: SuggestionsApiRequest = await req.json();
    const { transcriptText, apiKey, systemPrompt, model } = body;

    if (!apiKey?.trim()) {
      return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    }
    if (!transcriptText?.trim()) {
      return NextResponse.json({ error: "No transcript text" }, { status: 400 });
    }

    const groq = new Groq({ apiKey: apiKey.trim() });
    const resolvedModel = model?.trim() || "llama-3.3-70b-versatile";

    // Note: NOT using response_format json_object — more compatible across models/tiers
    const completion = await groq.chat.completions.create({
      model: resolvedModel,
      messages: [
        {
          role: "system",
          content:
            systemPrompt +
            "\n\nIMPORTANT: You MUST respond with ONLY raw JSON — no markdown, no explanation, no code fences.",
        },
        {
          role: "user",
          content: `RECENT TRANSCRIPT:\n${transcriptText}\n\nGenerate 3 contextually appropriate suggestions. Return ONLY the JSON object.`,
        },
      ],
      temperature: 0.65,
      max_tokens: 900,
    });

    const rawText = completion.choices[0]?.message?.content ?? "";
    const parsed = extractJson(rawText);

    if (!parsed) {
      console.error("[suggestions] Could not parse JSON from:", rawText.slice(0, 200));
      return NextResponse.json(
        { error: "Model returned non-JSON response", raw: rawText.slice(0, 200) },
        { status: 502 }
      );
    }

    const suggestions = validateSuggestions(parsed);
    return NextResponse.json({ suggestions } satisfies SuggestionsApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[suggestions]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
