import type { BoardKind, JobSource } from "@/lib/types";
import { htmlToText, normalizeSpace } from "@/lib/text";

export interface NormalizedJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salaryLabel: string;
  postedAt: string | null;
  sourceKind: BoardKind;
  sourceName: string;
}

export interface BoardFetchPlan {
  kind: "json-get" | "json-post" | "html-get" | "paste";
  url: string;
  body?: unknown;
  note: string;
}

const TOKEN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}$/;

export function assertBoardToken(token: string): string {
  const trimmed = token.trim();
  if (!TOKEN.test(trimmed)) throw new Error("Board token may only contain letters, numbers, dots, dashes, and underscores.");
  return trimmed;
}

export function planBoardFetch(source: Pick<JobSource, "kind" | "token" | "keywords" | "location" | "workday" | "name">): BoardFetchPlan {
  if (source.kind === "indeed") {
    return {
      kind: "paste",
      url: "",
      note: "Indeed does not publish a public JSON API for this app. Paste a posting URL or the description. The saved search still remembers the keywords.",
    };
  }
  if (source.kind === "manual") {
    return { kind: "paste", url: "", note: "Manual source. Paste postings into Evaluate." };
  }
  if (source.kind === "greenhouse") {
    const token = assertBoardToken(source.token);
    return { kind: "json-get", url: `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`, note: "Greenhouse public job board. Open a posting to score the full description." };
  }
  if (source.kind === "lever") {
    const token = assertBoardToken(source.token);
    return { kind: "json-get", url: `https://api.lever.co/v0/postings/${token}?mode=json`, note: "Lever public postings." };
  }
  if (source.kind === "ashby") {
    const token = assertBoardToken(source.token);
    return { kind: "json-get", url: `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`, note: "Ashby public job board." };
  }
  if (source.kind === "smartrecruiters") {
    const token = assertBoardToken(source.token);
    return { kind: "json-get", url: `https://api.smartrecruiters.com/v1/companies/${token}/postings?limit=20`, note: "SmartRecruiters public postings. Descriptions may be short until you open the posting." };
  }
  if (source.kind === "workday") {
    const host = (source.workday?.host || "").trim().toLowerCase();
    const tenant = assertBoardToken(source.workday?.tenant || source.token);
    const site = assertBoardToken(source.workday?.site || "");
    if (!host.endsWith(".myworkdayjobs.com")) throw new Error("Workday host must end with .myworkdayjobs.com.");
    return {
      kind: "json-post",
      url: `https://${host}/wday/cxs/${tenant}/${site}/jobs`,
      body: { appliedFacets: {}, limit: 20, offset: 0, searchText: source.keywords.join(" ") },
      note: "Workday public CXS endpoint.",
    };
  }
  const keywords = source.keywords.join(" ") || source.token || source.name;
  const params = new URLSearchParams({ searchstring: keywords, locationstring: source.location || "Canada" });
  return {
    kind: "html-get",
    url: `https://www.jobbank.gc.ca/jobsearch/jobsearch?${params.toString()}`,
    note: "Job Bank Canada public search page. Results are titles and locations; open a posting to score the full text.",
  };
}

export function parseGreenhouse(payload: unknown, sourceName: string): NormalizedJob[] {
  const jobs = asArray((payload as { jobs?: unknown }).jobs);
  return jobs.map((job) => {
    const record = asRecord(job);
    const content = String(record.content ?? "");
    return jobOf({
      externalId: String(record.id ?? record.internal_job_id ?? record.absolute_url ?? ""),
      title: String(record.title ?? "Untitled"),
      company: sourceName,
      location: String(asRecord(record.location).name ?? ""),
      url: String(record.absolute_url ?? ""),
      description: htmlToText(content).slice(0, 8000),
      salaryLabel: "",
      postedAt: typeof record.updated_at === "string" ? record.updated_at : null,
      sourceKind: "greenhouse",
      sourceName,
    });
  }).filter((job) => job.url);
}

export function parseLever(payload: unknown, sourceName: string): NormalizedJob[] {
  return asArray(payload).map((job) => {
    const record = asRecord(job);
    const categories = asRecord(record.categories);
    return jobOf({
      externalId: String(record.id ?? ""),
      title: String(record.text ?? "Untitled"),
      company: sourceName,
      location: String(categories.location ?? ""),
      url: String(record.hostedUrl ?? ""),
      description: String(record.descriptionPlain ?? htmlToText(String(record.description ?? ""))).slice(0, 8000),
      salaryLabel: String(record.salaryDescription ?? categories.commitment ?? ""),
      postedAt: null,
      sourceKind: "lever",
      sourceName,
    });
  }).filter((job) => job.url);
}

export function parseAshby(payload: unknown, sourceName: string): NormalizedJob[] {
  const root = asRecord(payload);
  const jobs = asArray(root.jobs ?? root.jobPostings);
  return jobs.map((job) => {
    const record = asRecord(job);
    const compensation = record.compensationTierSummary ?? record.compensation;
    return jobOf({
      externalId: String(record.id ?? ""),
      title: String(record.title ?? "Untitled"),
      company: sourceName,
      location: String(record.location ?? record.locationName ?? ""),
      url: String(record.jobUrl ?? record.applyUrl ?? ""),
      description: String(record.descriptionPlain ?? htmlToText(String(record.descriptionHtml ?? ""))).slice(0, 8000),
      salaryLabel: typeof compensation === "string" ? compensation : "",
      postedAt: typeof record.publishedAt === "string" ? record.publishedAt : null,
      sourceKind: "ashby",
      sourceName,
    });
  }).filter((job) => job.url);
}

export function parseSmartRecruiters(payload: unknown, sourceName: string, token: string): NormalizedJob[] {
  const content = asArray(asRecord(payload).content);
  return content.map((job) => {
    const record = asRecord(job);
    const id = String(record.id ?? "");
    const location = asRecord(record.location);
    return jobOf({
      externalId: id,
      title: String(record.name ?? "Untitled"),
      company: sourceName,
      location: String(location.city ?? location.region ?? location.country ?? ""),
      url: id ? `https://jobs.smartrecruiters.com/${token}/${id}` : "",
      description: String(record.name ?? ""),
      salaryLabel: "",
      postedAt: typeof record.releasedDate === "string" ? record.releasedDate : null,
      sourceKind: "smartrecruiters",
      sourceName,
    });
  }).filter((job) => job.url);
}

export function parseWorkday(payload: unknown, sourceName: string, host: string, site: string): NormalizedJob[] {
  const postings = asArray(asRecord(payload).jobPostings);
  return postings.map((job) => {
    const record = asRecord(job);
    const path = String(record.externalPath ?? "");
    return jobOf({
      externalId: path || String(record.title ?? ""),
      title: String(record.title ?? "Untitled"),
      company: sourceName,
      location: String(record.locationsText ?? ""),
      url: path ? `https://${host}${path.startsWith("/") ? "" : "/"}${path}` : "",
      description: `${record.title ?? ""} ${record.locationsText ?? ""}`.trim(),
      salaryLabel: "",
      postedAt: typeof record.postedOn === "string" ? record.postedOn : null,
      sourceKind: "workday",
      sourceName,
    });
  }).filter((job) => job.url && site.length >= 0);
}

export function parseJobBankHtml(html: string): NormalizedJob[] {
  const matches = html.matchAll(/<a href="([^"]+)"[^>]*class="resultJobItem"[\s\S]*?<\/a>/gi);
  const jobs: NormalizedJob[] = [];
  for (const match of matches) {
    const chunk = match[0];
    const href = match[1].replace(/;jsessionid=[^?]*/i, "");
    const url = new URL(href, "https://www.jobbank.gc.ca").toString();
    const title = pickClass(chunk, "noctitle");
    const company = pickClass(chunk, "business");
    const location = pickClass(chunk, "location");
    const salary = pickClass(chunk, "salary");
    const posted = pickClass(chunk, "date");
    if (!title) continue;
    jobs.push(jobOf({
      externalId: url,
      title,
      company: company || "Job Bank Canada",
      location,
      url,
      description: normalizeSpace(`${title}. ${company}. ${location}. ${salary}`),
      salaryLabel: salary,
      postedAt: posted || null,
      sourceKind: "jobbank",
      sourceName: "Job Bank Canada",
    }));
  }
  return jobs;
}

export function filterJobs<T extends { title: string; description: string; location: string }>(
  jobs: T[],
  keywords: string[],
  location: string,
): T[] {
  const needles = keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean);
  const place = location.trim().toLowerCase();
  return jobs.filter((job) => {
    const hay = `${job.title} ${job.description}`.toLowerCase();
    if (needles.length && !needles.some((keyword) => hay.includes(keyword))) return false;
    if (!place) return true;
    const where = `${job.location} ${job.description}`.toLowerCase();
    if (!job.location.trim()) return true;
    return place.split(/[,\s]+/).filter((part) => part.length > 2).every((part) => where.includes(part)) || where.includes(place);
  });
}

function pickClass(html: string, className: string): string {
  const match = html.match(new RegExp(`class="${className}"[^>]*>([\\s\\S]*?)</(?:span|li|h3|p)>`, "i"));
  if (!match) return "";
  return normalizeSpace(htmlToText(match[1]));
}

function jobOf(job: NormalizedJob): NormalizedJob {
  return { ...job, title: normalizeSpace(job.title), description: job.description.slice(0, 8000) };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
