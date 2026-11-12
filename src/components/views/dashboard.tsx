"use client";

import Link from "next/link";
import { PageHeader, ScorePill } from "@/components/bits";
import { useApp } from "@/components/app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dueFollowUps, funnelCounts, rejectionInsights } from "@/lib/patterns";
import { formatDate } from "@/lib/text";

export function DashboardView() {
  const { data } = useApp();
  if (!data) return <p className="text-sm text-muted-foreground">Opening the desk…</p>;
  const funnel = funnelCounts(data.applications);
  const max = Math.max(1, ...funnel.map((row) => row.count));
  const due = dueFollowUps(data.applications);
  const insights = rejectionInsights(data.applications, data.evaluations);
  const fresh = data.matches.filter((match) => match.status === "new");
  const recent = data.evaluations.slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Desk"
        title={`Good to see you, ${data.profile.fullName.split(" ")[0]}.`}
        lede="Score a posting before you spend the evening on it. The apply line is yours. Nothing on this desk submits an application or sends a message."
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="New matches" value={String(fresh.length)} href="/inbox" detail={data.lastScanNote} />
        <Stat label="Follow-ups due" value={String(due.length)} href="/tracker" detail={due[0] ? `${due[0].company} · ${formatDate(due[0].followUpAt)}` : "None waiting"} />
        <Stat label="Apply line" value={data.rubric.threshold.toFixed(1)} href="/settings" detail="Change the threshold and the seven weights any time." />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Funnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {funnel.map((row) => (
            <div key={row.stage} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm">
              <span>{row.label}</span>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
              <span className="text-right tabular-nums">{row.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Due follow-ups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {due.length === 0 ? <p className="text-muted-foreground">No applied or interviewing row is past its reminder.</p> : null}
            {due.map((application) => (
              <div key={application.id}>
                <p className="font-medium">{application.company}</p>
                <p className="text-muted-foreground">{application.title} · due {formatDate(application.followUpAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What the closed rows say</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6">
            {insights.map((insight) => (
              <p key={insight.id}>{insight.text}</p>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent evaluations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.length === 0 ? <p className="text-sm text-muted-foreground">Paste a job to start a record.</p> : null}
          {recent.map((evaluation) => (
            <Link key={evaluation.id} href={`/evaluate/${evaluation.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
              <span>
                <span className="font-medium">{evaluation.company}</span>
                <span className="text-muted-foreground"> · {evaluation.title}</span>
              </span>
              <ScorePill score={evaluation.result.globalScore} threshold={data.rubric.threshold} gap={data.rubric.considerGap} />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, href, detail }: { label: string; value: string; href: string; detail: string }) {
  return (
    <Link href={href} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-heading mt-1 text-3xl">{value}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </Link>
  );
}
