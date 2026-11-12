"use client";

import { useState } from "react";
import { Field, PageHeader } from "@/components/bits";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BOARD_KINDS, type BoardKind, type JobSource } from "@/lib/types";
import { createId } from "@/lib/text";

const BLURBS: Record<BoardKind, string> = {
  greenhouse: "Public JSON at boards-api.greenhouse.io. Token is the board name.",
  lever: "Public JSON at api.lever.co. Token is the site name.",
  ashby: "Public JSON at api.ashbyhq.com. Token is the job-board name.",
  smartrecruiters: "Public postings API. Token is the company identifier.",
  workday: "Public CXS endpoint on a *.myworkdayjobs.com host. Descriptions are often short until you open the posting.",
  jobbank: "Job Bank Canada search page. The scan reads titles from the public results.",
  indeed: "No public JSON API is used. Save the search, then paste postings into Evaluate.",
  manual: "A reminder list. Paste postings yourself.",
};

export function SourcesView() {
  const { data, update } = useApp();
  const [draft, setDraft] = useState<JobSource>({
    id: "new",
    name: "",
    kind: "ashby",
    token: "",
    country: data?.profile.country ?? "Canada",
    industry: "",
    keywords: [],
    location: "",
    enabled: true,
    workday: { host: "", tenant: "", site: "" },
    notes: "",
  });
  if (!data) return <p className="text-sm text-muted-foreground">Opening the desk…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sources"
        title="Boards for the industry and country you actually want."
        lede="The demo starts with Cohere, Wealthsimple, GitLab, and Job Bank Canada, plus an Indeed Canada row that stays paste-only. Add any public Greenhouse, Lever, Ashby, SmartRecruiters, or Workday board."
      />
      <ul className="space-y-3">
        {data.sources.map((source) => (
          <li key={source.id} className="rounded-xl border border-border p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{source.name}</p>
                <p className="text-muted-foreground">{source.kind} · {source.token} · {source.country} · {source.industry}</p>
                <p className="mt-1 text-muted-foreground">{source.notes || BLURBS[source.kind]}</p>
              </div>
              <Switch checked={source.enabled} onCheckedChange={(checked) => update((row) => { const item = row.sources.find((entry) => entry.id === source.id); if (item) item.enabled = checked; })} aria-label={`Enable ${source.name}`} />
            </div>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-3 rounded-xl border border-border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name.trim()) return;
          update((row) => {
            row.sources.push({ ...draft, id: createId("source"), name: draft.name.trim(), token: draft.token.trim(), keywords: draft.keywords });
          });
          setDraft({ ...draft, name: "", token: "" });
        }}
      >
        <h2 className="font-heading text-2xl">Add a source</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></Field>
          <Field label="Kind">
            <select className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as BoardKind })}>
              {BOARD_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
          </Field>
          <Field label="Token or board slug" hint={BLURBS[draft.kind]}><Input value={draft.token} onChange={(event) => setDraft({ ...draft, token: event.target.value })} /></Field>
          <Field label="Country"><Input value={draft.country} onChange={(event) => setDraft({ ...draft, country: event.target.value })} /></Field>
          <Field label="Industry"><Input value={draft.industry} onChange={(event) => setDraft({ ...draft, industry: event.target.value })} /></Field>
          <Field label="Keywords"><Input value={draft.keywords.join(", ")} onChange={(event) => setDraft({ ...draft, keywords: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></Field>
          <Field label="Location"><Input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></Field>
        </div>
        {draft.kind === "workday" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Host"><Input value={draft.workday?.host ?? ""} placeholder="company.wd1.myworkdayjobs.com" onChange={(event) => setDraft({ ...draft, workday: { host: event.target.value, tenant: draft.workday?.tenant ?? "", site: draft.workday?.site ?? "" } })} /></Field>
            <Field label="Tenant"><Input value={draft.workday?.tenant ?? ""} onChange={(event) => setDraft({ ...draft, workday: { host: draft.workday?.host ?? "", tenant: event.target.value, site: draft.workday?.site ?? "" } })} /></Field>
            <Field label="Site"><Input value={draft.workday?.site ?? ""} onChange={(event) => setDraft({ ...draft, workday: { host: draft.workday?.host ?? "", tenant: draft.workday?.tenant ?? "", site: event.target.value } })} /></Field>
          </div>
        ) : null}
        <Button type="submit">Add source</Button>
      </form>
    </div>
  );
}
