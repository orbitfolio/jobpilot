import type { AiSecrets } from "@/lib/types";

const KEY = "career-ops-by-vish.secrets";

export const EMPTY_SECRETS: AiSecrets = {
  provider: "none",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
};

export function loadSecrets(): AiSecrets {
  if (typeof window === "undefined") return EMPTY_SECRETS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_SECRETS;
    const parsed = JSON.parse(raw) as Partial<AiSecrets>;
    return { ...EMPTY_SECRETS, ...parsed, apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "" };
  } catch {
    return EMPTY_SECRETS;
  }
}

export function saveSecrets(secrets: AiSecrets): void {
  window.localStorage.setItem(KEY, JSON.stringify(secrets));
}

export async function completeAi(secrets: AiSecrets, messages: { role: string; content: string }[]): Promise<{ text?: string; error?: string }> {
  if (secrets.provider === "none") return { error: "No model is selected. The rule-based draft is still available." };
  if (secrets.provider === "ollama") {
    try {
      const response = await fetch(`${secrets.baseUrl.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: secrets.model || "llama3.2", messages, stream: false }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: { content?: string }; error?: string } | null;
      if (!response.ok) return { error: payload?.error || `Ollama returned HTTP ${response.status}.` };
      return { text: payload?.message?.content ?? "" };
    } catch {
      return { error: "The browser could not reach Ollama. Start it locally and set OLLAMA_ORIGINS so this site is allowed. The server does not call 127.0.0.1 on your behalf." };
    }
  }
  const response = await fetch("/api/ai/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: secrets.provider,
      apiKey: secrets.apiKey,
      baseUrl: secrets.baseUrl,
      model: secrets.model,
      messages,
    }),
  });
  const payload = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
  if (!response.ok) return { error: payload?.error || "The model request failed." };
  return { text: payload?.text ?? "" };
}
