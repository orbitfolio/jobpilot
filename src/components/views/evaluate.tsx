"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, PageHeader } from "@/components/bits";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { STRONG_SAMPLE, WEAK_SAMPLE } from "@/lib/seed";
import { evaluateJob } from "@/lib/scoring";
import { tailorWithRules } from "@/lib/tailor";
import { createId } from "@/lib/text";
import type { LivenessResult } from "@/lib/types";

export function EvaluateView() {
  const { data, update, setNotice } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const match = data?.matches.find((item) => item.id === params.get("match"));
  const [url, setUrl] = useState(match?.url ?? "");
  const [company, setCompany] = useState(match?.company ?? "");
  const [title, setTitle] = useState(match?.title ?? "");
  const [location, setLocation] = useState(match?.location ?? "");
  const [text, setText] = useState(match?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data) return <p className="text-sm text-muted-foreground">Opening the desk…</p>;
  const desk = data;

  async function score(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let liveness: LivenessResult | null = null;
      let posting = text.trim();
      if (url.trim()) {
        const response = await fetch("/api/liveness", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
        liveness = (await response.json()) as LivenessResult;
        if (posting.length < 200 && liveness.text) posting = `${posting}\n\n${liveness.text}`.trim();
      }
      if (posting.length < 40) {
        setError(liveness?.signals?.[0] || "Paste the description, or use a URL the server can read.");
        return;
      }
      const result = evaluateJob({ jd: posting, company, title, profile: desk.profile, cv: desk.cv, rubric: desk.rubric });
      const tailored = tailorWithRules({ jd: posting, company, title, profile: desk.profile, cv: desk.cv });
      const id = createId("eval");
      const now = new Date().toISOString();
      let applicationId = createId("app");
      update((draft) => {
        const existing = url.trim() ? draft.applications.find((item) => item.url && item.url === url.trim()) : undefined;
        if (existing) applicationId = existing.id;
        draft.evaluations.unshift({
          id,
          createdAt: now,
          updatedAt: now,
          company: company || "Unknown company",
          title: title || "Untitled role",
          location,
          url: url.trim(),
          rawText: posting,
          liveness,
          result,
          tailored,
          applicationId,
          userOverride: null,
        });
        if (existing) {
          existing.evaluationId = id;
          existing.score = result.globalScore;
          existing.salaryLabel = result.salaryLabel;
          existing.updatedAt = now;
          existing.company = company || existing.company;
          existing.title = title || existing.title;
        } else {
          draft.applications.unshift({
            id: applicationId,
            evaluationId: id,
            company: company || "Unknown company",
            title: title || "Untitled role",
            url: url.trim(),
            source: "Pasted",
            location,
            salaryLabel: result.salaryLabel,
            score: result.globalScore,
            stage: "saved",
            appliedAt: null,
            followUpAt: null,
            createdAt: now,
            updatedAt: now,
            notes: [],
            contacts: [],
            rejectionReason: "",
            followUpDraft: tailored.followUpDraft,
          });
        }
        if (match) {
          const row = draft.matches.find((item) => item.id === match.id);
          if (row) row.status = "evaluated";
        }
      });
      setNotice(`${result.recommendation === "apply" ? "Worth a careful look" : result.recommendation === "consider" ? "Below the line, close enough to think about" : "Below your line"}. Saved to the tracker. Nothing was submitted.`);
      router.push(`/evaluate/${id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The evaluation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={score}>
      <PageHeader
        eyebrow="Evaluate"
        title="Paste one job."
        lede="The score uses your rubric and your CV. A URL is checked from the server for a live, closed, or unknown posting. You still decide, and you still press submit on the employer's site."
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => fill(STRONG_SAMPLE, "Lumenfield", "Senior Product Engineer", "Toronto, Canada")}>Strong sample</Button>
            <Button type="button" variant="outline" onClick={() => fill(WEAK_SAMPLE, "Northstar Labs", "Staff Machine Learning Engineer", "San Francisco, United States")}>Weak sample</Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job URL" hint="Optional. Leave it blank if you only have the text.">
          <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" />
        </Field>
        <Field label="Company">
          <Input value={company} onChange={(event) => setCompany(event.target.value)} />
        </Field>
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Location">
          <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Toronto, Canada" />
        </Field>
      </div>
      <Field label="Job description" hint="If the URL comes back thin, paste the description here.">
        <Textarea className="min-h-64" value={text} onChange={(event) => setText(event.target.value)} />
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={busy} className="h-10 px-4">{busy ? "Checking…" : "Check and score"}</Button>
      <p className="text-xs text-muted-foreground">Follow-up reminders are set {data.settings.followUpDays} days after you move a row to Applied.</p>
    </form>
  );

  function fill(sample: string, nextCompany: string, nextTitle: string, nextLocation: string) {
    setText(sample);
    setCompany(nextCompany);
    setTitle(nextTitle);
    setLocation(nextLocation);
    setUrl("");
  }
}
