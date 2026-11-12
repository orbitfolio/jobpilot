import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/seed";
import {
  EPOCH,
  applyRecords,
  boardsByUser,
  containsSecretMaterial,
  laterRecord,
  matchRowsForScan,
  mergeRecords,
  stampAll,
  stampSnapshot,
  type SyncRecord,
} from "@/lib/sync-merge";
import type { JobMatch } from "@/lib/types";

const now = new Date("2026-01-01T00:00:00.000Z");

function profileRecord(name: string, updatedAt: string, deletedAt: string | null = null): SyncRecord {
  return { collection: "profile", id: "self", updatedAt, deletedAt, payload: { fullName: name } };
}

describe("last-write-wins merge", () => {
  it("keeps the local record when timestamps are equal", () => {
    const local = profileRecord("Local", "2026-02-01T00:00:00.000Z");
    const remote = profileRecord("Remote", "2026-02-01T00:00:00.000Z");
    expect((laterRecord(local, remote).payload as { fullName: string }).fullName).toBe("Local");
  });

  it("lets a newer remote record replace the local one", () => {
    const merged = mergeRecords(
      [profileRecord("Laptop", "2026-02-01T00:00:00.000Z")],
      [profileRecord("Phone", "2026-02-02T00:00:00.000Z")],
    );
    expect((merged[0].payload as { fullName: string }).fullName).toBe("Phone");
  });

  it("keeps a newer local edit over an older remote copy", () => {
    const merged = mergeRecords(
      [profileRecord("Laptop", "2026-03-02T00:00:00.000Z")],
      [profileRecord("Phone", "2026-03-01T00:00:00.000Z")],
    );
    expect((merged[0].payload as { fullName: string }).fullName).toBe("Laptop");
  });

  it("lets a newer tombstone delete a record and a newer edit restore it", () => {
    const live = profileRecord("Ada", "2026-04-01T00:00:00.000Z");
    const tomb = profileRecord("Ada", "2026-04-02T00:00:00.000Z", "2026-04-02T00:00:00.000Z");
    expect(mergeRecords([live], [tomb])[0].deletedAt).toBe("2026-04-02T00:00:00.000Z");
    const restored = profileRecord("Ada again", "2026-04-03T00:00:00.000Z");
    expect(mergeRecords([tomb], [restored])[0].deletedAt).toBeNull();
  });

  it("keeps unrelated records from both sides", () => {
    const merged = mergeRecords(
      [profileRecord("Ada", "2026-01-02T00:00:00.000Z")],
      [{ collection: "source", id: "cohere", updatedAt: "2026-01-03T00:00:00.000Z", deletedAt: null, payload: { id: "cohere" } }],
    );
    expect(merged).toHaveLength(2);
  });
});

describe("snapshot stamping", () => {
  it("does not stamp an untouched seed, then stamps only the record that changed", () => {
    const seed = buildSeed(now);
    const first = stampSnapshot(null, seed, {}, "2026-02-01T00:00:00.000Z");
    expect(first.records.every((record) => record.updatedAt === EPOCH)).toBe(true);
    expect(containsSecretMaterial(first.records)).toBe(false);

    const edited = structuredClone(seed);
    edited.profile.fullName = "Ada Lovelace";
    const second = stampSnapshot(seed, edited, first.clocks, "2026-03-01T00:00:00.000Z");
    expect(second.records.find((record) => record.collection === "profile")?.updatedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(second.records.find((record) => record.collection === "cv")?.updatedAt).toBe(EPOCH);
    const applied = applyRecords(seed, second.records);
    expect(applied.profile.fullName).toBe("Ada Lovelace");
    expect(applied.cv.summary).toBe(seed.cv.summary);
  });

  it("turns a removed source into a tombstone the other device will honour", () => {
    const seed = buildSeed(now);
    const first = stampSnapshot(null, seed, {}, "2026-02-01T00:00:00.000Z");
    const edited = structuredClone(seed);
    edited.sources = edited.sources.filter((source) => source.id !== "source-indeed");
    const second = stampSnapshot(seed, edited, first.clocks, "2026-05-01T00:00:00.000Z");
    const tomb = second.records.find((record) => record.id === "source-indeed");
    expect(tomb?.deletedAt).toBe("2026-05-01T00:00:00.000Z");
    expect(applyRecords(seed, second.records).sources.some((source) => source.id === "source-indeed")).toBe(false);
  });

  it("stamps an explicit import so it wins over an untouched copy", () => {
    const seed = buildSeed(now);
    const stamped = stampAll(seed, "2026-06-01T00:00:00.000Z");
    expect(stamped.records.every((record) => record.updatedAt === "2026-06-01T00:00:00.000Z" && !record.deletedAt)).toBe(true);
  });
});

describe("scheduled inbox rows", () => {
  it("groups each user's boards and skips matches they already have", () => {
    const groups = boardsByUser([
      { user_id: "ada", collection: "source", record_id: "source-cohere", payload: { id: "source-cohere", name: "Cohere", kind: "ashby", enabled: true }, deleted_at: null },
      { user_id: "ada", collection: "search", record_id: "search-1", payload: { id: "search-1", name: "Engineers", enabled: true }, deleted_at: null },
      { user_id: "ada", collection: "match", record_id: "old", payload: { url: "https://jobs.example/old", externalId: "old" }, deleted_at: null },
      { user_id: "ada", collection: "source", record_id: "gone", payload: { id: "gone" }, deleted_at: "2026-01-01T00:00:00.000Z" },
      { user_id: "grace", collection: "source", record_id: "source-gitlab", payload: { id: "source-gitlab", enabled: true }, deleted_at: null },
    ]);
    const ada = groups.find((group) => group.userId === "ada");
    expect(ada?.sources).toHaveLength(1);
    expect(ada?.searches).toHaveLength(1);
    expect(ada?.knownMatchKeys.has("https://jobs.example/old")).toBe(true);
    expect(groups.find((group) => group.userId === "grace")?.sources[0].id).toBe("source-gitlab");

    const rows = matchRowsForScan(ada!.userId, [
      incoming("https://jobs.example/old", "old"),
      incoming("https://jobs.example/new", "new"),
    ], ada!.knownMatchKeys, "2026-07-01T00:00:00.000Z");
    expect(rows).toHaveLength(1);
    expect(rows[0].payload.url).toBe("https://jobs.example/new");
    expect(rows[0].user_id).toBe("ada");
    expect((rows[0].payload as JobMatch).status).toBe("new");
  });
});

function incoming(url: string, externalId: string) {
  return {
    externalId,
    title: "Engineer",
    company: "Example",
    location: "Toronto",
    url,
    description: "Build things.",
    salaryLabel: "",
    postedAt: null,
    sourceKind: "ashby" as const,
    sourceName: "Cohere",
    sourceId: "source-cohere",
    searchId: "search-1",
  };
}
