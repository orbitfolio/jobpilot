import type { ImportanceSource, Seniority } from "@/lib/types";
import { includesPhrase, normalizeSpace } from "@/lib/text";

export const SKILL_LEXICON = [
  "product management",
  "project management",
  "stakeholder management",
  "people management",
  "customer success",
  "account management",
  "user research",
  "machine learning",
  "incident response",
  "system design",
  "end-to-end",
  "react native",
  "node.js",
  "next.js",
  "postgresql",
  "typescript",
  "javascript",
  "kubernetes",
  "terraform",
  "playwright",
  "accessibility",
  "power bi",
  "google analytics",
  "salesforce",
  "microservices",
  "experimentation",
  "bilingual",
  "french",
  "english",
  "spanish",
  "python",
  "kotlin",
  "golang",
  "rust",
  "java",
  "scala",
  "ruby",
  "rails",
  "php",
  "laravel",
  "django",
  "flask",
  "fastapi",
  "spring",
  "react",
  "vue",
  "angular",
  "svelte",
  "redux",
  "graphql",
  "docker",
  "aws",
  "gcp",
  "azure",
  "linux",
  "sql",
  "nosql",
  "mysql",
  "mongodb",
  "redis",
  "kafka",
  "spark",
  "snowflake",
  "bigquery",
  "airflow",
  "figma",
  "jira",
  "agile",
  "scrum",
  "tableau",
  "excel",
  "sap",
  "autocad",
  "revit",
  "nursing",
  "clinical",
  "accounting",
  "gaap",
  "ifrs",
  "cpa",
  "pmp",
  "seo",
  "pytorch",
  "tensorflow",
  "devops",
  "github",
  "gitlab",
  "android",
  "swift",
  "flutter",
  "elixir",
  "graphql",
  "postgres",
  "nodejs",
  "k8s",
].sort((a, b) => b.length - a.length);

const ALIASES: Record<string, string[]> = {
  postgresql: ["postgresql", "postgres"],
  "node.js": ["node.js", "nodejs", "node"],
  react: ["react", "reactjs", "react.js"],
  kubernetes: ["kubernetes", "k8s"],
  typescript: ["typescript"],
  javascript: ["javascript"],
  "next.js": ["next.js", "nextjs"],
};

export interface ExtractedRequirement {
  text: string;
  importance: 1 | 2 | 3;
  importanceSource: ImportanceSource;
  importanceReason: string;
}

type SectionName = "requirements" | "nice" | "other";

const REQUIREMENT_HEADING =
  /^(requirements|qualifications|what you(?:'|’)ll need|what you bring|minimum qualifications|must have|required|your background)\s*:?\s*$/i;
const NICE_HEADING = /^(nice to have|nice-to-have|preferred|bonus|plus|good to have|assets)\s*:?\s*$/i;
const OTHER_HEADING =
  /^(responsibilities|about|who we are|what you(?:'|’)ll do|the role|about the role|benefits|our team)\s*:?\s*$/i;

export function extractRequirements(jd: string): ExtractedRequirement[] {
  const lines = jd.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let section: SectionName = "other";
  const found: ExtractedRequirement[] = [];

  for (const line of lines) {
    const heading = line.replace(/[:#*-]+$/g, "").trim();
    if (isHeading(heading)) {
      if (NICE_HEADING.test(heading)) section = "nice";
      else if (REQUIREMENT_HEADING.test(heading)) section = "requirements";
      else if (OTHER_HEADING.test(heading)) section = "other";
      continue;
    }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)/);
    const text = normalizeSpace(bullet ? bullet[1] : line);
    const keep =
      Boolean(bullet) ||
      (section !== "other" && text.length > 12) ||
      /\b(must|required|at least)\b/i.test(text);
    if (!keep || text.length < 3) continue;
    if (isHeading(text)) continue;
    found.push(classify(text, section));
  }

  const unique = dedupe(found);
  if (unique.length >= 2) return unique;

  const inferred = inferFromLexicon(jd, unique);
  return dedupe([...unique, ...inferred]);
}

function isHeading(line: string): boolean {
  if (line.length > 60) return false;
  return REQUIREMENT_HEADING.test(line) || NICE_HEADING.test(line) || OTHER_HEADING.test(line);
}

function classify(text: string, section: SectionName): ExtractedRequirement {
  if (section === "nice") {
    return {
      text,
      importance: 1,
      importanceSource: "jd-structure",
      importanceReason:
        "This line sits under a nice-to-have or preferred heading, so the structure of the posting puts it in the lowest band.",
    };
  }
  if (/\b(must|required|minimum|at least)\b/i.test(text)) {
    return {
      text,
      importance: 3,
      importanceSource: "jd-wording",
      importanceReason:
        "The line itself uses required language (must, required, minimum, or at least), so the weight comes from the posting's wording and can be top band.",
    };
  }
  if (section === "requirements") {
    return {
      text,
      importance: 2,
      importanceSource: "jd-structure",
      importanceReason:
        "The line is under a requirements heading, but it does not use explicit required language, so the weight comes from the posting's structure rather than a top-band wording cue.",
    };
  }
  return {
    text,
    importance: 2,
    importanceSource: "estimate",
    importanceReason:
      "This item was inferred because the posting did not label it. Estimates are capped below the top band.",
  };
}

function inferFromLexicon(jd: string, existing: ExtractedRequirement[]): ExtractedRequirement[] {
  const covered = existing.map((item) => item.text.toLowerCase()).join(" ");
  const inferred: ExtractedRequirement[] = [];
  for (const skill of findSkills(jd)) {
    if (covered.includes(skill.toLowerCase())) continue;
    inferred.push({
      text: skill,
      importance: 2,
      importanceSource: "estimate",
      importanceReason: `“${skill}” appears in the posting but not in a labelled requirement. Estimated importance is capped at 2, never top band.`,
    });
    if (inferred.length >= 8) break;
  }
  return inferred;
}

function dedupe(items: ExtractedRequirement[]): ExtractedRequirement[] {
  const seen = new Set<string>();
  const result: ExtractedRequirement[] = [];
  for (const item of items) {
    const key = item.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function findSkills(text: string): string[] {
  const found: string[] = [];
  for (const skill of SKILL_LEXICON) {
    if (skillMentioned(text, skill) && !found.some((item) => aliasesOf(item).some((alias) => aliasesOf(skill).includes(alias)))) {
      found.push(canonicalSkill(skill));
    }
  }
  return found;
}

export function skillMentioned(text: string, skill: string): boolean {
  return aliasesOf(skill).some((alias) => includesPhrase(text, alias));
}

export function canonicalSkill(skill: string): string {
  const flat = skill.toLowerCase();
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(flat) || canonical === flat) return canonical;
  }
  return flat;
}

function aliasesOf(skill: string): string[] {
  const canonical = canonicalSkill(skill);
  return ALIASES[canonical] ?? [canonical];
}

export function extractYears(text: string): number | null {
  const matches = [...text.matchAll(/\b(\d{1,2})\s*\+?\s*(?:years|yrs)\b/gi)];
  const values = matches.map((match) => Number(match[1])).filter((value) => value > 0 && value <= 25);
  if (!values.length) return null;
  return Math.max(...values);
}

const LEVELS: { id: Seniority; rank: number; re: RegExp }[] = [
  { id: "director", rank: 7, re: /\bdirector\b/i },
  { id: "principal", rank: 6, re: /\bprincipal\b/i },
  { id: "staff", rank: 5, re: /\bstaff\b/i },
  { id: "lead", rank: 4, re: /\b(lead|team lead)\b/i },
  { id: "senior", rank: 3, re: /\b(senior|sr\.?)\b/i },
  { id: "mid", rank: 2, re: /\b(mid[- ]level|intermediate)\b/i },
  { id: "junior", rank: 1, re: /\b(junior|jr\.?|entry[- ]level|new grad)\b/i },
  { id: "intern", rank: 0, re: /\bintern(ship)?\b/i },
];

export const SENIORITY_RANK: Record<Seniority, number> = {
  intern: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  staff: 5,
  principal: 6,
  director: 7,
};

export function detectSeniority(text: string): { id: Seniority; rank: number } | null {
  for (const level of LEVELS) {
    if (level.re.test(text)) return { id: level.id, rank: level.rank };
  }
  return null;
}

export interface LocationRead {
  remote: boolean;
  hybrid: boolean;
  onsite: boolean;
  countries: string[];
  cities: string[];
  summary: string;
}

const COUNTRY_RULES: { name: string; re: RegExp }[] = [
  { name: "Canada", re: /\b(canada|canadian|ontario|toronto|vancouver|montr[eé]al|montreal|calgary|ottawa|halifax|british columbia|quebec|alberta)\b/i },
  { name: "United States", re: /\b(united states|u\.s\.a\.?|usa|u\.s\.|san francisco|new york|seattle|austin|boston|us citizen|us work)\b/i },
  { name: "United Kingdom", re: /\b(united kingdom|u\.k\.|uk|london|england|scotland|wales)\b/i },
  { name: "Germany", re: /\b(germany|berlin|munich|deutschland)\b/i },
  { name: "France", re: /\b(france|paris)\b/i },
  { name: "India", re: /\b(india|bengaluru|bangalore|hyderabad)\b/i },
  { name: "Australia", re: /\b(australia|sydney|melbourne)\b/i },
];

const CITY_RULES = ["Toronto", "Vancouver", "Montreal", "Montréal", "Calgary", "Ottawa", "Halifax", "San Francisco", "New York", "Seattle", "London", "Berlin", "Paris"];

export function readLocation(text: string): LocationRead {
  const remote = /\bremote\b/i.test(text) && !/\bno remote\b/i.test(text);
  const hybrid = /\bhybrid\b/i.test(text);
  const onsite = /\bon-?site\b|\bin[- ]office\b|\bin office\b/i.test(text);
  const countries = COUNTRY_RULES.filter((country) => country.re.test(text)).map((country) => country.name);
  const cities = CITY_RULES.filter((city) => includesPhrase(text, city));
  const bits = [
    remote ? "remote" : null,
    hybrid ? "hybrid" : null,
    onsite ? "onsite" : null,
    ...cities,
    ...countries,
  ].filter(Boolean);
  return {
    remote,
    hybrid,
    onsite,
    countries,
    cities,
    summary: bits.length ? bits.join(", ") : "not stated",
  };
}

export function sponsorshipSignal(text: string): "sponsors" | "no-sponsorship" | "unknown" {
  const sponsors = /visa sponsorship available|will sponsor|sponsorship is available|we sponsor|sponsorship available/i.test(text);
  const refuses =
    /no sponsorship|cannot sponsor|unable to sponsor|without sponsorship|not able to sponsor|won'?t sponsor|will not sponsor|citizens only|must be a citizen|no visa|must be authorized to work|must be authorised to work|must have (?:existing |unrestricted )?work authorization|must have (?:existing |unrestricted )?work authorisation/i.test(
      text,
    );
  if (refuses && !sponsors) return "no-sponsorship";
  if (sponsors && !refuses) return "sponsors";
  if (sponsors && refuses) return "unknown";
  return "unknown";
}
