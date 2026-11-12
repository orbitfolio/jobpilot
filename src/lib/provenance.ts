import { extractQuantities, quantitiesMatch, type Quantity } from "@/lib/currency";
import { contentTokens, COVER_GLUE, stem } from "@/lib/text";
import type { Claim, ClaimKind, ClaimStatus, SourceLine, TailoredPack } from "@/lib/types";

export interface ClaimReview {
  status: ClaimStatus;
  reasons: string[];
  ungroundedTokens: string[];
  missingNumbers: string[];
}

export function reviewClaim(claim: Pick<Claim, "text" | "sourceIds" | "kind" | "userApproved">, sources: SourceLine[], contextText = ""): ClaimReview {
  const reasons: string[] = [];
  const cited = claim.sourceIds.map((id) => sources.find((source) => source.id === id));
  const missingIds = claim.sourceIds.filter((id, index) => !cited[index]);
  if (claim.sourceIds.length === 0) reasons.push("No source line is cited.");
  if (missingIds.length) reasons.push(`Unknown source id: ${missingIds.join(", ")}.`);
  const citedText = cited.filter((line): line is SourceLine => Boolean(line)).map((line) => line.text).join("\n");
  const missingNumbers = unmatchedQuantities(claim.text, citedText);
  if (missingNumbers.length) {
    reasons.push(`Number ${missingNumbers.map((item) => item.raw).join(", ")} is not in the cited source lines.`);
  }
  const extraStop = claim.kind === "cv-bullet" || claim.kind === "summary" ? new Set<string>() : COVER_GLUE;
  const tokens = contentTokens(claim.text, extraStop);
  const groundingHay = claim.kind === "cv-bullet" || claim.kind === "summary" ? citedText : `${citedText}\n${contextText}`;
  const ungrounded = tokens.filter((token) => !tokenGrounded(token, groundingHay));
  if (ungrounded.length) {
    reasons.push(`These words are not in the cited lines${claim.kind === "cv-bullet" || claim.kind === "summary" ? "" : " or the allowed context"}: ${ungrounded.join(", ")}.`);
  }
  const grounded = reasons.length === 0;
  return {
    status: claim.userApproved ? "approved" : grounded ? "supported" : "unsupported",
    reasons: claim.userApproved && reasons.length ? [`Approved by you despite: ${reasons.join(" ")}`] : reasons,
    ungroundedTokens: ungrounded,
    missingNumbers: missingNumbers.map((item) => item.raw),
  };
}

export function applyReview<T extends Claim>(claim: T, sources: SourceLine[], contextText = ""): T {
  const review = reviewClaim(claim, sources, contextText);
  return { ...claim, status: review.status, reasons: review.reasons };
}

export function exportBlocked(claims: Claim[]): { blocked: boolean; claims: Claim[] } {
  const blocking = claims.filter((claim) => claim.status === "unsupported");
  return { blocked: blocking.length > 0, claims: blocking };
}

export function claimsInPack(pack: TailoredPack): Claim[] {
  return [
    pack.summary,
    ...pack.roles.flatMap((role) => role.claims),
    ...pack.cover,
    ...pack.answers.map((answer) => answer.claim),
    pack.contact.claim,
  ];
}

function unmatchedQuantities(claimText: string, sourceText: string): Quantity[] {
  const claimQuantities = extractQuantities(claimText);
  const sourceQuantities = extractQuantities(sourceText);
  return claimQuantities.filter((claim) => !sourceQuantities.some((source) => quantitiesMatch(claim, source)));
}

function tokenGrounded(token: string, haystack: string): boolean {
  const hayTokens = haystack.toLowerCase().match(/[a-z0-9+#.]{2,}/g) ?? [];
  const target = stem(token.toLowerCase());
  return hayTokens.some((word) => stem(word.replace(/^\.+|\.+$/g, "")) === target || word.includes(token.toLowerCase()));
}

export function contextFor(kind: ClaimKind, jd: string, company: string, title: string): string {
  if (kind === "cv-bullet" || kind === "summary") return "";
  return `${jd}\n${company}\n${title}`;
}
