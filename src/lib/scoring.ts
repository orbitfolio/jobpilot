import { chooseSalary, fromCad, toCad, annualize, FX_NOTE } from "@/lib/currency";
import { cvPlainText } from "@/lib/cv";
import {
  detectSeniority,
  extractRequirements,
  extractYears,
  findSkills,
  readLocation,
  SENIORITY_RANK,
  skillMentioned,
  sponsorshipSignal,
} from "@/lib/extract";
import { clamp, round1 } from "@/lib/text";
import {
  WEIGHT_KEYS,
  WEIGHT_LABELS,
  type DimensionScore,
  type EvaluationResult,
  type EvidenceStatus,
  type MasterCv,
  type Profile,
  type Recommendation,
  type RequirementScore,
  type Rubric,
  type WeightKey,
} from "@/lib/types";

export interface ScoreInput {
  jd: string;
  company: string;
  title: string;
  profile: Profile;
  cv: MasterCv;
  rubric: Rubric;
}

export function evaluateJob(input: ScoreInput): EvaluationResult {
  const jd = input.jd.trim();
  const requirements = scoreRequirements(jd, input.profile, input.cv);
  const skills = scoreSkills(requirements, jd);
  const seniority = scoreSeniority(jd, input.profile);
  const location = scoreLocation(jd, input.profile);
  const salary = scoreSalary(jd, input.profile);
  const workAuth = scoreWorkAuth(jd, input.profile);
  const company = scoreCompany(jd, input.company, input.profile);
  const dealbreakers = scoreDealbreakers(jd, input.profile);

  const rawDimensions: Omit<DimensionScore, "weight" | "weightPercent" | "contribution">[] = [
    skills,
    seniority,
    location,
    salary,
    workAuth,
    company,
    dealbreakers,
  ];

  const weightSum = WEIGHT_KEYS.reduce((sum, key) => sum + Math.max(0, input.rubric.weights[key] || 0), 0);
  const equal = weightSum === 0;
  const dimensions: DimensionScore[] = rawDimensions.map((dimension) => {
    const weight = equal ? 1 : Math.max(0, input.rubric.weights[dimension.key] || 0);
    const percent = equal ? 100 / WEIGHT_KEYS.length : (weight / weightSum) * 100;
    return {
      ...dimension,
      weight,
      weightPercent: Math.round(percent * 10) / 10,
      contribution: round1(dimension.score * (percent / 100)),
    };
  });

  const rawScore = round1(clamp(dimensions.reduce((sum, dimension) => sum + dimension.score * (dimension.weightPercent / 100), 0), 1, 5));
  const hardBlockReasons = [
    ...workAuth.hardReasons,
    ...(input.rubric.dealbreakersAreHardGates ? dealbreakers.hits.map((hit) => `Dealbreaker “${hit}” appears in the posting.`) : []),
  ];
  const hardBlocked = hardBlockReasons.length > 0;
  const cap = clamp(input.rubric.hardGateCap, 1, 5);
  const globalScore = hardBlocked ? round1(Math.min(rawScore, cap)) : rawScore;

  const formulaParts = dimensions.map((dimension) => `${dimension.score}×${trimNumber(dimension.weightPercent)}%`);
  const formula = equal
    ? `All weights were 0, so each dimension was treated equally. ${globalScore} = ${formulaParts.join(" + ")}.`
    : `${hardBlocked ? rawScore : globalScore} = ${formulaParts.join(" + ")}. Each term is the 1–5 dimension score times the share of the rubric you set.`;

  const confidence = scoreConfidence(jd, dimensions, workAuth.unresolved);
  const threshold = clamp(input.rubric.threshold, 1, 5);
  const recommendation = recommend(globalScore, threshold, input.rubric.considerGap, hardBlocked);
  const titleNote = describeTargetTitle(input.title || firstLine(jd), input.profile);

  return {
    globalScore,
    rawScore,
    threshold,
    recommendation: recommendation.recommendation,
    recommendationReason: hardBlocked
      ? `${recommendation.reason} A hard gate capped the score at ${cap} (raw weighted score ${rawScore}). ${hardBlockReasons.join(" ")}`
      : recommendation.reason,
    hardBlocked,
    hardBlockReasons,
    formula: hardBlocked ? `${formula} Hard gate then capped ${rawScore} to ${globalScore}.` : formula,
    dimensions,
    requirements,
    confidence: confidence.level,
    confidenceReasons: confidence.reasons,
    confidenceGaps: confidence.gaps,
    targetTitleNote: titleNote,
    salaryLabel: salary.label,
    detectedLocation: location.detected,
    detectedLevel: seniority.detected,
  };
}

function recommend(score: number, threshold: number, gap: number, hardBlocked: boolean): { recommendation: Recommendation; reason: string } {
  if (hardBlocked) {
    return {
      recommendation: "skip",
      reason: `The weighted score is ${score}, and a hard gate says not to apply.`,
    };
  }
  if (score >= threshold) {
    return {
      recommendation: "apply",
      reason: `${score} is at or above your apply line of ${threshold}. Worth a careful application, still drafted for you to send.`,
    };
  }
  const considerFloor = round1(threshold - Math.max(0, gap));
  if (score >= considerFloor) {
    return {
      recommendation: "consider",
      reason: `${score} is below your apply line of ${threshold} but inside the ${gap} consider band. Apply only if you have a specific reason.`,
    };
  }
  return {
    recommendation: "skip",
    reason: `${score} is below your apply line of ${threshold}. Saving the night is a valid outcome.`,
  };
}

function scoreConfidence(
  jd: string,
  dimensions: DimensionScore[],
  unresolvedAuth: boolean,
): { level: EvaluationResult["confidence"]; reasons: string[]; gaps: string[] } {
  const unknown = dimensions.filter((dimension) => dimension.evidence === "unknown");
  const partial = dimensions.filter((dimension) => dimension.evidence === "partial");
  const skills = dimensions.find((dimension) => dimension.key === "skills");
  const reasons: string[] = [];
  const gaps: string[] = [];
  if (jd.length < 80) reasons.push("The posting text is too short to judge.");
  if (skills?.evidence === "unknown") reasons.push("Skill evidence is missing.");
  if (unresolvedAuth) reasons.push("Work authorisation is unresolved.");
  if (unknown.length >= 2) reasons.push(`${unknown.length} dimensions have no usable evidence.`);
  unknown.forEach((dimension) => gaps.push(`Check ${dimension.label.toLowerCase()} before you rely on this score.`));
  partial.slice(0, 2).forEach((dimension) => gaps.push(`${dimension.label} is only partly supported.`));
  const low = jd.length < 80 || skills?.evidence === "unknown" || unresolvedAuth || unknown.length >= 2;
  if (low) return { level: "low", reasons, gaps: gaps.slice(0, 3) };
  if (unknown.length || partial.length) {
    return {
      level: "medium",
      reasons: reasons.length ? reasons : ["At least one dimension is partial or unknown."],
      gaps: gaps.slice(0, 3),
    };
  }
  return { level: "high", reasons: ["Every dimension has direct evidence in the posting or your profile."], gaps: [] };
}

function scoreRequirements(jd: string, profile: Profile, cv: MasterCv): RequirementScore[] {
  const extracted = extractRequirements(jd);
  const cvText = cvPlainText(cv);
  return extracted.slice(0, 16).map((requirement, index) => {
    const asked = findSkills(requirement.text);
    const foundInBullets = asked.filter((skill) => bulletsMention(cv, skill));
    const foundInSkills = asked.filter((skill) => cv.skills.some((item) => skillMentioned(item, skill) || skillMentioned(skill, item)));
    const found = new Set([...foundInBullets, ...foundInSkills]);
    const missing = asked.filter((skill) => !found.has(skill));
    const years = extractYears(requirement.text);
    let score = 3;
    const evidence: string[] = [];
    let explanation = "";

    if (asked.length) {
      if (missing.length === 0 && foundInBullets.length === asked.length) {
        score = 5;
        explanation = `Every asked skill (${asked.join(", ")}) shows up in a master CV bullet.`;
        evidence.push(...bulletEvidence(cv, asked));
      } else if (missing.length === 0) {
        score = 4;
        explanation = `The asked skills (${asked.join(", ")}) are on your skill list, but not all of them are in a bullet.`;
        evidence.push(`Skills: ${foundInSkills.join(", ")}`);
      } else if (found.size > 0) {
        score = 3;
        explanation = `Partial overlap. Found ${[...found].join(", ") || "nothing"}. Missing ${missing.join(", ")}.`;
        evidence.push(...bulletEvidence(cv, [...found]));
      } else {
        score = 1;
        explanation = `None of ${asked.join(", ")} appears in the master CV.`;
      }
    } else {
      const overlap = tokenOverlap(requirement.text, cvText);
      if (overlap >= 0.45) {
        score = 3;
        explanation = "No lexicon skill was named. The wording still overlaps your CV, so this is a partial match.";
      } else {
        score = 1;
        explanation = "No lexicon skill was named and the line does not overlap your CV.";
      }
    }

    if (years != null && profile.yearsExperience < years) {
      score = Math.min(score, 2);
      explanation += ` The line asks for ${years}+ years and the profile lists ${profile.yearsExperience}.`;
    } else if (years != null) {
      explanation += ` Years check passes: profile lists ${profile.yearsExperience} against ${years}+.`;
    }

    return {
      id: `req-${index + 1}`,
      text: requirement.text,
      importance: requirement.importance,
      importanceSource: requirement.importanceSource,
      importanceReason: requirement.importanceReason,
      score,
      explanation: explanation.trim(),
      evidence,
      askedSkills: asked,
      missingSkills: missing,
    };
  });
}

function scoreSkills(requirements: RequirementScore[], jd: string): Omit<DimensionScore, "weight" | "weightPercent" | "contribution"> & { key: WeightKey } {
  if (jd.trim().length < 80 || requirements.length === 0) {
    return base("skills", 3, "unknown", "There is not enough posting text to score skills. Paste the description.");
  }
  const weight = requirements.reduce((sum, requirement) => sum + requirement.importance, 0);
  const total = requirements.reduce((sum, requirement) => sum + requirement.score * requirement.importance, 0);
  const score = round1(total / weight);
  return base(
    "skills",
    score,
    "supported",
    `Importance-weighted average of ${requirements.length} requirements. A requirement's importance is 1–3 and is separate from the rubric weight on this dimension.`,
  );
}

function scoreSeniority(jd: string, profile: Profile): Omit<DimensionScore, "weight" | "weightPercent" | "contribution"> & { key: WeightKey; detected: string | null } {
  const level = detectSeniority(jd);
  const years = extractYears(jd);
  if (!level && years == null) {
    return { ...base("seniority", 3, "unknown", "The posting does not name a level or a years requirement."), detected: null };
  }
  let levelScore: number | null = null;
  if (level) {
    const distance = Math.abs(SENIORITY_RANK[profile.seniority] - level.rank);
    levelScore = distance === 0 ? 5 : distance === 1 ? 4 : distance === 2 ? 2 : 1;
  }
  let yearsScore: number | null = null;
  if (years != null) {
    const gap = years - profile.yearsExperience;
    yearsScore = gap <= 0 ? 5 : gap <= 1 ? 4 : gap <= 3 ? 3 : gap <= 5 ? 2 : 1;
  }
  const parts = [levelScore, yearsScore].filter((value): value is number => value != null);
  const score = Math.min(...parts);
  const explanation = [
    level ? `Posting level looks like ${level.id} (rank ${level.rank}); your profile is ${profile.seniority} (rank ${SENIORITY_RANK[profile.seniority]}).` : null,
    years != null ? `Years mentioned: ${years}+. Profile years: ${profile.yearsExperience}.` : null,
    "When both signals exist, the lower of the two is used so a title match cannot hide a years gap.",
  ]
    .filter(Boolean)
    .join(" ");
  return { ...base("seniority", score, "supported", explanation), detected: level?.id ?? null };
}

function scoreLocation(jd: string, profile: Profile): Omit<DimensionScore, "weight" | "weightPercent" | "contribution"> & { key: WeightKey; detected: string } {
  const read = readLocation(jd);
  const detected = read.summary;
  if (!read.remote && !read.hybrid && !read.onsite && read.countries.length === 0 && read.cities.length === 0) {
    return { ...base("location", 3, "unknown", "The posting does not say where the work happens."), detected };
  }
  const wants = new Set(profile.workModel);
  const countryHit = read.countries.some((country) => samePlace(country, profile.country) || profile.preferredCountries.some((item) => samePlace(item, country)));
  const cityHit = read.cities.some((city) => samePlace(city, profile.city) || profile.preferredCities.some((item) => samePlace(item, city)));
  const remoteRestricted = read.remote && read.countries.length > 0;
  if (read.remote && wants.has("remote")) {
    if (!remoteRestricted || countryHit || profile.willingToRelocate) {
      return {
        ...base("location", countryHit || !remoteRestricted ? 5 : 4, "supported", `Remote is offered${remoteRestricted ? ` with a country cue (${read.countries.join(", ")})` : ""}, and remote is in your work-model list.`),
        detected,
      };
    }
    return {
      ...base("location", 2, "supported", `Remote is restricted to ${read.countries.join(", ")}, which is outside your country list, and you are not marked willing to relocate.`),
      detected,
    };
  }
  if (cityHit && (wants.has("hybrid") || wants.has("onsite") || wants.has("remote"))) {
    return { ...base("location", 5, "supported", `A city in the posting matches your city or preferred cities (${read.cities.join(", ")}).`), detected };
  }
  if (countryHit && (read.hybrid || read.onsite) && (wants.has("hybrid") || wants.has("onsite"))) {
    return { ...base("location", 4, "supported", `The country matches and the onsite or hybrid model is one you accept.`), detected };
  }
  if (!countryHit && (read.onsite || read.hybrid) && !profile.willingToRelocate) {
    return { ...base("location", 1, "supported", `The posting looks tied to ${read.countries.join(", ") || "another place"} and relocation is off.`), detected };
  }
  return { ...base("location", 3, "partial", `Location signals (${detected}) only partly match ${profile.workModel.join(", ")} in ${profile.city || profile.country}.`), detected };
}

function scoreSalary(jd: string, profile: Profile): Omit<DimensionScore, "weight" | "weightPercent" | "contribution"> & { key: WeightKey; label: string } {
  const mention = chooseSalary(jd);
  if (!mention) {
    return { ...base("salary", 3, "unknown", "No salary figure was found. Missing pay is unknown, not a neutral endorsement."), label: "Not listed" };
  }
  const annualMin = annualize(mention.min, mention.period);
  const annualMax = annualize(mention.max, mention.period);
  const cadMin = toCad(annualMin, mention.currency);
  const cadMax = toCad(annualMax, mention.currency);
  const userMin = toCad(profile.salary.min, profile.salary.currency);
  const userMax = toCad(profile.salary.max, profile.salary.currency);
  const shown = `${mention.raw} (${mention.currency}, ${mention.period === "hour" ? "hourly, scored as ×2080" : "annual"})`;
  let score = 3;
  let explanation = "";
  if (cadMax < userMin) {
    const ratio = cadMax / userMin;
    score = ratio >= 0.9 ? 3 : ratio >= 0.75 ? 2 : 1;
    explanation = `Top of the posted range converts to about ${Math.round(fromCad(cadMax, profile.salary.currency)).toLocaleString("en-CA")} ${profile.salary.currency}, below your floor of ${profile.salary.min.toLocaleString("en-CA")}.`;
  } else if (cadMin >= userMin) {
    score = 5;
    explanation = `The posted range clears your floor of ${profile.salary.min.toLocaleString("en-CA")} ${profile.salary.currency}.`;
  } else {
    score = 4;
    explanation = `The ranges overlap, but the bottom of the posting is under your floor.`;
  }
  if (cadMin > userMax) explanation += " The posting sits above the top of your target range.";
  explanation += ` ${FX_NOTE}`;
  const evidence: EvidenceStatus = mention.period === "hour" ? "partial" : "supported";
  return { ...base("salary", score, evidence, explanation), label: shown };
}

function scoreWorkAuth(jd: string, profile: Profile): Omit<DimensionScore, "weight" | "weightPercent" | "contribution"> & {
  key: WeightKey;
  hardReasons: string[];
  unresolved: boolean;
} {
  const location = readLocation(jd);
  const signal = sponsorshipSignal(jd);
  const countries = location.countries.length ? location.countries : [];
  if (countries.length === 0) {
    return {
      ...base("workAuth", 3, "unknown", "No hiring country was detected, so work authorisation was not scored as a pass or a fail."),
      hardReasons: [],
      unresolved: false,
    };
  }
  const notes: string[] = [];
  const hardReasons: string[] = [];
  let worst = 5;
  let unresolved = false;
  for (const country of countries) {
    const entry = profile.workAuthorization.find((item) => samePlace(item.country, country));
    if (!entry) {
      worst = Math.min(worst, 2);
      unresolved = true;
      notes.push(`No authorisation on file for ${country}.`);
      continue;
    }
    if (entry.status === "citizen" || entry.status === "permanent_resident") {
      notes.push(`${country}: ${entry.status.replaceAll("_", " ")} on file.`);
      continue;
    }
    if (entry.status === "open_permit") {
      worst = Math.min(worst, 4);
      notes.push(`${country}: open permit. Confirm it covers this employer.`);
      continue;
    }
    if (entry.status === "needs_sponsorship" || entry.status === "other") {
      if (signal === "sponsors") {
        worst = Math.min(worst, 4);
        notes.push(`${country}: you may need sponsorship and the posting says sponsorship is available.`);
      } else if (signal === "no-sponsorship") {
        worst = 1;
        hardReasons.push(`${country}: you need sponsorship and the posting refuses it or requires existing authorisation.`);
        notes.push(hardReasons[hardReasons.length - 1]);
      } else {
        worst = Math.min(worst, 2);
        unresolved = true;
        notes.push(`${country}: you need sponsorship and the posting does not say whether it will sponsor.`);
      }
    }
  }
  const evidence: EvidenceStatus = unresolved ? "partial" : "supported";
  return { ...base("workAuth", worst, evidence, notes.join(" ")), hardReasons, unresolved };
}

function scoreCompany(
  jd: string,
  company: string,
  profile: Profile,
): Omit<DimensionScore, "weight" | "weightPercent" | "contribution"> & { key: WeightKey } {
  const hay = `${company}\n${jd.slice(0, 500)}`;
  const avoided = profile.avoidedCompanies.find((name) => name.trim() && includesLoose(hay, name));
  if (avoided) return base("company", 1, "supported", `“${avoided}” is on your avoid list.`);
  const preferred = profile.preferredCompanies.find((name) => name.trim() && includesLoose(hay, name));
  if (preferred) return base("company", 5, "supported", `“${preferred}” is on your preferred list.`);
  if (!company.trim()) return base("company", 3, "partial", "No company name was entered, and none of your lists matched the opening lines.");
  return base("company", 3, "supported", `${company} is neither preferred nor avoided. Neutral score of 3.`);
}

function scoreDealbreakers(jd: string, profile: Profile): Omit<DimensionScore, "weight" | "weightPercent" | "contribution"> & { key: WeightKey; hits: string[] } {
  const hits = profile.dealbreakers.map((item) => item.trim()).filter(Boolean).filter((phrase) => includesLoose(jd, phrase));
  if (!profile.dealbreakers.some((item) => item.trim())) {
    return { ...base("dealbreakers", 5, "supported", "You have not listed dealbreakers, so none were applied. The weight still shows in the formula."), hits: [] };
  }
  if (hits.length === 0) {
    return { ...base("dealbreakers", 5, "supported", `None of your ${profile.dealbreakers.length} dealbreaker phrases appear in the posting.`), hits: [] };
  }
  return {
    ...base("dealbreakers", 1, "supported", `Matched: ${hits.join("; ")}. If hard gates are on, this forces a skip and caps the global score.`),
    hits,
  };
}

function base(
  key: WeightKey,
  score: number,
  evidence: EvidenceStatus,
  explanation: string,
): Omit<DimensionScore, "weight" | "weightPercent" | "contribution"> {
  return { key, label: WEIGHT_LABELS[key], score: round1(clamp(score, 1, 5)), explanation, evidence };
}

function bulletsMention(cv: MasterCv, skill: string): boolean {
  return cv.roles.some((role) => role.bullets.some((bullet) => skillMentioned(bullet.text, skill))) || cv.proofPoints.some((proof) => skillMentioned(proof.text, skill));
}

function bulletEvidence(cv: MasterCv, skills: string[]): string[] {
  const lines: string[] = [];
  for (const role of cv.roles) {
    for (const bullet of role.bullets) {
      if (skills.some((skill) => skillMentioned(bullet.text, skill))) lines.push(bullet.text);
    }
  }
  return lines.slice(0, 3);
}

function tokenOverlap(requirement: string, cvText: string): number {
  const tokens = requirement.toLowerCase().match(/[a-z][a-z0-9+#.]{3,}/g) ?? [];
  if (!tokens.length) return 0;
  const hay = cvText.toLowerCase();
  const hit = tokens.filter((token) => hay.includes(token));
  return hit.length / tokens.length;
}

function samePlace(a: string, b: string): boolean {
  const left = a.toLowerCase().trim();
  const right = b.toLowerCase().trim();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function includesLoose(haystack: string, phrase: string): boolean {
  const needle = phrase.trim().toLowerCase();
  if (!needle) return false;
  return haystack.toLowerCase().includes(needle);
}

function firstLine(text: string): string {
  return text.split(/\n/).map((line) => line.trim()).find(Boolean) ?? "";
}

function describeTargetTitle(title: string, profile: Profile): string {
  if (!profile.targetTitles.length) return "You have not listed target titles.";
  const hit = profile.targetTitles.find((target) => {
    const tokens = target.toLowerCase().split(/\s+/).filter((token) => token.length > 3);
    const hay = title.toLowerCase();
    return tokens.length > 0 && tokens.filter((token) => hay.includes(token)).length >= Math.min(2, tokens.length);
  });
  return hit
    ? `The title overlaps your target “${hit}”. Target titles are shown here and are not a hidden eighth weight.`
    : `The title does not overlap your targets (${profile.targetTitles.join(", ")}). That note is visible and is not folded into the seven weights.`;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function defaultRubric(): Rubric {
  return {
    weights: {
      skills: 30,
      seniority: 15,
      location: 15,
      salary: 10,
      workAuth: 15,
      company: 10,
      dealbreakers: 5,
    },
    threshold: 4,
    considerGap: 0.5,
    dealbreakersAreHardGates: true,
    hardGateCap: 2,
  };
}
