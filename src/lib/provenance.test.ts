import { describe, expect, it } from "vitest";
import { sampleCv, sampleProfile, STRONG_SAMPLE } from "@/lib/seed";
import { claimsInPack, exportBlocked, reviewClaim } from "@/lib/provenance";
import { tailorWithRules } from "@/lib/tailor";
import type { Claim, MasterCv, Profile, SourceLine } from "@/lib/types";

const sources: SourceLine[] = [
  { id: "b-checkout", label: "bullet", text: "Led the checkout reliability program, cutting failed payments by 18% across 2.4 million monthly transactions." },
  { id: "b-system", label: "bullet", text: "Shipped a TypeScript design system used by 14 squads, reducing UI defects by 27%." },
  { id: "summary", label: "summary", text: "Product engineer who ships reliable TypeScript systems with finance and support partners." },
];

function claim(partial: Partial<Claim> & Pick<Claim, "text" | "sourceIds" | "kind">): Claim {
  return {
    id: "c1",
    userApproved: false,
    status: "supported",
    reasons: [],
    ...partial,
  };
}

describe("claim provenance", () => {
  it("accepts a bullet copied from its cited source", () => {
    const review = reviewClaim(claim({ kind: "cv-bullet", text: sources[0].text, sourceIds: ["b-checkout"] }), sources);
    expect(review.status).toBe("supported");
    expect(review.reasons).toEqual([]);
  });

  it("blocks a number that is not in the cited line", () => {
    const review = reviewClaim(
      claim({ kind: "cv-bullet", text: "Led the checkout reliability program, cutting failed payments by 19% across 2.4 million monthly transactions.", sourceIds: ["b-checkout"] }),
      sources,
    );
    expect(review.status).toBe("unsupported");
    expect(review.missingNumbers.join(" ")).toMatch(/19/);
  });

  it("accepts $2.4M when the source says 2.4 million", () => {
    const review = reviewClaim(
      claim({ kind: "cv-bullet", text: "Checkout reliability program across $2.4M monthly transactions, cutting failed payments by 18%.", sourceIds: ["b-checkout"] }),
      sources,
    );
    expect(review.missingNumbers).toEqual([]);
    expect(review.status).toBe("supported");
  });

  it("blocks a tool that never appears in the cited line", () => {
    const review = reviewClaim(
      claim({ kind: "cv-bullet", text: "Led the checkout reliability program with Kubernetes, cutting failed payments by 18% across 2.4 million monthly transactions.", sourceIds: ["b-checkout"] }),
      sources,
    );
    expect(review.status).toBe("unsupported");
    expect(review.ungroundedTokens).toContain("kubernetes");
  });

  it("accepts a light reword that keeps the source facts", () => {
    const review = reviewClaim(
      claim({ kind: "cv-bullet", text: "Led a checkout reliability program.", sourceIds: ["b-checkout"] }),
      sources,
    );
    expect(review.status).toBe("supported");
  });

  it("does not let a cover letter borrow a metric that only appears in the job description", () => {
    const review = reviewClaim(
      claim({ kind: "cover", text: "I cut failed payments by 40% in a checkout reliability program.", sourceIds: ["b-checkout"] }),
      sources,
      "The team wants someone who improved conversion by 40%.",
    );
    expect(review.status).toBe("unsupported");
    expect(review.missingNumbers.join(" ")).toMatch(/40/);
  });

  it("rejects a citation that does not exist", () => {
    const review = reviewClaim(claim({ kind: "cv-bullet", text: "Led the checkout reliability program.", sourceIds: ["missing"] }), sources);
    expect(review.status).toBe("unsupported");
    expect(review.reasons.join(" ")).toMatch(/Unknown source/);
  });

  it("lets an explicit approval through the export gate and still records the mismatch", () => {
    const reviewed = reviewClaim(
      claim({ kind: "cv-bullet", text: "Reduced infrastructure cost by 42% using Kubernetes.", sourceIds: ["b-checkout"], userApproved: true }),
      sources,
    );
    expect(reviewed.status).toBe("approved");
    expect(reviewed.reasons.join(" ")).toMatch(/Approved by you/);
    const blocked = exportBlocked([
      claim({ kind: "cv-bullet", text: "Reduced infrastructure cost by 42% using Kubernetes.", sourceIds: ["b-checkout"], status: "unsupported" }),
    ]);
    expect(blocked.blocked).toBe(true);
    const allowed = exportBlocked([
      claim({ kind: "cv-bullet", text: "Reduced infrastructure cost by 42% using Kubernetes.", sourceIds: ["b-checkout"], status: "approved" }),
    ]);
    expect(allowed.blocked).toBe(false);
  });
});

describe("rule-based tailor", () => {
  it("produces a pack whose claims all cite real lines and pass the checker", () => {
    const profile: Profile = {
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
      workModel: ["remote"],
      willingToRelocate: false,
      preferredCities: ["Toronto"],
      preferredCountries: ["Canada"],
      workAuthorization: [{ id: "auth-ca", country: "Canada", status: "permanent_resident", note: "No sponsorship needed in Canada." }],
      salary: { currency: "CAD", min: 140000, max: 180000, period: "year" },
      preferredCompanies: [],
      avoidedCompanies: [],
      dealbreakers: [],
      noticePeriod: "4 weeks",
    };
    const cv: MasterCv = {
      summary: "Product engineer who ships reliable TypeScript systems with finance and support partners.",
      roles: [
        {
          id: "role-northwind",
          company: "Northwind Analytics",
          title: "Senior Product Engineer",
          location: "Toronto",
          start: "2022-03",
          end: null,
          bullets: [
            { id: "b-checkout", text: "Led the checkout reliability program, cutting failed payments by 18% across 2.4 million monthly transactions." },
            { id: "b-system", text: "Shipped a TypeScript design system used by 14 squads, reducing UI defects by 27%." },
          ],
        },
      ],
      education: [],
      skills: ["TypeScript", "React"],
      proofPoints: [],
    };
    const pack = tailorWithRules({
      jd: "Senior Product Engineer in Toronto. Must have TypeScript and React. Salary CAD 150,000 - 170,000.",
      company: "Lumenfield",
      title: "Senior Product Engineer",
      profile,
      cv,
      contactName: "Sam Patel",
    });
    const blocked = exportBlocked(claimsInPack(pack));
    expect(blocked.blocked).toBe(false);
    expect(pack.contact.claim.text.length).toBeLessThanOrEqual(300);
    expect(pack.roles[0].claims.every((item) => item.sourceIds.length > 0)).toBe(true);
  });

  it("lets the demo posting export without an approval", () => {
    const pack = tailorWithRules({
      jd: STRONG_SAMPLE,
      company: "Lumenfield",
      title: "Senior Product Engineer",
      profile: sampleProfile(),
      cv: sampleCv(),
    });
    const blocked = exportBlocked(claimsInPack(pack));
    expect(blocked.claims.map((claim) => `${claim.kind}: ${claim.reasons.join(" ")}`)).toEqual([]);
  });
});
