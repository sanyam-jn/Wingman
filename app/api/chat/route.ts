import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import type { ChatApiRequest } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body: ChatApiRequest = await req.json();
    const { messages, transcriptContext, apiKey, systemPrompt, model } = body;

    if (!apiKey) {
      return new Response("Missing API key", { status: 400 });
    }
    if (!messages?.length) {
      return new Response("No messages provided", { status: 400 });
    }

    const resolvedSystemPrompt = systemPrompt.replace(
      "{{TRANSCRIPT}}",
      transcriptContext || "(No transcript yet)"
    );
    const resolvedModel = model || "llama-3.3-70b-versatile";

    const groq = new Groq({ apiKey });

    const stream = await groq.chat.completions.create({
      model: resolvedModel,
      messages: [{ role: "system", content: resolvedSystemPrompt }, ...messages],
      stream: true,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chat]", message);
    return new Response(message, { status: 500 });
  }
}
