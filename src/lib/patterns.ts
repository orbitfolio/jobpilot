import type { Application, EvaluationRecord, Stage } from "@/lib/types";
import { STAGES, STAGE_LABELS } from "@/lib/types";

export interface FunnelRow {
  stage: Stage;
  label: string;
  count: number;
}

export interface Insight {
  id: string;
  text: string;
}

export function funnelCounts(applications: Application[]): FunnelRow[] {
  return STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: applications.filter((application) => application.stage === stage).length,
  }));
}

export function rejectionInsights(applications: Application[], evaluations: EvaluationRecord[]): Insight[] {
  const closed = applications.filter((application) => application.stage === "rejected" || application.stage === "ghosted");
  if (closed.length < 2) {
    return [{ id: "need-more", text: "Not enough closed applications to see a pattern. Two rejected or ghosted rows are the minimum." }];
  }
  const insights: Insight[] = [];
  const ghosted = closed.filter((application) => application.stage === "ghosted").length;
  insights.push({
    id: "mix",
    text: `${closed.length} applications are rejected or ghosted. ${ghosted} of those are ghosted, meaning you marked silence rather than a no.`,
  });
  const high = closed.filter((application) => (application.score ?? 0) >= 4);
  if (high.length) {
    insights.push({
      id: "high-score",
      text: `${high.length} of those closed roles scored 4.0 or above. A high fit score is not a hiring promise. Read the notes before you change the rubric.`,
    });
  }
  const reasons = closed.map((application) => application.rejectionReason.trim()).filter(Boolean);
  if (reasons.length) {
    insights.push({ id: "reasons", text: `Notes you wrote on the way out: ${reasons.slice(0, 3).join(" · ")}.` });
  }
  const bySource = new Map<string, number>();
  for (const application of closed) {
    const key = application.source || "unknown source";
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }
  const topSource = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topSource && topSource[1] >= 2) {
    insights.push({ id: "source", text: `${topSource[1]} closed applications came through ${topSource[0]}.` });
  }
  const gaps = evaluations
    .filter((evaluation) => closed.some((application) => application.evaluationId === evaluation.id))
    .flatMap((evaluation) => evaluation.result.requirements.filter((requirement) => requirement.score <= 2).flatMap((requirement) => requirement.missingSkills));
  const gapCounts = new Map<string, number>();
  for (const gap of gaps) gapCounts.set(gap, (gapCounts.get(gap) ?? 0) + 1);
  const repeated = [...gapCounts.entries()].filter((entry) => entry[1] >= 2).sort((a, b) => b[1] - a[1]);
  if (repeated.length) {
    insights.push({
      id: "gaps",
      text: `The same missing skills show up on closed roles: ${repeated.slice(0, 3).map((entry) => `${entry[0]} (${entry[1]})`).join(", ")}.`,
    });
  }
  return insights;
}

export function dueFollowUps(applications: Application[], now = new Date()): Application[] {
  const today = now.getTime();
  return applications
    .filter((application) => application.stage === "applied" || application.stage === "interviewing")
    .filter((application) => application.followUpAt && new Date(application.followUpAt).getTime() <= today)
    .sort((a, b) => new Date(a.followUpAt ?? 0).getTime() - new Date(b.followUpAt ?? 0).getTime());
}

export function practiceFeedback(answer: string, allowedText: string): string[] {
  const notes: string[] = [];
  const words = answer.trim().split(/\s+/).filter(Boolean);
  if (words.length < 40) notes.push("Under 40 words. A STAR answer usually needs a situation, an action, and a result.");
  if (words.length > 220) notes.push("Over 220 words. Cut the preamble and keep one result.");
  if (!/\b(I|we)\b/.test(answer)) notes.push("Name what you did. The answer does not use I or we.");
  const numbers = answer.match(/\d+(?:\.\d+)?%?/g) ?? [];
  const invented = numbers.filter((number) => !allowedText.includes(number.replace("%", "")));
  if (invented.length) notes.push(`These figures are not in your master CV text: ${invented.join(", ")}. Remove them or add the proof to the CV first.`);
  if (!numbers.length) notes.push("No figure in the answer. If the CV has a real number for this story, use that one.");
  if (!notes.length) notes.push("The draft has length, a first person, and only figures that already appear in the CV text.");
  return notes;
}
