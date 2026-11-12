"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { persistAndSync, rememberFullStamp, watchAccount } from "@/lib/account-sync";
import { clearSnapshot, loadSnapshot, saveSnapshot } from "@/lib/db";
import { buildSeed, isAppData } from "@/lib/seed";
import { EMPTY_SECRETS, loadSecrets, saveSecrets } from "@/lib/secrets";
import { sameSnapshot } from "@/lib/sync-merge";
import { createId } from "@/lib/text";
import type { AiSecrets, AppData, JobMatch } from "@/lib/types";

interface ScanBody {
  matches?: (Omit<JobMatch, "id" | "status" | "foundAt"> & { sourceId: string; searchId: string | null })[];
  summary?: string;
  scannedAt?: string;
  error?: string;
}

interface AppContextValue {
  data: AppData | null;
  secrets: AiSecrets;
  setSecrets: (secrets: AiSecrets) => void;
  notice: string | null;
  busy: string | null;
  setNotice: (notice: string | null) => void;
  update: (recipe: (draft: AppData) => void) => void;
  replace: (data: AppData) => void;
  resetDemo: () => void;
  scanNow: () => Promise<void>;
  accountEmail: string | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("The desk is still loading.");
  return value;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secrets, setSecretsState] = useState<AiSecrets>(EMPTY_SECRETS);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [persist, setPersist] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSnapshot()
      .then(async (stored) => {
        if (cancelled) return;
        try {
        const secretsNow = loadSecrets();
        let next = stored ?? buildSeed();
        if (!stored) await saveSnapshot(next);
        if (next.settings.autoScanOnOpen) {
          const last = next.lastScanAt ? Date.parse(next.lastScanAt) : 0;
          const due = !Number.isFinite(last) || Date.now() - last >= 20 * 60 * 60 * 1000;
          if (due) {
            const scanned = await scanInto(next);
            next = scanned.next;
            if (scanned.added) setNotice(scanned.note);
          }
        }
        if (cancelled) return;
        setSecretsState(secretsNow);
        setData(next);
        setPersist(true);
        } catch (reason) {
          if (!cancelled) setError(reason instanceof Error ? reason.message : "The desk could not be prepared.");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "This browser blocked local storage.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return watchAccount((email) => {
      queueMicrotask(() => setAccountEmail(email));
    });
  }, []);

  useEffect(() => {
    if (!persist || !data) return;
    const snapshot = data;
    const timer = window.setTimeout(() => {
      void (async () => {
        const previous = await loadSnapshot();
        const synced = await persistAndSync(previous, snapshot);
        if (!sameSnapshot(synced, snapshot)) {
          setData((current) => (current && sameSnapshot(current, snapshot) ? synced : current));
        }
      })();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [data, persist, accountEmail]);

  const update = (recipe: (draft: AppData) => void) => {
    setData((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      recipe(next);
      next.updatedAt = new Date().toISOString();
      return next;
    });
  };

  const replace = (next: AppData) => {
    if (!isAppData(next)) {
      setNotice("That file is not a Career Ops snapshot.");
      return;
    }
    void rememberFullStamp(next).then(() => {
      setData(next);
      setNotice("Imported the snapshot into this browser.");
    });
  };

  const resetDemo = () => {
    const seeded = buildSeed();
    void clearSnapshot()
      .then(() => rememberFullStamp(seeded))
      .then(() => {
        setData(seeded);
        setNotice("Demo profile restored.");
      });
  };

  const setSecrets = (next: AiSecrets) => {
    setSecretsState(next);
    saveSecrets(next);
  };

  const scanNow = async () => {
    if (!data) return;
    setBusy("Scanning saved searches…");
    try {
      const { next, added, note } = await scanInto(data);
      setData(next);
      setNotice(note);
      if (data.settings.browserNotifications && added && "Notification" in window && Notification.permission === "granted") {
        new Notification("Career Ops", { body: note });
      }
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Scan failed.");
    } finally {
      setBusy(null);
    }
  };

  const value: AppContextValue = { data, secrets, setSecrets, notice, busy, setNotice, update, replace, resetDemo, scanNow, accountEmail };

  if (error) {
    return <div className="mx-auto max-w-lg p-8 text-sm"><h1 className="font-heading text-2xl">Local storage is unavailable</h1><p className="mt-2 text-muted-foreground">{error}</p></div>;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

async function scanInto(current: AppData): Promise<{ next: AppData; added: number; note: string }> {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sources: current.sources.filter((source) => source.enabled),
      searches: current.searches.filter((search) => search.enabled),
    }),
  });
  const body = (await response.json()) as ScanBody;
  if (!response.ok) throw new Error(body.error || "Scan failed.");
  const known = new Set(current.matches.map((match) => match.url).filter(Boolean));
  const fresh = (body.matches ?? []).filter((match) => !match.url || !known.has(match.url));
  const next = structuredClone(current);
  next.lastScanAt = body.scannedAt ?? new Date().toISOString();
  next.lastScanNote = body.summary || "Scan finished.";
  next.updatedAt = new Date().toISOString();
  for (const job of fresh) {
    const match: JobMatch = {
      id: createId("match"),
      searchId: job.searchId ?? null,
      sourceId: job.sourceId ?? null,
      sourceName: job.sourceName,
      sourceKind: job.sourceKind,
      externalId: job.externalId,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      description: job.description ?? "",
      salaryLabel: job.salaryLabel ?? "",
      postedAt: job.postedAt ?? null,
      foundAt: new Date().toISOString(),
      status: "new",
    };
    next.matches.unshift(match);
  }
  const note = fresh.length ? `${fresh.length} new matches. Nothing was submitted.` : "Scan finished. No new matches.";
  return { next, added: fresh.length, note };
}
