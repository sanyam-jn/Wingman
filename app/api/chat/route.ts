import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import type { ChatApiRequest } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body: ChatApiRequest = await req.json();
    const { messages, transcriptContext, apiKey, systemPrompt, model, threadContext } = body;

    if (!apiKey?.trim()) {
      return new Response("Missing API key", { status: 400 });
    }
    if (!messages?.length) {
      return new Response("No messages provided", { status: 400 });
    }

    let resolvedSystemPrompt = systemPrompt.replace(
      "{{TRANSCRIPT}}",
      transcriptContext || "(No transcript yet)"
    );

    // Thread-scoped context: keep the assistant focused on the suggestion topic
    if (threadContext) {
      resolvedSystemPrompt +=
        `\n\nThis conversation is focused on the following suggestion:\n` +
        `[${threadContext.suggestionType}] ${threadContext.suggestionTitle}\n` +
        `${threadContext.suggestionPreview}\n\n` +
        `Stay focused on this topic. Provide a thorough, grounded answer.`;
    }

    const groq = new Groq({ apiKey: apiKey.trim() });

    const stream = await groq.chat.completions.create({
      model: model?.trim() || "llama-3.3-70b-versatile",
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
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chat]", message);
    return new Response(message, { status: 500 });
  }
}
