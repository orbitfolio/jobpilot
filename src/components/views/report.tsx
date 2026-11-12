"use client";

import Link from "next/link";
import { EmptyState, PageHeader, ScorePill, StatusBadge } from "@/components/bits";
import { useApp } from "@/components/app-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WEIGHT_LABELS, type Recommendation } from "@/lib/types";

export function ReportView({ id }: { id: string }) {
  const { data, update } = useApp();
  if (!data) return <p className="text-sm text-muted-foreground">Opening the desk…</p>;
  const evaluation = data.evaluations.find((item) => item.id === id);
  if (!evaluation) return <EmptyState title="That evaluation is not on this device." body="It may have been cleared with the demo data." />;
  const result = evaluation.result;
  const recommendation = evaluation.userOverride ?? result.recommendation;

  function override(next: Recommendation | null) {
    update((draft) => {
      const row = draft.evaluations.find((item) => item.id === id);
      if (!row) return;
      row.userOverride = next;
      row.updatedAt = new Date().toISOString();
      const application = draft.applications.find((item) => item.id === row.applicationId);
      if (application && next) {
        application.notes.unshift({
          id: `note-${Date.now()}`,
          at: new Date().toISOString(),
          text: next === result.recommendation ? "Cleared the override." : `You overrode the recommendation to ${next}. The computed score is still ${result.globalScore}.`,
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Evaluation"
        title={`${evaluation.title} · ${evaluation.company}`}
        lede={result.recommendationReason}
        actions={
          <>
            <ScorePill score={result.globalScore} threshold={result.threshold} gap={data.rubric.considerGap} />
            <Link href={`/tailor/${evaluation.id}`} className={cn(buttonVariants(), "h-9")}>Review tailored CV</Link>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge tone={recommendation === "apply" ? "good" : recommendation === "consider" ? "warn" : "bad"}>{recommendation}</StatusBadge>
        <StatusBadge>Confidence {result.confidence}</StatusBadge>
        {result.hardBlocked ? <StatusBadge tone="bad">Hard gate</StatusBadge> : null}
        {evaluation.userOverride ? <StatusBadge tone="warn">Your override</StatusBadge> : null}
        <span className="text-muted-foreground">{evaluation.location || "Location not entered"}</span>
      </div>
      <Card>
        <CardHeader><CardTitle>How the number was built</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm leading-6">
          <p>{result.formula}</p>
          <p className="text-muted-foreground">{result.targetTitleNote}</p>
          {result.hardBlockReasons.map((reason) => <p key={reason}>{reason}</p>)}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => override("apply")}>I’ll apply anyway</Button>
            <Button type="button" variant="outline" onClick={() => override("skip")}>Skip</Button>
            <Button type="button" variant="ghost" onClick={() => override(null)}>Clear override</Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {result.dimensions.map((dimension) => (
          <Card key={dimension.key} size="sm">
            <CardContent className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <p className="font-medium">{WEIGHT_LABELS[dimension.key]} <span className="text-muted-foreground">· {dimension.evidence}</span></p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{dimension.explanation}</p>
              </div>
              <p className="text-sm tabular-nums sm:text-right">
                <span className="font-semibold">{dimension.score.toFixed(1)}</span>
                <span className="block text-muted-foreground">{dimension.weightPercent}% of rubric · {dimension.contribution.toFixed(2)} pts</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Posting check</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm leading-6">
          {evaluation.liveness ? (
            <>
              <p>State: {evaluation.liveness.state}. These are observations, not a verdict about the employer.</p>
              {evaluation.liveness.signals.map((signal) => <p key={signal}>{signal}</p>)}
            </>
          ) : (
            <p>No URL was checked. Pasted text has nothing to probe for liveness.</p>
          )}
          <p className="text-muted-foreground">Salary read: {result.salaryLabel}. Location read: {result.detectedLocation}. Level read: {result.detectedLevel ?? "not named"}.</p>
          <p className="text-muted-foreground">Confidence: {result.confidenceReasons.join(" ")}</p>
          {result.confidenceGaps.map((gap) => <p key={gap}>{gap}</p>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Requirements</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {result.requirements.map((requirement) => (
            <article key={requirement.id} className="border-b border-border pb-4 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{requirement.text}</p>
                <span className="text-sm tabular-nums">{requirement.score.toFixed(1)} / 5</span>
              </div>
              <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">Importance {requirement.importance} · {requirement.importanceSource}</p>
              <p className="mt-2 text-sm leading-6">{requirement.importanceReason}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{requirement.explanation}</p>
              {requirement.evidence.map((line) => <p key={line} className="mt-1 text-sm">“{line}”</p>)}
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
