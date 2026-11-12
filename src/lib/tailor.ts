import { collectSourceLines } from "@/lib/cv";
import { findSkills } from "@/lib/extract";
import { applyReview, contextFor } from "@/lib/provenance";
import { createId, normalizeSpace } from "@/lib/text";
import type { Claim, ClaimKind, DraftAnswer, MasterCv, Profile, TailoredPack } from "@/lib/types";

export function tailorWithRules(input: {
  jd: string;
  company: string;
  title: string;
  profile: Profile;
  cv: MasterCv;
  contactName?: string;
  contactRole?: string;
}): TailoredPack {
  const sources = collectSourceLines(input.profile, input.cv);
  const jd = input.jd;
  const ranked = rankBullets(input.cv, jd);
  const summary = makeClaim("summary", input.cv.summary, ["summary"], false);
  const roles = input.cv.roles.map((role) => {
    const chosen = ranked.filter((item) => item.roleId === role.id).slice(0, 4);
    const fallback = chosen.length ? chosen : role.bullets.slice(0, 2).map((bullet) => ({ roleId: role.id, bullet }));
    return {
      roleId: role.id,
      claims: fallback.map((item) => makeClaim("cv-bullet", item.bullet.text, [item.bullet.id], false)),
    };
  });
  const skillOrder = orderSkills(input.cv.skills, jd);
  const best = ranked[0]?.bullet;
  const second = ranked[1]?.bullet ?? best;
  const coverTexts: { text: string; sourceIds: string[] }[] = [
    {
      text: `Dear hiring team, I am writing about the ${input.title || "open"} role at ${input.company || "your team"}. ${input.cv.summary}`,
      sourceIds: ["summary", "profile:name"],
    },
  ];
  if (best) {
    coverTexts.push({
      text: `In my recent work, ${lowercaseFirst(best.text)}`,
      sourceIds: [best.id],
    });
  }
  if (second && second !== best) {
    coverTexts.push({
      text: `A second proof point from the same record: ${lowercaseFirst(second.text)}`,
      sourceIds: [second.id],
    });
  }
  coverTexts.push({
    text: `I am based in ${input.profile.location}. ${sources.find((line) => line.id === "profile:auth")?.text ?? ""}`,
    sourceIds: ["profile:location", "profile:auth"],
  });
  const cover = coverTexts.map((item) => makeClaim("cover", normalizeSpace(item.text), item.sourceIds, false));
  const answers: DraftAnswer[] = [
    answer("why-role", "Why this role?", `The ${input.title || "role"} at ${input.company || "the company"} lines up with this proof point. ${best?.text ?? input.cv.summary}`, best ? [best.id] : ["summary"]),
    answer("project", "Tell us about a relevant project.", best?.text ?? input.cv.summary, best ? [best.id] : ["summary"]),
    answer("auth", "Are you authorised to work?", sources.find((line) => line.id === "profile:auth")?.text ?? "", ["profile:auth"]),
    answer("salary", "What are your salary expectations?", sources.find((line) => line.id === "profile:salary")?.text ?? "", ["profile:salary"]),
    answer("notice", "What is your notice period?", sources.find((line) => line.id === "profile:notice")?.text ?? "", ["profile:notice"]),
  ];
  const contactName = input.contactName?.trim() || "";
  const note = normalizeSpace(
    `Hi${contactName ? ` ${contactName}` : ""}, I am ${input.profile.fullName}, ${input.profile.headline}. ${best ? best.text : input.cv.summary} The ${input.title || "role"} at ${input.company || "your company"} looks close to that work. Open to a short conversation?`,
  ).slice(0, 300);
  const contact = {
    name: input.contactName?.trim() ?? "",
    role: input.contactRole?.trim() || "Hiring manager",
    claim: makeClaim("note", note, best ? [best.id, "profile:name"] : ["summary", "profile:name"], false),
  };
  const questions = (findSkills(jd).slice(0, 5).length ? findSkills(jd).slice(0, 5) : ["a recent project"]).map((skill, index) => ({
    id: `q-${index + 1}`,
    question: skill === "a recent project" ? "Walk through a project you are proud of, in STAR form." : `Tell me about a time you used ${skill}.`,
    cue: "Use a story whose result line cites a master CV bullet. Do not invent a metric.",
  }));
  const pack: TailoredPack = {
    generatedBy: "rules",
    modelNote: "Selected and lightly framed from your master CV. No new facts were added by a model.",
    summary,
    roles,
    skillOrder,
    cover,
    answers,
    contact,
    questions,
    followUpDraft: normalizeSpace(
      `Hello, I applied for the ${input.title || "role"} and remain interested. Happy to share anything else you need.`,
    ),
  };
  return recheckPack(pack, input.profile, input.cv, jd, input.company, input.title);
}

export function mapClaims(pack: TailoredPack, mapper: (claim: Claim) => Claim): TailoredPack {
  return {
    ...pack,
    summary: mapper(pack.summary),
    roles: pack.roles.map((role) => ({ ...role, claims: role.claims.map(mapper) })),
    cover: pack.cover.map(mapper),
    answers: pack.answers.map((item) => ({ ...item, claim: mapper(item.claim) })),
    contact: { ...pack.contact, claim: mapper(pack.contact.claim) },
  };
}

export function recheckPack(pack: TailoredPack, profile: Profile, cv: MasterCv, jd: string, company: string, title: string): TailoredPack {
  const sources = collectSourceLines(profile, cv);
  const context = `${contextFor("cover", jd, company, title)}\n${pack.contact.name}\n${pack.contact.role}`;
  const check = (claim: Claim) => applyReview(claim, sources, claim.kind === "cv-bullet" || claim.kind === "summary" ? "" : context);
  return {
    ...pack,
    summary: check(pack.summary),
    roles: pack.roles.map((role) => ({ ...role, claims: role.claims.map(check) })),
    cover: pack.cover.map(check),
    answers: pack.answers.map((answer) => ({ ...answer, claim: check(answer.claim) })),
    contact: { ...pack.contact, claim: check(pack.contact.claim) },
  };
}

export function rankBullets(cv: MasterCv, jd: string): { roleId: string; bullet: { id: string; text: string }; score: number }[] {
  const skills = findSkills(jd);
  const hay = jd.toLowerCase();
  const ranked = cv.roles.flatMap((role) =>
    role.bullets.map((bullet) => {
      const skillHits = skills.filter((skill) => bullet.text.toLowerCase().includes(skill.split(".")[0])).length;
      const tokens = bullet.text.toLowerCase().match(/[a-z][a-z0-9+]{3,}/g) ?? [];
      const overlap = tokens.filter((token) => hay.includes(token)).length;
      return { roleId: role.id, bullet, score: skillHits * 5 + overlap };
    }),
  );
  return ranked.sort((a, b) => b.score - a.score);
}

function orderSkills(skills: string[], jd: string): string[] {
  const wanted = findSkills(jd);
  return [...skills].sort((a, b) => Number(wanted.some((skill) => skillMentionLoose(b, skill))) - Number(wanted.some((skill) => skillMentionLoose(a, skill))));
}

function skillMentionLoose(skill: string, wanted: string): boolean {
  return skill.toLowerCase().includes(wanted.split(".")[0]);
}

function makeClaim(kind: ClaimKind, text: string, sourceIds: string[], userApproved: boolean): Claim {
  return {
    id: createId(kind),
    kind,
    text: normalizeSpace(text),
    sourceIds,
    userApproved,
    status: "supported",
    reasons: [],
  };
}

function answer(id: string, question: string, text: string, sourceIds: string[]): DraftAnswer {
  return { id, question, claim: makeClaim("answer", text, sourceIds, false) };
}

function lowercaseFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function negotiationDraft(input: {
  currency: string;
  desiredMin: number;
  desiredMax: number;
  actualBase: number | null;
  company: string;
}): string {
  const floor = input.desiredMin;
  const actual = input.actualBase;
  if (actual == null) {
    return `Thank you for the conversation with ${input.company || "the team"}. Before I respond to numbers, I want the full breakdown of base, bonus, and equity. My target base is ${floor.toLocaleString("en-CA")}–${input.desiredMax.toLocaleString("en-CA")} ${input.currency}, and I will not anchor under ${floor.toLocaleString("en-CA")}.`;
  }
  if (actual < floor) {
    return `Thank you for the offer of ${actual.toLocaleString("en-CA")} ${input.currency}. That is below my floor of ${floor.toLocaleString("en-CA")} ${input.currency}. I would like to discuss a base of ${Math.max(floor, input.desiredMax).toLocaleString("en-CA")} ${input.currency}. I am not asking to go under the floor I set.`;
  }
  return `Thank you for the offer of ${actual.toLocaleString("en-CA")} ${input.currency}, which meets my floor of ${floor.toLocaleString("en-CA")}. I would like to confirm bonus, equity, vacation, and title, and I am glad to talk through those terms.`;
}
