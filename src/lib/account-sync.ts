"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { loadClocks, saveClocks, saveSnapshot } from "@/lib/db";
import {
  applyRecords,
  clocksFromRecords,
  mergeRecords,
  sameSnapshot,
  stampAll,
  stampSnapshot,
  type SyncRecord,
} from "@/lib/sync-merge";
import type { AppData } from "@/lib/types";

let client: SupabaseClient | null | undefined;

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getBrowserSupabase(): SupabaseClient | null {
  if (!supabaseConfigured() || typeof window === "undefined") return null;
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  // Loaded only in the browser. The package is the hosted Supabase client.
  client = createClient(url, key, {
    auth: {
      flowType: "implicit",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return client;
}

export function watchAccount(onChange: (email: string | null) => void): () => void {
  const supabase = getBrowserSupabase();
  if (!supabase) {
    onChange(null);
    return () => undefined;
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(session?.user.email ?? null);
  });
  return () => data.subscription.unsubscribe();
}

export async function sendMagicLink(email: string): Promise<string> {
  const supabase = getBrowserSupabase();
  if (!supabase) return "Sign-in is not configured. Add the Supabase URL and anon key.";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) return error.message;
  return `A sign-in link is on its way to ${email}. Open it on this device.`;
}

export async function sendGoogle(): Promise<string> {
  const supabase = getBrowserSupabase();
  if (!supabase) return "Sign-in is not configured. Add the Supabase URL and anon key.";
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) return error.message;
  return "Redirecting to Google.";
}

export async function signOutAccount(): Promise<void> {
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function currentSession(): Promise<Session | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function persistAndSync(previous: AppData | null, next: AppData): Promise<AppData> {
  const clocks = await loadClocks();
  const stamped = stampSnapshot(previous, next, clocks, new Date().toISOString());
  await saveClocks(stamped.clocks);
  await saveSnapshot(next);
  const session = await currentSession();
  if (!session) return next;
  try {
    return await reconcile(stamped.records, next);
  } catch (error) {
    console.warn("Sync failed; the local copy is still saved.", error);
    return next;
  }
}

export async function rememberFullStamp(data: AppData): Promise<void> {
  const stamped = stampAll(data, new Date().toISOString());
  await saveClocks(stamped.clocks);
  await saveSnapshot(data);
}

export { sameSnapshot };

async function reconcile(localRecords: SyncRecord[], local: AppData): Promise<AppData> {
  const supabase = getBrowserSupabase();
  if (!supabase) return local;
  const pulled = await supabase.from("user_records").select("collection,record_id,payload,updated_at,deleted_at");
  if (pulled.error) throw new Error(pulled.error.message);
  const remote = ((pulled.data ?? []) as RemoteRow[]).map(toRecord);
  const merged = mergeRecords(localRecords, remote);
  const applied = applyRecords(local, merged);
  const pushed = await supabase.rpc("upsert_records", { rows: merged.map(toRow) });
  if (pushed.error) throw new Error(pushed.error.message);
  await saveClocks(clocksFromRecords(merged));
  await saveSnapshot(applied);
  return applied;
}

interface RemoteRow {
  collection: string;
  record_id: string;
  payload: unknown;
  updated_at: string;
  deleted_at: string | null;
}

function toRecord(row: RemoteRow): SyncRecord {
  return {
    collection: row.collection,
    id: row.record_id,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    payload: row.payload,
  };
}

function toRow(record: SyncRecord) {
  return {
    collection: record.collection,
    record_id: record.id,
    payload: record.payload ?? {},
    updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
  };
}
