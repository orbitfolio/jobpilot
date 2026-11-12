import { openDB } from "idb";
import { isAppData } from "@/lib/seed";
import type { ClockMap } from "@/lib/sync-merge";
import type { AppData } from "@/lib/types";

const DB_NAME = "career-ops-by-vish";
const STORE = "kv";

async function database() {
  return openDB(DB_NAME, 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    },
  });
}

export async function loadSnapshot(): Promise<AppData | null> {
  const db = await database();
  const stored = await db.get(STORE, "snapshot");
  return isAppData(stored) ? stored : null;
}

export async function saveSnapshot(data: AppData): Promise<void> {
  const db = await database();
  await db.put(STORE, data, "snapshot");
}

export async function clearSnapshot(): Promise<void> {
  const db = await database();
  await db.delete(STORE, "snapshot");
  await db.delete(STORE, "clocks");
}

export async function loadClocks(): Promise<ClockMap> {
  const db = await database();
  const stored = await db.get(STORE, "clocks");
  if (!stored || typeof stored !== "object") return {};
  return stored as ClockMap;
}

export async function saveClocks(clocks: ClockMap): Promise<void> {
  const db = await database();
  await db.put(STORE, clocks, "clocks");
}
