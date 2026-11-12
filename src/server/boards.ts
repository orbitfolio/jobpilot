import {
  filterJobs,
  parseAshby,
  parseGreenhouse,
  parseJobBankHtml,
  parseLever,
  parseSmartRecruiters,
  parseWorkday,
  planBoardFetch,
  type NormalizedJob,
} from "@/lib/boards";
import type { JobSource, SavedSearch } from "@/lib/types";
import { readBody, safeFetch } from "@/server/http";

export interface SourceScan {
  sourceId: string;
  sourceName: string;
  ok: boolean;
  message: string;
  jobs: NormalizedJob[];
}

export interface ScanMatch extends NormalizedJob {
  sourceId: string;
  searchId: string | null;
}

export async function fetchBoard(source: JobSource): Promise<SourceScan> {
  try {
    const plan = planBoardFetch(source);
    if (plan.kind === "paste") {
      return { sourceId: source.id, sourceName: source.name, ok: true, message: plan.note, jobs: [] };
    }
    const { response } = await safeFetch(plan.url, {
      method: plan.kind === "json-post" ? "POST" : "GET",
      headers: plan.kind === "json-post" ? { "content-type": "application/json", accept: "application/json" } : { accept: plan.kind === "html-get" ? "text/html" : "application/json" },
      body: plan.kind === "json-post" ? JSON.stringify(plan.body ?? {}) : undefined,
    }, 15000);
    const body = await readBody(response, plan.kind === "html-get" ? 900_000 : 8_000_000);
    if (!response.ok) {
      return { sourceId: source.id, sourceName: source.name, ok: false, message: `${source.name} returned HTTP ${response.status}.`, jobs: [] };
    }
    const jobs = normalize(source, body).slice(0, 40);
    return {
      sourceId: source.id,
      sourceName: source.name,
      ok: true,
      message: jobs.length ? `${jobs.length} postings from ${source.name}.` : `${source.name} returned no postings.`,
      jobs,
    };
  } catch (error) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      ok: false,
      message: error instanceof Error ? error.message : "The board could not be read.",
      jobs: [],
    };
  }
}

export async function scanSources(sources: JobSource[], searches: SavedSearch[]): Promise<{ matches: ScanMatch[]; reports: SourceScan[]; scannedAt: string }> {
  const enabled = sources.filter((source) => source.enabled);
  const activeSearches = searches.filter((search) => search.enabled);
  const cached = new Map<string, SourceScan>();
  const reports: SourceScan[] = [];

  for (const source of enabled) {
    if (source.kind === "jobbank") continue;
    const report = await fetchBoard(source);
    cached.set(source.id, report);
    reports.push(report);
  }

  const matches: ScanMatch[] = [];
  const seen = new Set<string>();
  const searchesToApply = activeSearches.length ? activeSearches : [null];

  for (const search of searchesToApply) {
    const selected = enabled.filter((source) => !search || search.sourceIds.length === 0 || search.sourceIds.includes(source.id));
    for (const source of selected) {
      let report = cached.get(source.id);
      if (source.kind === "jobbank") {
        report = await fetchBoard({
          ...source,
          keywords: search?.keywords?.length ? search.keywords : source.keywords,
          location: search?.location || source.location,
        });
        reports.push(report);
      }
      if (!report) continue;
      const filtered = filterJobs(report.jobs, search?.keywords ?? source.keywords, search?.location ?? "").slice(0, 8);
      for (const job of filtered) {
        const key = job.url || `${job.sourceName}:${job.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push({ ...job, sourceId: source.id, searchId: search?.id ?? null, description: job.description.slice(0, 4000) });
        if (matches.length >= 40) break;
      }
      if (matches.length >= 40) break;
    }
  }

  return { matches, reports, scannedAt: new Date().toISOString() };
}

function normalize(source: JobSource, body: string): NormalizedJob[] {
  if (source.kind === "jobbank") return parseJobBankHtml(body);
  const payload = JSON.parse(body) as unknown;
  if (source.kind === "greenhouse") return parseGreenhouse(payload, source.name);
  if (source.kind === "lever") return parseLever(payload, source.name);
  if (source.kind === "ashby") return parseAshby(payload, source.name);
  if (source.kind === "smartrecruiters") return parseSmartRecruiters(payload, source.name, source.token);
  if (source.kind === "workday" && source.workday) return parseWorkday(payload, source.name, source.workday.host, source.workday.site);
  return [];
}
