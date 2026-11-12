"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState, PageHeader } from "@/components/bits";
import { useApp } from "@/components/app-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { evaluateJob } from "@/lib/scoring";
import { createId } from "@/lib/text";
import { formatDate } from "@/lib/text";

export function InboxView() {
  const { data, update, scanNow, busy } = useApp();
  const router = useRouter();
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  if (!data) return <p className="text-sm text-muted-foreground">Opening the desk…</p>;
  const fresh = data.matches.filter((match) => match.status === "new");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="New matches"
        lede="Saved searches run when you open the app if the last scan is older than 20 hours, and whenever you press Scan now. A scheduled function can scan boards you configure on the server. Email is never sent."
        actions={<Button type="button" disabled={Boolean(busy)} onClick={() => void scanNow()}>{busy ? "Scanning…" : "Scan now"}</Button>}
      />
      <p className="text-sm text-muted-foreground">Last scan {formatDate(data.lastScanAt)}. {data.lastScanNote}</p>
      <form
        className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[1fr_1fr_10rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          update((draft) => {
            draft.searches.unshift({
              id: createId("search"),
              name: name.trim(),
              keywords: keywords.split(",").map((item) => item.trim()).filter(Boolean),
              location: location.trim(),
              country: data.profile.country,
              sourceIds: [],
              enabled: true,
              createdAt: new Date().toISOString(),
            });
          });
          setName("");
          setKeywords("");
          setLocation("");
        }}
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Search name" required />
        <Input value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="Keywords, comma separated" />
        <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" />
        <Button type="submit">Save search</Button>
      </form>
      <ul className="space-y-2 text-sm">
        {data.searches.map((search) => (
          <li key={search.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <span>
              <span className="font-medium">{search.name}</span>
              <span className="block text-muted-foreground">{search.keywords.join(", ") || "Any keyword"} · {search.location || "Any location"} · {search.country}</span>
            </span>
            <Button type="button" variant="ghost" onClick={() => update((draft) => { const row = draft.searches.find((item) => item.id === search.id); if (row) row.enabled = !row.enabled; })}>
              {search.enabled ? "On" : "Off"}
            </Button>
          </li>
        ))}
      </ul>
      {fresh.length === 0 ? <EmptyState title="No unseen matches." body="Run a scan, or add a company board under Sources. Indeed stays paste-only." /> : null}
      <div className="space-y-3">
        {data.matches.filter((match) => match.status !== "dismissed").map((match) => {
          const preview = match.description.length > 80
            ? evaluateJob({ jd: `${match.title}\n${match.company}\n${match.location}\n${match.description}`, company: match.company, title: match.title, profile: data.profile, cv: data.cv, rubric: data.rubric })
            : null;
          return (
            <article key={match.id} className="rounded-xl border border-border p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{match.title}</p>
                  <p className="text-muted-foreground">{match.company} · {match.location || "Location unknown"} · {match.sourceName}</p>
                </div>
                {preview ? <span className="tabular-nums">{preview.globalScore.toFixed(1)} preview · {preview.confidence} confidence</span> : <span className="text-muted-foreground">Open the posting to score it</span>}
              </div>
              {match.salaryLabel ? <p className="mt-2">{match.salaryLabel}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" onClick={() => router.push(`/evaluate?match=${match.id}`)}>Score this</Button>
                {match.url ? <a className={cn(buttonVariants({ variant: "outline" }))} href={match.url} target="_blank" rel="noreferrer">Open posting</a> : null}
                <Button type="button" variant="ghost" onClick={() => update((draft) => { const row = draft.matches.find((item) => item.id === match.id); if (row) row.status = "dismissed"; })}>Dismiss</Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
