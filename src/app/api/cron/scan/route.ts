import { connection } from "next/server";
import { scanSignedInUsers } from "@/server/account-scan";
import { scanSources } from "@/server/boards";
import type { JobSource, SavedSearch } from "@/lib/types";

export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "This scheduled scan requires CRON_SECRET." }, { status: 401 });
  }
  let accountScan: { users: number; matches: number } | { skipped: string } | { error: string };
  try {
    accountScan = await scanSignedInUsers();
  } catch (error) {
    accountScan = { error: error instanceof Error ? error.message : "Account scan failed." };
  }
  const raw = process.env.SCAN_SOURCES_JSON;
  if (!raw && "skipped" in accountScan) {
    return Response.json({
      ok: true,
      skipped: true,
      accountScan,
      reason: "No signed-in boards were scanned and SCAN_SOURCES_JSON is empty.",
    });
  }
  if (!raw && "error" in accountScan) {
    return Response.json({ ok: false, accountScan, error: accountScan.error }, { status: 502 });
  }
  let sources: JobSource[] = [];
  let searches: SavedSearch[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { sources?: JobSource[]; searches?: SavedSearch[] };
      sources = parsed.sources ?? [];
      searches = parsed.searches ?? [];
    } catch {
      return Response.json({ ok: false, error: "SCAN_SOURCES_JSON is not valid JSON.", accountScan }, { status: 400 });
    }
  }
  const result = raw ? await scanSources(sources, searches) : { matches: [], reports: [], scannedAt: new Date().toISOString() };
  let digestSent = false;
  if (process.env.DIGEST_ENABLED === "true" && process.env.DIGEST_WEBHOOK_URL) {
    const webhook = await fetch(process.env.DIGEST_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "career-ops-by-vish-digest",
        note: "JSON digest only. This app does not send email and does not submit applications.",
        scannedAt: result.scannedAt,
        matches: result.matches.map((match) => ({ title: match.title, company: match.company, url: match.url, location: match.location })),
      }),
    });
    digestSent = webhook.ok;
  }
  return Response.json({ ok: true, count: result.matches.length, reports: result.reports, digestSent, accountScan });
}
