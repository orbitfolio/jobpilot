"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, lede, actions }: { eyebrow?: string; title: string; lede?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">{eyebrow}</p> : null}
        <h1 className="font-heading mt-1 text-3xl tracking-tight text-balance sm:text-4xl">{title}</h1>
        {lede ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{lede}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-5 text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function ScorePill({ score, threshold, gap }: { score: number; threshold: number; gap: number }) {
  const tone = score >= threshold ? "bg-emerald-100 text-emerald-950" : score >= threshold - gap ? "bg-amber-100 text-amber-950" : "bg-rose-100 text-rose-950";
  return <span className={cn("inline-flex h-7 items-center rounded-full px-2.5 text-sm font-semibold tabular-nums", tone)}>{score.toFixed(1)}</span>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const variant = tone === "bad" ? "destructive" : tone === "good" ? "default" : "secondary";
  return <Badge variant={variant} className={tone === "warn" ? "bg-amber-100 text-amber-950" : undefined}>{children}</Badge>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-xl text-muted-foreground">{body}</p>
    </div>
  );
}

export function LinesField({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (next: string[]) => void; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        value={value.join("\n")}
        onChange={(event) => onChange(event.target.value.split("\n"))}
      />
    </Field>
  );
}
