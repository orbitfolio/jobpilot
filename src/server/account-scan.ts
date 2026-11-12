import { createClient } from "@supabase/supabase-js";
import { scanSources, type ScanMatch } from "@/server/boards";
import { boardsByUser, matchRowsForScan, type BoardRow } from "@/lib/sync-merge";

export async function scanSignedInUsers(): Promise<{ users: number; matches: number } | { skipped: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { skipped: "SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is unset." };
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const selected = await admin.from("user_records").select("user_id,collection,record_id,payload,deleted_at").in("collection", ["source", "search", "match"]);
  if (selected.error) throw new Error(selected.error.message);
  const groups = boardsByUser((selected.data ?? []) as BoardRow[]);
  let matches = 0;
  for (const group of groups) {
    const enabled = group.sources.filter((source) => source.enabled);
    if (!enabled.length) continue;
    const result = await scanSources(enabled, group.searches.filter((search) => search.enabled));
    const rows = matchRowsForScan(group.userId, result.matches.map(toIncoming), group.knownMatchKeys, result.scannedAt);
    if (!rows.length) continue;
    const written = await admin.from("user_records").upsert(rows, { onConflict: "user_id,collection,record_id", ignoreDuplicates: true });
    if (written.error) throw new Error(written.error.message);
    matches += rows.length;
  }
  return { users: groups.length, matches };
}

function toIncoming(match: ScanMatch) {
  return {
    externalId: match.externalId,
    title: match.title,
    company: match.company,
    location: match.location,
    url: match.url,
    description: match.description,
    salaryLabel: match.salaryLabel,
    postedAt: match.postedAt,
    sourceKind: match.sourceKind,
    sourceName: match.sourceName,
    sourceId: match.sourceId,
    searchId: match.searchId,
  };
}
