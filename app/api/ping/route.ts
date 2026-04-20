import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

// Quick health-check: verifies the API key works and the model responds
export async function POST(req: NextRequest) {
  try {
    const { apiKey, model } = await req.json();
    if (!apiKey?.trim()) {
      return NextResponse.json({ ok: false, error: "No API key" }, { status: 400 });
    }

    const groq = new Groq({ apiKey: apiKey.trim() });
    const completion = await groq.chat.completions.create({
      model: model?.trim() || "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: 'Reply with the single word "ok"' }],
      max_tokens: 5,
    });

    const reply = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ ok: true, reply, model: model });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
