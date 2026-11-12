import { describe, expect, it } from "vitest";
import { extractQuantities, parseSalaryMentions, quantitiesMatch } from "@/lib/currency";
import { extractRequirements } from "@/lib/extract";
import { parseJobBankHtml } from "@/lib/boards";
import { evaluateJob, defaultRubric } from "@/lib/scoring";
import type { MasterCv, Profile, Rubric } from "@/lib/types";

const cv: MasterCv = {
  summary: "Product engineer who ships reliable TypeScript systems with finance and support partners.",
  roles: [
    {
      id: "role-northwind",
      company: "Northwind Analytics",
      title: "Senior Product Engineer",
      location: "Toronto, Canada",
      start: "2022-03",
      end: null,
      bullets: [
        { id: "b-checkout", text: "Led the checkout reliability program, cutting failed payments by 18% across 2.4 million monthly transactions." },
        { id: "b-system", text: "Shipped a TypeScript design system used by 14 squads, reducing UI defects by 27%." },
        { id: "b-mentor", text: "Mentored 4 engineers and ran weekly incident reviews with support and finance partners." },
      ],
    },
    {
      id: "role-harbour",
      company: "Harbour & Co.",
      title: "Product Engineer",
      location: "Halifax, Canada",
      start: "2018-06",
      end: "2022-02",
      bullets: [
        { id: "b-warehouse", text: "Built an internal React and Node.js order tool that shortened warehouse pick time by 22%." },
        { id: "b-tests", text: "Introduced Playwright end-to-end tests covering 63 critical flows." },
      ],
    },
  ],
  education: [{ id: "edu-dal", school: "Dalhousie University", credential: "BSc Computer Science", year: "2018", details: "" }],
  skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "Playwright", "accessibility"],
  proofPoints: [],
};

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    fullName: "Avery Chen",
    headline: "Senior product engineer",
    email: "avery@example.com",
    phone: "",
    location: "Toronto, ON, Canada",
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    links: [],
    targetTitles: ["Senior Product Engineer"],
    seniority: "senior",
    yearsExperience: 8,
    workModel: ["remote", "hybrid"],
    willingToRelocate: false,
    preferredCities: ["Toronto", "Halifax"],
    preferredCountries: ["Canada"],
    workAuthorization: [
      { id: "auth-ca", country: "Canada", status: "permanent_resident", note: "" },
      { id: "auth-us", country: "United States", status: "needs_sponsorship", note: "" },
    ],
    salary: { currency: "CAD", min: 140000, max: 180000, period: "year" },
    preferredCompanies: ["Lumenfield"],
    avoidedCompanies: ["Polar Freight"],
    dealbreakers: ["clearance required"],
    noticePeriod: "4 weeks",
    ...overrides,
  };
}

const strongJd = `
Senior Product Engineer
Lumenfield — Toronto, Canada (hybrid) or remote within Canada
Salary: CAD 150,000 - 175,000 per year
You must be authorised to work in Canada. Permanent residents are welcome.

Requirements
- Must have 5+ years of TypeScript
- Required: React and Node.js
- PostgreSQL
Nice to have
- Kubernetes
`;

describe("requirement weights", () => {
  it("labels wording, structure, and estimates, and never puts an estimate in the top band", () => {
    const requirements = extractRequirements(strongJd);
    const typescript = requirements.find((item) => /typescript/i.test(item.text));
    const react = requirements.find((item) => /react/i.test(item.text));
    const postgres = requirements.find((item) => /postgresql/i.test(item.text));
    const kubernetes = requirements.find((item) => /kubernetes/i.test(item.text));
    expect(typescript).toMatchObject({ importance: 3, importanceSource: "jd-wording" });
    expect(react).toMatchObject({ importance: 3, importanceSource: "jd-wording" });
    expect(postgres).toMatchObject({ importance: 2, importanceSource: "jd-structure" });
    expect(kubernetes).toMatchObject({ importance: 1, importanceSource: "jd-structure" });
    expect(requirements.filter((item) => item.importanceSource === "estimate").every((item) => item.importance <= 2)).toBe(true);
    expect(requirements.some((item) => item.importanceSource === "estimate" && item.importance === 3)).toBe(false);
  });
});

describe("evaluateJob", () => {
  it("scores a close Canadian posting as an apply at the default 4.0 line", () => {
    const result = evaluateJob({ jd: strongJd, company: "Lumenfield", title: "Senior Product Engineer", profile: profile(), cv, rubric: defaultRubric() });
    expect(result.globalScore).toBeGreaterThanOrEqual(4);
    expect(result.recommendation).toBe("apply");
    expect(result.hardBlocked).toBe(false);
    expect(result.dimensions.find((dimension) => dimension.key === "company")?.score).toBe(5);
    expect(result.dimensions.find((dimension) => dimension.key === "location")?.score).toBeGreaterThanOrEqual(4);
    expect(result.dimensions.find((dimension) => dimension.key === "salary")?.score).toBeGreaterThanOrEqual(4);
    expect(result.formula).toContain("×");
    const kube = result.requirements.find((item) => /kubernetes/i.test(item.text));
    expect(kube?.score).toBe(1);
    expect(kube?.importanceReason.toLowerCase()).toContain("nice");
  });

  it("hard-blocks a US posting that refuses sponsorship when the profile needs it", () => {
    const jd = `
Staff Software Engineer
San Francisco, United States
Onsite
We are unable to sponsor visas. US citizens only.
Must have 5+ years of TypeScript
Salary: USD 200,000 - 240,000
`;
    const result = evaluateJob({
      jd,
      company: "Example",
      title: "Staff Software Engineer",
      profile: profile({ dealbreakers: [] }),
      cv,
      rubric: defaultRubric(),
    });
    expect(result.hardBlocked).toBe(true);
    expect(result.recommendation).toBe("skip");
    expect(result.dimensions.find((dimension) => dimension.key === "workAuth")?.score).toBe(1);
    expect(result.globalScore).toBeLessThanOrEqual(2);
    expect(result.rawScore).toBeGreaterThan(result.globalScore);
  });

  it("caps the score when a dealbreaker phrase is present", () => {
    const jd = `${strongJd}\nThis role requires a clearance required badge.`;
    const result = evaluateJob({ jd, company: "Lumenfield", title: "Senior Product Engineer", profile: profile(), cv, rubric: defaultRubric() });
    expect(result.hardBlocked).toBe(true);
    expect(result.hardBlockReasons.some((reason) => /clearance required/i.test(reason))).toBe(true);
    expect(result.globalScore).toBeLessThanOrEqual(2);
  });

  it("lets a higher skills weight lift a mixed score", () => {
    const jd = `
Senior Product Engineer
Remote within Canada
Must have 5+ years of TypeScript
Required: React and Node.js
PostgreSQL
Salary: CAD 80,000 - 90,000
`;
    const base = defaultRubric();
    const skillsHeavy: Rubric = { ...base, weights: { ...base.weights, skills: 70, salary: 5, seniority: 5, location: 5, workAuth: 5, company: 5, dealbreakers: 5 } };
    const salaryHeavy: Rubric = { ...base, weights: { ...base.weights, skills: 5, salary: 70, seniority: 5, location: 5, workAuth: 5, company: 5, dealbreakers: 5 } };
    const a = evaluateJob({ jd, company: "Other", title: "Senior Product Engineer", profile: profile({ preferredCompanies: [], dealbreakers: [] }), cv, rubric: skillsHeavy });
    const b = evaluateJob({ jd, company: "Other", title: "Senior Product Engineer", profile: profile({ preferredCompanies: [], dealbreakers: [] }), cv, rubric: salaryHeavy });
    expect(a.dimensions.find((dimension) => dimension.key === "skills")!.score).toBeGreaterThan(b.dimensions.find((dimension) => dimension.key === "salary")!.score);
    expect(a.globalScore).toBeGreaterThan(b.globalScore);
  });

  it("follows a user-set threshold instead of a fixed 4.0", () => {
    const jd = `
Product Engineer
Toronto, Canada hybrid
PostgreSQL
Salary: CAD 150,000 - 160,000
`;
    const rubric = defaultRubric();
    const result = evaluateJob({ jd, company: "Other", title: "Product Engineer", profile: profile({ dealbreakers: [], preferredCompanies: [] }), cv, rubric });
    const lenient = evaluateJob({
      jd,
      company: "Other",
      title: "Product Engineer",
      profile: profile({ dealbreakers: [], preferredCompanies: [] }),
      cv,
      rubric: { ...rubric, threshold: 1 },
    });
    const strict = evaluateJob({
      jd,
      company: "Other",
      title: "Product Engineer",
      profile: profile({ dealbreakers: [], preferredCompanies: [] }),
      cv,
      rubric: { ...rubric, threshold: 5, considerGap: 0 },
    });
    expect(lenient.recommendation).toBe("apply");
    expect(strict.recommendation).toBe("skip");
    expect(result.threshold).toBe(4);
  });

  it("lowers company score for an avoided employer", () => {
    const result = evaluateJob({ jd: strongJd, company: "Polar Freight", title: "Senior Product Engineer", profile: profile(), cv, rubric: defaultRubric() });
    expect(result.dimensions.find((dimension) => dimension.key === "company")?.score).toBe(1);
  });
});

describe("money parsing", () => {
  it("reads a CAD range and a k-suffix range", () => {
    expect(parseSalaryMentions("Salary: CAD 150,000 - 175,000 per year")[0]).toMatchObject({ currency: "CAD", min: 150000, max: 175000, period: "year" });
    expect(parseSalaryMentions("USD 160k-180k")[0]).toMatchObject({ currency: "USD", min: 160000, max: 180000 });
  });

  it("treats 2.4 million and $2.4M as the same quantity", () => {
    const million = extractQuantities("2.4 million monthly transactions")[0];
    const shorthand = extractQuantities("across $2.4M transactions")[0];
    expect(quantitiesMatch(shorthand, million)).toBe(true);
  });
});

describe("job bank parser", () => {
  it("reads a result card without keeping the session id", () => {
    const html = `<a href="/jobsearch/jobposting/50678526;jsessionid=ABC?source=searchresults" class="resultJobItem"><h3><span class="noctitle">software developer</span></h3><ul><li class="business">Corinex</li><li class="location">Vancouver (BC)</li><li class="salary">$96,000.00 to $100,000.00 annually</li><li class="date">November 06, 2026</li></ul></a>`;
    const jobs = parseJobBankHtml(html);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].url).toBe("https://www.jobbank.gc.ca/jobsearch/jobposting/50678526?source=searchresults");
    expect(jobs[0].company).toBe("Corinex");
    expect(jobs[0].title).toMatch(/software developer/i);
  });
});
