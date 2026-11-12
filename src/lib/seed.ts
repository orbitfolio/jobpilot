import { daysAgo, daysFromNow } from "@/lib/text";
import { defaultRubric, evaluateJob } from "@/lib/scoring";
import { tailorWithRules } from "@/lib/tailor";
import type { AppData, JobMatch, MasterCv, Profile } from "@/lib/types";

export const STRONG_SAMPLE = `Senior Product Engineer
Lumenfield — Toronto, Canada (hybrid) or remote within Canada
Salary: CAD 150,000 - 175,000 per year
You must be authorised to work in Canada. Permanent residents are welcome.

Requirements
- Must have 5+ years of TypeScript
- Required: React and Node.js
- PostgreSQL
- Stakeholder communication with finance or support partners
Nice to have
- Kubernetes
- French

About the role
You will own checkout reliability, design-system quality, and incident reviews. Hybrid in Toronto or remote inside Canada.`;

export const WEAK_SAMPLE = `Staff Machine Learning Engineer
San Francisco, United States — onsite
Salary: USD 90,000
We are unable to sponsor visas. US citizens only. Clearance required.

Requirements
- Must have 10+ years of machine learning
- Required: PyTorch and Kubernetes
- PhD preferred

This role is onsite five days a week.`;

export function sampleProfile(): Profile {
  return {
    fullName: "Avery Chen",
    headline: "Senior product engineer",
    email: "avery.chen@example.com",
    phone: "+1 416 555 0148",
    location: "Toronto, ON, Canada",
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    links: [{ label: "Portfolio", url: "https://example.com/avery" }],
    targetTitles: ["Senior Product Engineer", "Senior Software Engineer"],
    seniority: "senior",
    yearsExperience: 8,
    workModel: ["remote", "hybrid"],
    willingToRelocate: false,
    preferredCities: ["Toronto", "Halifax"],
    preferredCountries: ["Canada"],
    workAuthorization: [
      { id: "auth-ca", country: "Canada", status: "permanent_resident", note: "No sponsorship needed in Canada." },
      { id: "auth-us", country: "United States", status: "needs_sponsorship", note: "Would need a new visa." },
    ],
    salary: { currency: "CAD", min: 140000, max: 180000, period: "year" },
    preferredCompanies: ["Lumenfield", "Cohere", "Wealthsimple"],
    avoidedCompanies: ["Polar Freight"],
    dealbreakers: ["clearance required", "unpaid trial"],
    noticePeriod: "4 weeks",
  };
}

export function sampleCv(): MasterCv {
  return {
    summary: "Product engineer who ships reliable TypeScript systems with finance, support, and merchandising partners.",
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
          { id: "b-french", text: "Partnered with merchandising to launch a bilingual English and French catalog for Canadian stores." },
        ],
      },
    ],
    education: [
      { id: "edu-dal", school: "Dalhousie University", credential: "BSc Computer Science", year: "2018", details: "Halifax, Canada" },
    ],
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "Next.js", "Playwright", "accessibility", "Figma", "French", "incident response"],
    proofPoints: [
      { id: "proof-talk", text: "Gave a community talk, Boring reliability, about the checkout program in 2024." },
    ],
  };
}

export function buildSeed(now = new Date()): AppData {
  const profile = sampleProfile();
  const cv = sampleCv();
  const rubric = defaultRubric();
  const result = evaluateJob({
    jd: STRONG_SAMPLE,
    company: "Lumenfield",
    title: "Senior Product Engineer",
    profile,
    cv,
    rubric,
  });
  const tailored = tailorWithRules({
    jd: STRONG_SAMPLE,
    company: "Lumenfield",
    title: "Senior Product Engineer",
    profile,
    cv,
    contactName: "Sam Patel",
    contactRole: "Hiring manager",
  });
  const created = daysAgo(12, now);
  const matches: JobMatch[] = [
    {
      id: "match-sample-1",
      searchId: "search-canada",
      sourceId: "source-jobbank",
      sourceName: "Job Bank Canada",
      sourceKind: "jobbank",
      externalId: "sample-corinex",
      title: "Software developer",
      company: "Harbour Sample Co.",
      location: "Toronto, ON",
      url: "",
      description: "Sample inbox row so the desk is not empty before the first live scan. Paste a real Job Bank URL when you want a liveness check.",
      salaryLabel: "CAD 120,000 - 140,000",
      postedAt: daysAgo(2, now),
      foundAt: daysAgo(1, now),
      status: "new",
    },
    {
      id: "match-sample-2",
      searchId: "search-canada",
      sourceId: "source-cohere",
      sourceName: "Cohere",
      sourceKind: "ashby",
      externalId: "sample-cohere",
      title: "Senior Full-Stack Engineer",
      company: "Cohere",
      location: "Toronto, Canada",
      url: "https://jobs.ashbyhq.com/cohere",
      description: "Sample match. Run Scan now to replace this with live Ashby, Greenhouse, and Job Bank rows.",
      salaryLabel: "",
      postedAt: daysAgo(4, now),
      foundAt: daysAgo(1, now),
      status: "new",
    },
  ];

  return {
    version: 1,
    updatedAt: now.toISOString(),
    profile,
    cv,
    rubric,
    settings: {
      autoScanOnOpen: true,
      browserNotifications: false,
      followUpDays: 7,
      digestEnabled: false,
      digestWebhookUrl: "",
    },
    sources: [
      { id: "source-cohere", name: "Cohere", kind: "ashby", token: "cohere", country: "Canada", industry: "AI", keywords: ["engineer"], location: "Canada", enabled: true, workday: null, notes: "Public Ashby board." },
      { id: "source-wealthsimple", name: "Wealthsimple", kind: "ashby", token: "wealthsimple", country: "Canada", industry: "Fintech", keywords: ["engineer"], location: "Canada", enabled: true, workday: null, notes: "Public Ashby board." },
      { id: "source-gitlab", name: "GitLab", kind: "greenhouse", token: "gitlab", country: "Remote", industry: "Software", keywords: ["engineer"], location: "", enabled: true, workday: null, notes: "Public Greenhouse board. Add your own companies the same way." },
      { id: "source-jobbank", name: "Job Bank Canada", kind: "jobbank", token: "jobbank", country: "Canada", industry: "Any", keywords: ["software developer"], location: "Toronto, ON", enabled: true, workday: null, notes: "Public search page. Titles come back from the search; open a posting to score the full text." },
      { id: "source-indeed", name: "Indeed Canada", kind: "indeed", token: "indeed-ca", country: "Canada", industry: "Any", keywords: ["product engineer"], location: "Canada", enabled: true, workday: null, notes: "No public JSON API. The scan keeps the search and asks you to paste the posting." },
      { id: "source-smart", name: "SmartRecruiters example", kind: "smartrecruiters", token: "smartrecruiters", country: "Various", industry: "Software", keywords: ["engineer"], location: "", enabled: false, workday: null, notes: "Turn on to try the public SmartRecruiters postings API. Swap the token for a company identifier." },
    ],
    searches: [
      {
        id: "search-canada",
        name: "Engineering roles, Canada-friendly boards",
        keywords: ["engineer"],
        location: "",
        country: "Canada",
        sourceIds: [],
        enabled: true,
        createdAt: created,
      },
    ],
    matches,
    evaluations: [
      {
        id: "eval-lumenfield",
        createdAt: created,
        updatedAt: daysAgo(6, now),
        company: "Lumenfield",
        title: "Senior Product Engineer",
        location: "Toronto, Canada",
        url: "",
        rawText: STRONG_SAMPLE,
        liveness: null,
        result,
        tailored,
        applicationId: "app-lumenfield",
        userOverride: null,
      },
    ],
    applications: [
      {
        id: "app-lumenfield",
        evaluationId: "eval-lumenfield",
        company: "Lumenfield",
        title: "Senior Product Engineer",
        url: "",
        source: "Referral",
        location: "Toronto, Canada",
        salaryLabel: result.salaryLabel,
        score: result.globalScore,
        stage: "interviewing",
        appliedAt: daysAgo(10, now),
        followUpAt: daysFromNow(3, now),
        createdAt: created,
        updatedAt: daysAgo(2, now),
        notes: [{ id: "note-lum-1", at: daysAgo(2, now), text: "Recruiter screen done. Hiring manager conversation is next week." }],
        contacts: [{ id: "contact-sam", name: "Sam Patel", role: "Hiring manager", url: "", note: tailored.contact.claim.text }],
        rejectionReason: "",
        followUpDraft: tailored.followUpDraft,
      },
      {
        id: "app-maple",
        evaluationId: null,
        company: "Maple Ledger",
        title: "Senior Software Engineer",
        url: "",
        source: "Job Bank Canada",
        location: "Toronto, ON",
        salaryLabel: "CAD 145,000 - 165,000",
        score: 4.2,
        stage: "applied",
        appliedAt: daysAgo(8, now),
        followUpAt: daysAgo(1, now),
        createdAt: daysAgo(9, now),
        updatedAt: daysAgo(8, now),
        notes: [{ id: "note-maple", at: daysAgo(8, now), text: "Applied on the company site. No reply yet." }],
        contacts: [],
        rejectionReason: "",
        followUpDraft: "Hello, I applied for the Senior Software Engineer role last week and remain interested. Happy to share anything else you need.",
      },
      {
        id: "app-cedar",
        evaluationId: null,
        company: "Cedar Health",
        title: "Engineering Manager",
        url: "",
        source: "Greenhouse",
        location: "Vancouver, BC",
        salaryLabel: "CAD 160,000 - 190,000",
        score: 3.2,
        stage: "rejected",
        appliedAt: daysAgo(30, now),
        followUpAt: null,
        createdAt: daysAgo(40, now),
        updatedAt: daysAgo(18, now),
        notes: [],
        contacts: [],
        rejectionReason: "Asked for 10 years of people management",
        followUpDraft: "",
      },
      {
        id: "app-polar",
        evaluationId: null,
        company: "Polar Freight",
        title: "Senior Product Engineer",
        url: "",
        source: "Indeed Canada",
        location: "Mississauga, ON",
        salaryLabel: "Not listed",
        score: 4.1,
        stage: "ghosted",
        appliedAt: daysAgo(28, now),
        followUpAt: null,
        createdAt: daysAgo(28, now),
        updatedAt: daysAgo(7, now),
        notes: [{ id: "note-polar", at: daysAgo(7, now), text: "Two follow-ups, no reply. Marked ghosted." }],
        contacts: [],
        rejectionReason: "Silence after two follow-ups",
        followUpDraft: "",
      },
      {
        id: "app-kinship",
        evaluationId: null,
        company: "Kinship Mutual",
        title: "Senior Product Engineer",
        url: "",
        source: "Ashby",
        location: "Remote, Canada",
        salaryLabel: "CAD 150,000 - 170,000",
        score: 4.4,
        stage: "offer",
        appliedAt: daysAgo(45, now),
        followUpAt: null,
        createdAt: daysAgo(50, now),
        updatedAt: daysAgo(1, now),
        notes: [{ id: "note-kin", at: daysAgo(1, now), text: "Verbal offer. Waiting on the written base, bonus, and vacation." }],
        contacts: [],
        rejectionReason: "",
        followUpDraft: "",
      },
      {
        id: "app-bright",
        evaluationId: null,
        company: "Bright Dock",
        title: "Product Engineer",
        url: "",
        source: "Lever",
        location: "Halifax, NS",
        salaryLabel: "CAD 110,000 - 130,000",
        score: 3.6,
        stage: "saved",
        appliedAt: null,
        followUpAt: null,
        createdAt: daysAgo(3, now),
        updatedAt: daysAgo(3, now),
        notes: [{ id: "note-bright", at: daysAgo(3, now), text: "Below the salary floor. Saved in case the range was incomplete." }],
        contacts: [],
        rejectionReason: "",
        followUpDraft: "",
      },
    ],
    stories: [
      {
        id: "story-checkout",
        title: "Checkout reliability",
        situation: "Failed payments were climbing on the monthly checkout volume at Northwind Analytics.",
        task: "I was asked to lead a reliability program with finance and support in the room.",
        action: "I led the checkout reliability program and ran weekly incident reviews with those partners.",
        result: "Failed payments fell by 18% across 2.4 million monthly transactions.",
        reflection: "The number only belongs in an interview if I keep the source bullet next to it.",
        sourceIds: ["b-checkout", "b-mentor"],
        tags: ["reliability", "typescript", "stakeholders"],
      },
      {
        id: "story-warehouse",
        title: "Warehouse order tool",
        situation: "Harbour & Co. pickers were losing time in a paper order flow.",
        task: "Build an internal tool the warehouse would actually use.",
        action: "I built a React and Node.js order tool and covered the critical flows with Playwright.",
        result: "Warehouse pick time shortened by 22%, with 63 critical flows under test.",
        reflection: "Two results, two bullets. I do not blend them into a new metric.",
        sourceIds: ["b-warehouse", "b-tests"],
        tags: ["react", "node.js"],
      },
    ],
    practice: [],
    offers: [
      {
        id: "offer-kinship",
        applicationId: "app-kinship",
        company: "Kinship Mutual",
        role: "Senior Product Engineer",
        currency: "CAD",
        desiredMin: 140000,
        desiredMax: 180000,
        advertisedMin: 150000,
        advertisedMax: 170000,
        actualBase: 155000,
        bonus: "10% target, paid annually",
        equity: "None mentioned",
        notes: "Ask whether the bonus is guaranteed or discretionary, and how many vacation days sit outside the base.",
        lawyerQuestions: [
          "Is the bonus discretionary or contractual?",
          "What happens to vacation and bonus if the role ends during probation?",
          "Who owns work done before the start date?",
        ],
        updatedAt: daysAgo(1, now),
      },
    ],
    lastScanAt: now.toISOString(),
    lastScanNote: "Demo data is loaded. Scan now to pull live boards.",
  };
}

export function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AppData>;
  return record.version === 1 && Boolean(record.profile && record.cv && record.rubric && Array.isArray(record.applications));
}
