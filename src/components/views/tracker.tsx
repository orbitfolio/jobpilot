"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState, PageHeader, ScorePill } from "@/components/bits";
import { useApp } from "@/components/app-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { STAGE_LABELS, STAGES, type Application, type Stage } from "@/lib/types";
import { formatDate } from "@/lib/text";

export function TrackerView() {
  const { data, update } = useApp();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage | "all">("all");
  const [minScore, setMinScore] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState("board");
  const rows = useMemo(() => {
    return (data?.applications ?? []).filter((application) => {
      const hay = `${application.company} ${application.title} ${application.source}`.toLowerCase();
      if (query && !hay.includes(query.toLowerCase())) return false;
      if (stage !== "all" && application.stage !== stage) return false;
      if ((application.score ?? 0) < minScore) return false;
      return true;
    });
  }, [data, query, stage, minScore]);
  if (!data) return <p className="text-sm text-muted-foreground">Opening the desk…</p>;
  const open = data.applications.find((application) => application.id === openId) ?? null;

  function move(id: string, next: Stage) {
    update((draft) => {
      const application = draft.applications.find((item) => item.id === id);
      if (!application) return;
      application.stage = next;
      application.updatedAt = new Date().toISOString();
      if ((next === "applied" || next === "interviewing") && !application.appliedAt) {
        application.appliedAt = application.updatedAt;
      }
      if (next === "applied" && !application.followUpAt) {
        const follow = new Date();
        follow.setDate(follow.getDate() + draft.settings.followUpDays);
        application.followUpAt = follow.toISOString();
      }
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Tracker" title="Every application you chose to keep." lede="Move a card when you act. The app records the date. It does not email the recruiter." />
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_8rem]">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by company, title, or source" />
        <Select value={stage} items={stageItems} onValueChange={(value) => setStage((value ?? "all") as Stage | "all")}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((item) => <SelectItem key={item} value={item}>{STAGE_LABELS[item]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="number" min={0} max={5} step={0.1} value={minScore} onChange={(event) => setMinScore(Number(event.target.value) || 0)} aria-label="Minimum score" />
      </div>
      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
        </TabsList>
        <TabsContent value="board" className="mt-4">
          {rows.length === 0 ? <EmptyState title="No rows match." body="Clear the filter or score a posting from Evaluate." /> : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {STAGES.map((column) => (
                <section
                  key={column}
                  className="w-64 shrink-0 rounded-xl bg-muted/60 p-2"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    const id = event.dataTransfer.getData("text/plain");
                    if (id) move(id, column);
                  }}
                >
                  <h2 className="px-1 py-2 text-xs font-medium tracking-wide uppercase">{STAGE_LABELS[column]}</h2>
                  <div className="space-y-2">
                    {rows.filter((row) => row.stage === column).map((row) => (
                      <article key={row.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", row.id)} className="cursor-grab rounded-lg bg-card p-3 text-sm ring-1 ring-foreground/10">
                        <button type="button" className="text-left" onClick={() => setOpenId(row.id)}>
                          <p className="font-medium">{row.company}</p>
                          <p className="text-muted-foreground">{row.title}</p>
                        </button>
                        <div className="mt-2 flex items-center justify-between">
                          {row.score != null ? <ScorePill score={row.score} threshold={data.rubric.threshold} gap={data.rubric.considerGap} /> : <span className="text-xs text-muted-foreground">No score</span>}
                          <span className="text-xs text-muted-foreground">{formatDate(row.followUpAt)}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="table" className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="py-2">Company</th>
                <th>Stage</th>
                <th>Score</th>
                <th>Applied</th>
                <th>Follow-up</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-2">
                    <button type="button" className="text-left" onClick={() => setOpenId(row.id)}>
                      <span className="font-medium">{row.company}</span>
                      <span className="block text-muted-foreground">{row.title}</span>
                    </button>
                  </td>
                  <td>{STAGE_LABELS[row.stage]}</td>
                  <td>{row.score?.toFixed(1) ?? "—"}</td>
                  <td>{formatDate(row.appliedAt)}</td>
                  <td>{formatDate(row.followUpAt)}</td>
                  <td>{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
      <Dialog open={Boolean(open)} onOpenChange={(next) => { if (!next) setOpenId(null); }}>
        <DialogContent className="sm:max-w-lg">
          {open ? <ApplicationDialog application={open} onMove={move} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const stageItems = { all: "All stages", ...Object.fromEntries(STAGES.map((stage) => [stage, STAGE_LABELS[stage]])) };

function ApplicationDialog({ application, onMove }: { application: Application; onMove: (id: string, stage: Stage) => void }) {
  const { update } = useApp();
  const [note, setNote] = useState("");
  function patch(recipe: (application: Application) => void) {
    update((draft) => {
      const row = draft.applications.find((item) => item.id === application.id);
      if (!row) return;
      recipe(row);
      row.updatedAt = new Date().toISOString();
    });
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>{application.company}</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">{application.title}</p>
      <Select value={application.stage} items={Object.fromEntries(STAGES.map((stage) => [stage, STAGE_LABELS[stage]]))} onValueChange={(value) => value && onMove(application.id, value as Stage)}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STAGES.map((item) => <SelectItem key={item} value={item}>{STAGE_LABELS[item]}</SelectItem>)}
        </SelectContent>
      </Select>
      <label className="grid gap-1 text-sm">
        Follow-up date
        <Input type="date" value={application.followUpAt?.slice(0, 10) ?? ""} onChange={(event) => patch((row) => { row.followUpAt = event.target.value ? new Date(event.target.value).toISOString() : null; })} />
      </label>
      <label className="grid gap-1 text-sm">
        Rejection or silence note
        <Input value={application.rejectionReason} onChange={(event) => patch((row) => { row.rejectionReason = event.target.value; })} />
      </label>
      <label className="grid gap-1 text-sm">
        Follow-up draft
        <Textarea value={application.followUpDraft} onChange={(event) => patch((row) => { row.followUpDraft = event.target.value; })} />
      </label>
      <div className="space-y-2 text-sm">
        {application.notes.map((item) => <p key={item.id}><span className="text-muted-foreground">{formatDate(item.at)} · </span>{item.text}</p>)}
      </div>
      <div className="flex gap-2">
        <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note" />
        <Button type="button" onClick={() => { if (!note.trim()) return; patch((row) => row.notes.unshift({ id: `note-${Date.now()}`, at: new Date().toISOString(), text: note.trim() })); setNote(""); }}>Save</Button>
      </div>
      <div className="flex gap-2">
        {application.evaluationId ? <Link className={cn(buttonVariants({ variant: "outline" }))} href={`/evaluate/${application.evaluationId}`}>Evaluation</Link> : null}
        {application.evaluationId ? <Link className={cn(buttonVariants({ variant: "outline" }))} href={`/tailor/${application.evaluationId}`}>Draft</Link> : null}
        <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(application.followUpDraft)}>Copy follow-up</Button>
      </div>
    </>
  );
}
