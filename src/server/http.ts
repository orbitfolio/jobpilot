import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal", "metadata.internal"]);

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a full http or https URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https URLs can be fetched.");
  if (url.username || url.password) throw new Error("URLs with embedded passwords are not fetched.");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That host is not fetched from the server.");
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("Private network addresses are not fetched.");
    return url;
  }
  const records = await lookup(host, { all: true });
  if (records.length === 0) throw new Error("The host did not resolve.");
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("That host resolves to a private address and was not fetched.");
  }
  return url;
}

export async function safeFetch(raw: string, init: RequestInit = {}, timeoutMs = 12000): Promise<{ response: Response; finalUrl: string }> {
  let current = raw;
  for (let hop = 0; hop < 4; hop += 1) {
    const url = await assertPublicUrl(current);
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CareerOpsByVish/1.0; +https://example.invalid/career-ops)",
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        ...(init.headers ?? {}),
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The site redirected without a location.");
      current = new URL(location, url).toString();
      continue;
    }
    return { response, finalUrl: url.toString() };
  }
  throw new Error("The site redirected too many times.");
}

export async function readBody(response: Response, limit = 2_500_000): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < limit) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    chunks.push(next.value);
  }
  reader.cancel().catch(() => undefined);
  const text = new TextDecoder().decode(concat(chunks));
  return text.slice(0, limit);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "0.0.0.0") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const parts = normalized.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}
