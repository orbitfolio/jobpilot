export const STOP_WORDS = new Set(
  `a an the and or of to for in on with from by at as is are was were be been being this that those these it its their our your you we they i my me into over under about than then so if but not no yes per via also more most other such only just very can will may should would could have has had do does did done its own within without during after before onto across each both any all some than too`.split(
    /\s+/,
  ),
);

export const PARAPHRASE_VERBS = new Set(
  `led built owned shipped improved reduced increased launched designed mentored partnered delivered established introduced scaled automated wrote managed supported collaborated created developed implemented drove grew ran cut shortened`.split(
    /\s+/,
  ),
);

export const COVER_GLUE = new Set(
  `writing role posting opportunity team company based open conversation short interested applied application remain happy share anything else need hello hi dear hiring sincerely regards thank thanks about looks close would manager recruiter note recent work mapping relevant project target range annually year years per legally status today still glad talk brief people person reach reaching out because where while through using used second proof point same record lines another following`.split(
    /\s+/,
  ),
);

const SHORT_SKILLS = new Set(
  ["sql", "aws", "gcp", "api", "ios", "sap", "qa", "nlp", "llm", "cpa", "pmp", "seo", "sem", "dbt", "go"],
);

export function createId(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|tr|section)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function stem(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith("ing") && w.length > 6) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 5) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 5) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 4) return w.slice(0, -1);
  return w;
}

export function contentTokens(text: string, extraStop: Set<string> = new Set()): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z0-9+#.]{1,}/g) ?? [];
  const seen: string[] = [];
  for (const raw of words) {
    const word = raw.replace(/^\.+|\.+$/g, "");
    if (!word || STOP_WORDS.has(word) || PARAPHRASE_VERBS.has(word) || extraStop.has(word)) continue;
    if (word.length >= 4 || SHORT_SKILLS.has(word)) seen.push(word);
  }
  return seen;
}

export function includesPhrase(haystack: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(haystack);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function daysFromNow(days: number, from = new Date()): string {
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

export function daysAgo(days: number, from = new Date()): string {
  return daysFromNow(-days, from);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(date);
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-CA")}`;
  }
}

export function quoteWindow(text: string, needle: string, radius = 80): string {
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return "";
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + needle.length + radius);
  const slice = normalizeSpace(text.slice(start, end));
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}
