import type { MasterCv, Profile, SourceLine } from "@/lib/types";
import { AUTH_LABELS } from "@/lib/types";

export function collectSourceLines(profile: Profile, cv: MasterCv): SourceLine[] {
  const lines: SourceLine[] = [
    { id: "summary", text: cv.summary, label: "Master summary" },
    {
      id: "profile:name",
      text: `Name: ${profile.fullName}. ${profile.headline}`,
      label: "Profile name",
    },
    {
      id: "profile:location",
      text: `Based in ${profile.location}. City ${profile.city}. Country ${profile.country}.`,
      label: "Profile location",
    },
    {
      id: "profile:years",
      text: `${profile.yearsExperience} years of experience as a ${profile.seniority} candidate.`,
      label: "Profile seniority",
    },
    {
      id: "profile:salary",
      text: `Target salary ${profile.salary.min}-${profile.salary.max} ${profile.salary.currency} per year.`,
      label: "Salary target",
    },
    {
      id: "profile:notice",
      text: `Notice period: ${profile.noticePeriod}.`,
      label: "Notice period",
    },
    {
      id: "profile:auth",
      text: profile.workAuthorization
        .map((entry) => `Work authorisation in ${entry.country}: ${AUTH_LABELS[entry.status]}. ${entry.note}`)
        .join(" "),
      label: "Work authorisation",
    },
  ];

  for (const skill of cv.skills) {
    lines.push({ id: `skill:${slug(skill)}`, text: skill, label: `Skill: ${skill}` });
  }
  for (const role of cv.roles) {
    lines.push({
      id: `role:${role.id}`,
      text: `${role.title} at ${role.company}, ${role.location}, ${role.start} to ${role.end ?? "present"}.`,
      label: `${role.title}, ${role.company}`,
    });
    for (const bullet of role.bullets) {
      lines.push({ id: bullet.id, text: bullet.text, label: `${role.company} bullet` });
    }
  }
  for (const school of cv.education) {
    lines.push({
      id: school.id,
      text: `${school.credential}, ${school.school}, ${school.year}. ${school.details}`,
      label: school.school,
    });
  }
  for (const proof of cv.proofPoints) {
    lines.push({ id: proof.id, text: proof.text, label: "Proof point" });
  }
  return lines.filter((line) => line.text.trim().length > 0);
}

export function cvPlainText(cv: MasterCv): string {
  return [
    cv.summary,
    ...cv.skills,
    ...cv.roles.flatMap((role) => [
      role.company,
      role.title,
      role.location,
      ...role.bullets.map((bullet) => bullet.text),
    ]),
    ...cv.education.map((item) => `${item.credential} ${item.school} ${item.details}`),
    ...cv.proofPoints.map((item) => item.text),
  ].join("\n");
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
