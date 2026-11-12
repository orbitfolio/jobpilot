import type { AppData, JobMatch, SavedSearch, JobSource } from "@/lib/types";

export const EPOCH = "1970-01-01T00:00:00.000Z";

export interface SyncRecord {
  collection: string;
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  payload: unknown;
}

export interface RecordClock {
  updatedAt: string;
  deletedAt: string | null;
}

export type ClockMap = Record<string, RecordClock>;

export function recordKey(collection: string, id: string): string {
  return `${collection}/${id}`;
}

export function laterRecord(local: SyncRecord, remote: SyncRecord): SyncRecord {
  const localTime = stampTime(local);
  const remoteTime = stampTime(remote);
  if (remoteTime > localTime) return remote;
  return local;
}

export function mergeRecords(local: SyncRecord[], remote: SyncRecord[]): SyncRecord[] {
  const map = new Map<string, SyncRecord>();
  for (const record of local) map.set(recordKey(record.collection, record.id), record);
  for (const record of remote) {
    const key = recordKey(record.collection, record.id);
    const current = map.get(key);
    map.set(key, current ? laterRecord(current, record) : record);
  }
  return [...map.values()];
}

export function stampSnapshot(previous: AppData | null, next: AppData, clocks: ClockMap, now: string): { clocks: ClockMap; records: SyncRecord[] } {
  const prev = previous ? liveMap(previous) : null;
  const live = liveMap(next);
  const nextClocks: ClockMap = { ...clocks };

  for (const [key, payload] of live) {
    const existing = nextClocks[key];
    const before = prev?.get(key);
    if (!prev) {
      if (!existing) nextClocks[key] = { updatedAt: EPOCH, deletedAt: null };
      continue;
    }
    if (before === undefined) {
      nextClocks[key] = { updatedAt: now, deletedAt: null };
      continue;
    }
    if (!payloadEqual(before, payload)) nextClocks[key] = { updatedAt: now, deletedAt: null };
    else if (!existing) nextClocks[key] = { updatedAt: EPOCH, deletedAt: null };
  }

  if (prev) {
    for (const key of prev.keys()) {
      if (!live.has(key)) nextClocks[key] = { updatedAt: now, deletedAt: now };
    }
  }

  return { clocks: nextClocks, records: toRecords(live, nextClocks) };
}

export function stampAll(data: AppData, now: string): { clocks: ClockMap; records: SyncRecord[] } {
  const live = liveMap(data);
  const clocks: ClockMap = {};
  for (const key of live.keys()) clocks[key] = { updatedAt: now, deletedAt: null };
  return { clocks, records: toRecords(live, clocks) };
}

export function recordsFromSnapshot(data: AppData, clocks: ClockMap): SyncRecord[] {
  return toRecords(liveMap(data), clocks);
}

export function clocksFromRecords(records: SyncRecord[]): ClockMap {
  const clocks: ClockMap = {};
  for (const record of records) {
    clocks[recordKey(record.collection, record.id)] = { updatedAt: record.updatedAt, deletedAt: record.deletedAt };
  }
  return clocks;
}

export function applyRecords(base: AppData, records: SyncRecord[]): AppData {
  const meta = singleton<{ lastScanAt: string | null; lastScanNote: string }>(records, "meta", {
    lastScanAt: base.lastScanAt,
    lastScanNote: base.lastScanNote,
  });
  const times = records.map((record) => Date.parse(record.updatedAt)).filter((time) => Number.isFinite(time) && time > Date.parse(EPOCH));
  return {
    version: 1,
    updatedAt: times.length ? new Date(Math.max(...times)).toISOString() : base.updatedAt,
    profile: singleton(records, "profile", base.profile),
    cv: singleton(records, "cv", base.cv),
    rubric: singleton(records, "rubric", base.rubric),
    settings: singleton(records, "settings", base.settings),
    sources: mergeList(base.sources, records, "source"),
    searches: mergeList(base.searches, records, "search"),
    matches: mergeList(base.matches, records, "match", true),
    evaluations: mergeList(base.evaluations, records, "evaluation"),
    applications: mergeList(base.applications, records, "application"),
    stories: mergeList(base.stories, records, "story"),
    practice: mergeList(base.practice, records, "practice"),
    offers: mergeList(base.offers, records, "offer"),
    lastScanAt: meta.lastScanAt,
    lastScanNote: meta.lastScanNote,
  };
}

export function sameSnapshot(left: AppData, right: AppData): boolean {
  return stable(left) === stable(right);
}

export function containsSecretMaterial(records: SyncRecord[]): boolean {
  const blob = JSON.stringify(records);
  return blob.includes("apiKey") || blob.includes("\"sk-");
}

function stampTime(record: SyncRecord): number {
  const parsed = Date.parse(record.deletedAt ?? record.updatedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function singleton<T>(records: SyncRecord[], collection: string, fallback: T): T {
  const row = records.find((record) => record.collection === collection && record.id === "self");
  if (!row || row.deletedAt) return fallback;
  return row.payload as T;
}

function mergeList<T extends { id: string }>(base: T[], records: SyncRecord[], collection: string, prepend = false): T[] {
  const relevant = records.filter((record) => record.collection === collection);
  const byId = new Map(relevant.map((record) => [record.id, record]));
  const result: T[] = [];
  for (const item of base) {
    const row = byId.get(item.id);
    if (!row) {
      result.push(item);
      continue;
    }
    byId.delete(item.id);
    if (row.deletedAt) continue;
    result.push(row.payload as T);
  }
  const extras: T[] = [];
  for (const row of byId.values()) {
    if (row.deletedAt) continue;
    extras.push(row.payload as T);
  }
  return prepend ? [...extras, ...result] : [...result, ...extras];
}

function liveMap(data: AppData): Map<string, unknown> {
  const map = new Map<string, unknown>();
  map.set(recordKey("profile", "self"), data.profile);
  map.set(recordKey("cv", "self"), data.cv);
  map.set(recordKey("rubric", "self"), data.rubric);
  map.set(recordKey("settings", "self"), data.settings);
  map.set(recordKey("meta", "self"), { lastScanAt: data.lastScanAt, lastScanNote: data.lastScanNote });
  for (const item of data.sources) map.set(recordKey("source", item.id), item);
  for (const item of data.searches) map.set(recordKey("search", item.id), item);
  for (const item of data.matches) map.set(recordKey("match", item.id), item);
  for (const item of data.evaluations) map.set(recordKey("evaluation", item.id), item);
  for (const item of data.applications) map.set(recordKey("application", item.id), item);
  for (const item of data.stories) map.set(recordKey("story", item.id), item);
  for (const item of data.practice) map.set(recordKey("practice", item.id), item);
  for (const item of data.offers) map.set(recordKey("offer", item.id), item);
  return map;
}

function toRecords(live: Map<string, unknown>, clocks: ClockMap): SyncRecord[] {
  const records: SyncRecord[] = [];
  const seen = new Set<string>();
  for (const [key, payload] of live) {
    seen.add(key);
    const clock = clocks[key] ?? { updatedAt: EPOCH, deletedAt: null };
    const split = splitKey(key);
    records.push({ collection: split.collection, id: split.id, updatedAt: clock.updatedAt, deletedAt: clock.deletedAt, payload });
  }
  for (const [key, clock] of Object.entries(clocks)) {
    if (seen.has(key) || !clock.deletedAt) continue;
    const split = splitKey(key);
    records.push({ collection: split.collection, id: split.id, updatedAt: clock.updatedAt, deletedAt: clock.deletedAt, payload: {} });
  }
  return records;
}

function splitKey(key: string): { collection: string; id: string } {
  const slash = key.indexOf("/");
  return { collection: key.slice(0, slash), id: key.slice(slash + 1) };
}

function payloadEqual(left: unknown, right: unknown): boolean {
  return stable(left) === stable(right);
}

function stable(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) sorted[key] = sortValue(source[key]);
    return sorted;
  }
  return value;
}

export interface BoardRow {
  user_id: string;
  collection: string;
  record_id: string;
  payload: unknown;
  deleted_at?: string | null;
}

export interface UserBoards {
  userId: string;
  sources: JobSource[];
  searches: SavedSearch[];
  knownMatchKeys: Set<string>;
}

export function boardsByUser(rows: BoardRow[]): UserBoards[] {
  const groups = new Map<string, UserBoards>();
  for (const row of rows) {
    if (row.deleted_at) continue;
    const group = groups.get(row.user_id) ?? { userId: row.user_id, sources: [], searches: [], knownMatchKeys: new Set<string>() };
    if (row.collection === "source" && isRecord(row.payload) && typeof row.payload.id === "string") group.sources.push(row.payload as unknown as JobSource);
    if (row.collection === "search" && isRecord(row.payload) && typeof row.payload.id === "string") group.searches.push(row.payload as unknown as SavedSearch);
    if (row.collection === "match" && isRecord(row.payload)) {
      const match = row.payload as Partial<JobMatch>;
      if (match.url) group.knownMatchKeys.add(match.url);
      if (match.externalId) group.knownMatchKeys.add(match.externalId);
    }
    groups.set(row.user_id, group);
  }
  return [...groups.values()];
}

export function scanMatchId(key: string): string {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `scan-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export interface IncomingMatch {
  externalId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salaryLabel: string;
  postedAt: string | null;
  sourceKind: JobMatch["sourceKind"];
  sourceName: string;
  sourceId: string;
  searchId: string | null;
}

export function matchRowsForScan(userId: string, jobs: IncomingMatch[], known: Set<string>, now: string) {
  const rows: Array<{ user_id: string; collection: "match"; record_id: string; payload: JobMatch; updated_at: string; deleted_at: null }> = [];
  for (const job of jobs) {
    const key = job.url || job.externalId;
    if (!key || known.has(key) || known.has(scanMatchId(key))) continue;
    known.add(key);
    const id = scanMatchId(key);
    const payload: JobMatch = {
      id,
      searchId: job.searchId,
      sourceId: job.sourceId,
      sourceName: job.sourceName,
      sourceKind: job.sourceKind,
      externalId: job.externalId,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      description: job.description,
      salaryLabel: job.salaryLabel,
      postedAt: job.postedAt,
      foundAt: now,
      status: "new",
    };
    rows.push({ user_id: userId, collection: "match", record_id: id, payload, updated_at: now, deleted_at: null });
  }
  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
