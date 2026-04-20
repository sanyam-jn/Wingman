import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

function getMimeExtension(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const apiKey = formData.get("apiKey") as string | null;
  const audioBlob = formData.get("audio") as Blob | null;
  const mimeType = (formData.get("mimeType") as string | null) ?? "audio/webm";

  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 400 });
  }
  if (!audioBlob || audioBlob.size === 0) {
    return NextResponse.json({ error: "Missing or empty audio" }, { status: 400 });
  }

  const ext = getMimeExtension(mimeType);
  const file = new File([audioBlob], `audio.${ext}`, { type: mimeType });

  const groq = new Groq({ apiKey });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: "text",
    language: "en",
  });

  // groq returns a string when response_format is "text"
  const text = typeof transcription === "string" ? transcription : (transcription as { text: string }).text;

  return NextResponse.json({ text: text.trim() });
}
