import { scanSources } from "@/server/boards";
import type { JobSource, SavedSearch } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { sources?: JobSource[]; searches?: SavedSearch[] } | null;
  const sources = Array.isArray(body?.sources) ? body.sources.slice(0, 25) : [];
  const searches = Array.isArray(body?.searches) ? body.searches.slice(0, 20) : [];
  if (!sources.length) return Response.json({ error: "Add at least one source before scanning." }, { status: 400 });
  const result = await scanSources(sources, searches);
  const summary = result.reports.map((report) => report.message).join(" ");
  return Response.json({ ...result, summary });
}
