import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import type { SuggestionsApiRequest, SuggestionsApiResponse, SuggestionType } from "@/lib/types";
import { MEETING_CONTEXT_INSTRUCTIONS } from "@/lib/defaults";

export const maxDuration = 30;

const VALID_TYPES = new Set<SuggestionType>([
  "ANSWER",
  "FACT_CHECK",
  "QUESTION",
  "TALKING_POINT",
  "CLARIFICATION",
]);

function extractJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
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

  return items
    .slice(0, 5)
    .map((item) => {
      const s = item as Record<string, unknown>;
      const type =
        typeof s.type === "string" && VALID_TYPES.has(s.type as SuggestionType)
          ? (s.type as SuggestionType)
          : "TALKING_POINT";
      const score =
        typeof s.score === "number"
          ? Math.min(10, Math.max(1, Math.round(s.score)))
          : undefined;
      return {
        type,
        title: typeof s.title === "string" ? s.title.slice(0, 100) : "Suggestion",
        preview: typeof s.preview === "string" ? s.preview.slice(0, 500) : "",
        reason: typeof s.reason === "string" ? s.reason.slice(0, 200) : undefined,
        score,
      };
    })
    .filter((s) => (s.score ?? 10) >= 4); // drop low-relevance suggestions
}

export async function POST(req: NextRequest) {
  try {
    const body: SuggestionsApiRequest = await req.json();
    const { transcriptText, apiKey, systemPrompt, model, meetingContext } = body;

    if (!apiKey?.trim()) {
      return NextResponse.json({ error: "Missing API key" }, { status: 400 });
    }
    if (!transcriptText?.trim()) {
      return NextResponse.json({ error: "No transcript text" }, { status: 400 });
    }

    // Append meeting-context-specific instruction
    const contextInstruction = meetingContext
      ? (MEETING_CONTEXT_INSTRUCTIONS[meetingContext.type] ?? "")
      : "";

    const fullSystemPrompt =
      systemPrompt +
      (contextInstruction ? `\n\n${contextInstruction}` : "") +
      "\n\nIMPORTANT: Respond with ONLY raw JSON — no markdown, no explanation, no code fences.";

    const groq = new Groq({ apiKey: apiKey.trim() });

    const completion = await groq.chat.completions.create({
      model: model?.trim() || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: fullSystemPrompt },
        {
          role: "user",
          content: `RECENT TRANSCRIPT:\n${transcriptText}\n\nGenerate 3 contextually appropriate suggestions with reason and score. Return ONLY the JSON object.`,
        },
      ],
      temperature: 0.65,
      max_tokens: 1200,
    });

    const rawText = completion.choices[0]?.message?.content ?? "";
    const parsed = extractJson(rawText);

    if (!parsed) {
      console.error("[suggestions] Non-JSON response:", rawText.slice(0, 200));
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
