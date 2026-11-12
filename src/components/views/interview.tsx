"use client";

import { useState } from "react";
import { PageHeader } from "@/components/bits";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cvPlainText } from "@/lib/cv";
import { practiceFeedback } from "@/lib/patterns";
import { createId } from "@/lib/text";

export function InterviewView() {
  const { data, update } = useApp();
  const [question, setQuestion] = useState("Tell me about a time you improved reliability.");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string[]>([]);
  if (!data) return <p className="text-sm text-muted-foreground">Opening the desk…</p>;
  const allowed = cvPlainText(data.cv);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Interview" title="Stories you can defend." lede="Each STAR story points at master CV lines. Practice feedback flags figures that are not in the CV text. It does not invent a better answer for you." />
      <section className="space-y-4">
        {data.stories.map((story) => (
          <article key={story.id} className="space-y-2 rounded-xl border border-border p-4 text-sm">
            <Input value={story.title} onChange={(event) => update((draft) => { const row = draft.stories.find((item) => item.id === story.id); if (row) row.title = event.target.value; })} />
            {(["situation", "task", "action", "result", "reflection"] as const).map((field) => (
              <label key={field} className="grid gap-1">
                <span className="text-xs tracking-wide text-muted-foreground uppercase">{field}</span>
                <Textarea value={story[field]} onChange={(event) => update((draft) => { const row = draft.stories.find((item) => item.id === story.id); if (row) row[field] = event.target.value; })} />
              </label>
            ))}
            <p className="text-xs text-muted-foreground">Sources: {story.sourceIds.join(", ")}</p>
          </article>
        ))}
        <Button type="button" variant="outline" onClick={() => update((draft) => draft.stories.push({ id: createId("story"), title: "New story", situation: "", task: "", action: "", result: "", reflection: "", sourceIds: [], tags: [] }))}>Add a story</Button>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Practice</h2>
        <Input value={question} onChange={(event) => setQuestion(event.target.value)} />
        <Textarea className="min-h-40" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Answer in your own words. Use only numbers that already appear in the CV." />
        <Button
          type="button"
          onClick={() => {
            const notes = practiceFeedback(answer, allowed);
            setFeedback(notes);
            update((draft) => {
              draft.practice.unshift({ id: createId("practice"), question, answer, feedback: notes, updatedAt: new Date().toISOString() });
              draft.practice = draft.practice.slice(0, 20);
            });
          }}
        >
          Check this answer
        </Button>
        {feedback.map((line) => <p key={line} className="text-sm">{line}</p>)}
      </section>
    </div>
  );
}
