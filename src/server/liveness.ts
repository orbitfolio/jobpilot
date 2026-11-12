import { htmlToText } from "@/lib/text";
import { readBody, safeFetch } from "@/server/http";

const CLOSED = [
  "no longer accepting applications",
  "no longer accepting application",
  "this job is no longer available",
  "this position has been filled",
  "position has been filled",
  "job has expired",
  "posting has expired",
  "this job is closed",
  "this position is closed",
  "no longer available",
  "sorry, this job is not available",
];

export interface LivenessPayload {
  url: string;
  finalUrl: string;
  httpStatus: number | null;
  state: "live" | "closed" | "unknown";
  signals: string[];
  text: string;
  checkedAt: string;
}

export async function checkLiveness(url: string): Promise<LivenessPayload> {
  const checkedAt = new Date().toISOString();
  try {
    const { response, finalUrl } = await safeFetch(url, {}, 12000);
    const raw = await readBody(response, 600_000);
    const contentType = response.headers.get("content-type") ?? "";
    const text = (contentType.includes("html") || raw.trim().startsWith("<") ? htmlToText(raw) : raw).slice(0, 14000);
    const signals: string[] = [`HTTP ${response.status}.`];
    const closedPhrase = CLOSED.find((phrase) => text.toLowerCase().includes(phrase));
    if (closedPhrase) signals.push(`The page says “${closedPhrase}”.`);
    if (text.length < 180) signals.push("Very little text came back, so the posting body may be behind a script or a login.");
    let state: LivenessPayload["state"] = "unknown";
    if (response.status === 404 || response.status === 410 || closedPhrase) state = "closed";
    else if (response.ok && text.length >= 180 && !closedPhrase) state = "live";
    else signals.push("The response was not a clear open or closed posting. Treat this as unknown, not as proof.");
    return { url, finalUrl, httpStatus: response.status, state, signals, text, checkedAt };
  } catch (error) {
    return {
      url,
      finalUrl: url,
      httpStatus: null,
      state: "unknown",
      signals: [error instanceof Error ? error.message : "The posting could not be fetched."],
      text: "",
      checkedAt,
    };
  }
}
