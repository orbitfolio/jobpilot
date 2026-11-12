import { assertPublicUrl } from "@/server/http";

interface CompleteBody {
  provider?: "openai" | "gemini" | "ollama";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  messages?: { role: string; content: string }[];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CompleteBody | null;
  if (!body?.messages?.length) return Response.json({ error: "Nothing to send." }, { status: 400 });
  const messages = body.messages.slice(0, 8).map((message) => ({
    role: message.role === "system" ? "system" : "user",
    content: String(message.content ?? "").slice(0, 20000),
  }));
  const model = (body.model || "").trim();
  const key = body.apiKey?.trim() ?? "";
  try {
    if (body.provider === "gemini") {
      if (!key) return Response.json({ error: "Add a Gemini API key in Settings." }, { status: 400 });
      const text = await gemini(model || "gemini-2.5-flash", key, messages);
      return Response.json({ text: scrub(text, key) });
    }
    const base = (body.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
    await assertPublicUrl(`${base}/chat/completions`);
    if (!key) return Response.json({ error: "Add an API key in Settings." }, { status: 400 });
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(45000),
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: model || "gpt-4o-mini", temperature: 0.2, messages }),
    });
    const payload = (await response.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null;
    if (!response.ok) {
      return Response.json({ error: scrub(payload?.error?.message || `The provider returned HTTP ${response.status}.`, key) }, { status: 502 });
    }
    const text = payload?.choices?.[0]?.message?.content ?? "";
    return Response.json({ text: scrub(text, key) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The model request failed.";
    return Response.json({ error: scrub(message, key) }, { status: 502 });
  }
}

async function gemini(model: string, key: string, messages: { role: string; content: string }[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  await assertPublicUrl(url);
  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: messages.map((message) => `${message.role}: ${message.content}`).join("\n\n") }] }],
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  } | null;
  if (!response.ok) throw new Error(payload?.error?.message || `Gemini returned HTTP ${response.status}.`);
  return payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
}

function scrub(text: string, key: string): string {
  if (!key) return text;
  return text.split(key).join("[redacted]");
}
