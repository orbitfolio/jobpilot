"use client";

import { useState } from "react";
import { EmptyState, PageHeader, StatusBadge } from "@/components/bits";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { collectSourceLines } from "@/lib/cv";
import { downloadDocx, downloadPdf, plainTextPack } from "@/lib/export-docs";
import { claimsInPack, exportBlocked } from "@/lib/provenance";
import { completeAi } from "@/lib/secrets";
import { mapClaims, recheckPack } from "@/lib/tailor";
import type { Claim, EvaluationRecord, TailoredPack } from "@/lib/types";

export function TailorView({ id }: { id: string }) {
  const { data, update, secrets, setNotice } = useApp();
  const found = data?.evaluations.find((item) => item.id === id);
  const [busy, setBusy] = useState(false);
  if (!data) return <p className="text-sm text-muted-foreground">Opening the desk…</p>;
  const desk = data;
  if (!found || !found.tailored) return <EmptyState title="No draft yet." body="Score the posting first. A rule-based draft is created with the evaluation." />;
  const record: EvaluationRecord = found;
  const pack = found.tailored;
  if (!pack) return <EmptyState title="No draft yet." body="Score the posting first. A rule-based draft is created with the record." />;
  const sources = collectSourceLines(data.profile, data.cv);
  const blocked = exportBlocked(claimsInPack(pack));

  function commit(next: TailoredPack) {
    update((draft) => {
      const row = draft.evaluations.find((item) => item.id === id);
      if (!row) return;
      row.tailored = recheckPack(next, draft.profile, draft.cv, row.rawText, row.company, row.title);
      row.updatedAt = new Date().toISOString();
    });
  }

  function edit(claimId: string, text: string) {
    commit(mapClaims(pack, (claim) => (claim.id === claimId ? { ...claim, text, userApproved: false } : claim)));
  }

  function approve(claimId: string) {
    commit(mapClaims(pack, (claim) => (claim.id === claimId ? { ...claim, userApproved: true } : claim)));
  }

  function poison() {
    const first = pack.roles[0]?.claims[0];
    if (!first) return;
    edit(first.id, `${first.text} Reduced infrastructure cost by 42% with Kubernetes.`);
  }

  async function rewrite() {
    setBusy(true);
    try {
      const sourceList = sources.map((source) => `${source.id}: ${source.text}`).join("\n");
      const result = await completeAi(secrets, [
        {
          role: "system",
          content: "Rewrite only from the cited source lines. Return JSON with keys summary and bullets. bullets is an array of {sourceId, text}. Do not add employers, tools, or numbers that are not in the cited line. No markdown.",
        },
        {
          role: "user",
          content: `Role: ${record.title} at ${record.company}\n\nSources:\n${sourceList}\n\nPosting:\n${record.rawText.slice(0, 4000)}`,
        },
      ]);
      if (result.error || !result.text) {
        setNotice(result.error || "The model returned nothing. The rule-based draft is unchanged.");
        return;
      }
      const parsed = JSON.parse(extractJson(result.text)) as { summary?: string; bullets?: { sourceId?: string; text?: string }[] };
      let next = pack;
      if (parsed.summary) next = mapClaims(next, (claim) => (claim.kind === "summary" ? { ...claim, text: parsed.summary ?? claim.text, userApproved: false } : claim));
      for (const bullet of parsed.bullets ?? []) {
        if (!bullet.sourceId || !bullet.text) continue;
        next = mapClaims(next, (claim) => (claim.sourceIds.includes(bullet.sourceId ?? "") && claim.kind === "cv-bullet" ? { ...claim, text: bullet.text ?? claim.text, userApproved: false } : claim));
      }
      next = { ...next, generatedBy: "model", modelNote: "Model text was checked against the cited lines. Unsupported claims stay blocked." };
      commit(next);
      setNotice("Model draft checked. Export stays blocked until every claim is supported or you approve it.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "The model reply was not usable JSON. The previous draft is unchanged.");
    } finally {
      setBusy(false);
    }
  }

  async function exportAs(kind: "pdf" | "docx" | "text") {
    if (blocked.blocked) {
      setNotice("Export is blocked until you edit or approve the highlighted claims.");
      return;
    }
    if (kind === "text") {
      await navigator.clipboard.writeText(plainTextPack(desk.profile, desk.cv, pack, record));
      setNotice("Plain text copied. Paste it yourself.");
      return;
    }
    if (kind === "pdf") await downloadPdf(desk.profile, desk.cv, pack, record);
    if (kind === "docx") await downloadDocx(desk.profile, desk.cv, pack, record);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tailored draft"
        title={`${record.title} at ${record.company}`}
        lede={pack.modelNote}
        actions={
          <>
            <Button type="button" variant="outline" onClick={poison}>Try an unsupported edit</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={rewrite}>{busy ? "Asking the model…" : "Rewrite with model"}</Button>
          </>
        }
      />
      {blocked.blocked ? (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-950">
          {blocked.claims.length} claim{blocked.claims.length === 1 ? "" : "s"} cannot be exported. Each one must trace to a master CV or profile line, including every number. Approve only if you have checked the wording yourself.
        </div>
      ) : (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-950">Every claim currently traces to a cited line. Export does not submit anything.</div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={blocked.blocked} onClick={() => exportAs("pdf")}>PDF</Button>
        <Button type="button" variant="outline" disabled={blocked.blocked} onClick={() => exportAs("docx")}>DOCX</Button>
        <Button type="button" variant="outline" disabled={blocked.blocked} onClick={() => exportAs("text")}>Copy text</Button>
      </div>
      <ClaimEditor claim={pack.summary} sources={sources} onEdit={edit} onApprove={approve} />
      {data.cv.roles.map((role) => {
        const tailored = pack.roles.find((item) => item.roleId === role.id);
        if (!tailored) return null;
        return (
          <section key={role.id} className="space-y-3">
            <h2 className="font-heading text-2xl">{role.title}, {role.company}</h2>
            <p className="text-sm text-muted-foreground">{role.location} · {role.start} – {role.end ?? "Present"}</p>
            {tailored.claims.map((claim) => (
              <ClaimEditor key={claim.id} claim={claim} sources={sources} onEdit={edit} onApprove={approve} />
            ))}
          </section>
        );
      })}
      <section>
        <h2 className="font-heading text-2xl">Skills, in posting order</h2>
        <p className="mt-2 text-sm">{pack.skillOrder.join(" · ")}</p>
        <p className="mt-1 text-xs text-muted-foreground">Only skills already on the master CV. Reordering is not a new claim.</p>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Cover letter</h2>
        {pack.cover.map((claim) => <ClaimEditor key={claim.id} claim={claim} sources={sources} onEdit={edit} onApprove={approve} />)}
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Application answers</h2>
        <p className="text-sm text-muted-foreground">Copy them into the form yourself. This app does not submit.</p>
        {pack.answers.map((answer) => (
          <div key={answer.id} className="space-y-2">
            <p className="text-sm font-medium">{answer.question}</p>
            <ClaimEditor claim={answer.claim} sources={sources} onEdit={edit} onApprove={approve} />
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Contact note</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={pack.contact.name} placeholder="Name" onChange={(event) => commit({ ...pack, contact: { ...pack.contact, name: event.target.value } })} />
          <Input value={pack.contact.role} placeholder="Role" onChange={(event) => commit({ ...pack, contact: { ...pack.contact, role: event.target.value } })} />
        </div>
        <ClaimEditor claim={pack.contact.claim} sources={sources} onEdit={edit} onApprove={approve} />
        <p className="text-xs text-muted-foreground">{pack.contact.claim.text.length} / 300 characters. Draft only.</p>
        <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(pack.contact.claim.text)}>Copy note</Button>
      </section>
      <section className="space-y-2">
        <h2 className="font-heading text-2xl">Practice questions</h2>
        {pack.questions.map((question) => (
          <p key={question.id} className="text-sm"><span className="font-medium">{question.question}</span> <span className="text-muted-foreground">{question.cue}</span></p>
        ))}
      </section>
    </div>
  );
}

function ClaimEditor({ claim, sources, onEdit, onApprove }: { claim: Claim; sources: { id: string; text: string; label: string }[]; onEdit: (id: string, text: string) => void; onApprove: (id: string) => void }) {
  const tone = claim.status === "unsupported" ? "bad" : claim.status === "approved" ? "warn" : "good";
  return (
    <article className={claim.status === "unsupported" ? "rounded-xl bg-rose-50 p-3" : "rounded-xl border border-border p-3"}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <StatusBadge tone={tone}>{claim.status}</StatusBadge>
        {claim.status === "unsupported" ? <Button type="button" size="sm" variant="outline" onClick={() => onApprove(claim.id)}>Approve anyway</Button> : null}
      </div>
      <Textarea value={claim.text} onChange={(event) => onEdit(claim.id, event.target.value)} />
      {claim.reasons.map((reason) => <p key={reason} className="mt-2 text-xs leading-5">{reason}</p>)}
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {claim.sourceIds.map((sourceId) => {
          const source = sources.find((item) => item.id === sourceId);
          return <li key={sourceId}>{source ? `${source.label}: ${source.text}` : `Missing source ${sourceId}`}</li>;
        })}
      </ul>
    </article>
  );
}

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The model did not return JSON.");
  return text.slice(start, end + 1);
}
