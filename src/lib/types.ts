export const WEIGHT_KEYS = [
  "skills",
  "seniority",
  "location",
  "salary",
  "workAuth",
  "company",
  "dealbreakers",
] as const;

export type WeightKey = (typeof WEIGHT_KEYS)[number];

export const CURRENCIES = [
  "CAD",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "NZD",
  "CHF",
  "INR",
  "JPY",
  "MXN",
  "SGD",
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const SENIORITY_LEVELS = [
  "intern",
  "junior",
  "mid",
  "senior",
  "lead",
  "staff",
  "principal",
  "director",
] as const;

export type Seniority = (typeof SENIORITY_LEVELS)[number];

export const WORK_MODELS = ["remote", "hybrid", "onsite"] as const;
export type WorkModel = (typeof WORK_MODELS)[number];

export const AUTH_STATUSES = [
  "citizen",
  "permanent_resident",
  "open_permit",
  "needs_sponsorship",
  "other",
] as const;

export type AuthStatus = (typeof AUTH_STATUSES)[number];

export const STAGES = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "ghosted",
] as const;

export type Stage = (typeof STAGES)[number];

export const BOARD_KINDS = [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "workday",
  "jobbank",
  "indeed",
  "manual",
] as const;

export type BoardKind = (typeof BOARD_KINDS)[number];

export type EvidenceStatus = "supported" | "partial" | "unknown";
export type ImportanceSource = "jd-wording" | "jd-structure" | "estimate";
export type Confidence = "high" | "medium" | "low";
export type Recommendation = "apply" | "consider" | "skip";
export type ClaimStatus = "supported" | "unsupported" | "approved";
export type ClaimKind = "summary" | "cv-bullet" | "cover" | "answer" | "note";

export interface WorkAuthEntry {
  id: string;
  country: string;
  status: AuthStatus;
  note: string;
}

export interface Profile {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  city: string;
  region: string;
  country: string;
  links: { label: string; url: string }[];
  targetTitles: string[];
  seniority: Seniority;
  yearsExperience: number;
  workModel: WorkModel[];
  willingToRelocate: boolean;
  preferredCities: string[];
  preferredCountries: string[];
  workAuthorization: WorkAuthEntry[];
  salary: {
    currency: CurrencyCode;
    min: number;
    max: number;
    period: "year";
  };
  preferredCompanies: string[];
  avoidedCompanies: string[];
  dealbreakers: string[];
  noticePeriod: string;
}

export interface CvBullet {
  id: string;
  text: string;
}

export interface CvRole {
  id: string;
  company: string;
  title: string;
  location: string;
  start: string;
  end: string | null;
  bullets: CvBullet[];
}

export interface CvEducation {
  id: string;
  school: string;
  credential: string;
  year: string;
  details: string;
}

export interface MasterCv {
  summary: string;
  roles: CvRole[];
  education: CvEducation[];
  skills: string[];
  proofPoints: CvBullet[];
}

export interface Rubric {
  weights: Record<WeightKey, number>;
  threshold: number;
  considerGap: number;
  dealbreakersAreHardGates: boolean;
  hardGateCap: number;
}

export interface Settings {
  autoScanOnOpen: boolean;
  browserNotifications: boolean;
  followUpDays: number;
  digestEnabled: boolean;
  digestWebhookUrl: string;
}

export interface SourceLine {
  id: string;
  text: string;
  label: string;
}

export interface RequirementScore {
  id: string;
  text: string;
  importance: 1 | 2 | 3;
  importanceSource: ImportanceSource;
  importanceReason: string;
  score: number;
  explanation: string;
  evidence: string[];
  askedSkills: string[];
  missingSkills: string[];
}

export interface DimensionScore {
  key: WeightKey;
  label: string;
  score: number;
  weight: number;
  weightPercent: number;
  contribution: number;
  explanation: string;
  evidence: EvidenceStatus;
}

export interface EvaluationResult {
  globalScore: number;
  rawScore: number;
  threshold: number;
  recommendation: Recommendation;
  recommendationReason: string;
  hardBlocked: boolean;
  hardBlockReasons: string[];
  formula: string;
  dimensions: DimensionScore[];
  requirements: RequirementScore[];
  confidence: Confidence;
  confidenceReasons: string[];
  confidenceGaps: string[];
  targetTitleNote: string;
  salaryLabel: string;
  detectedLocation: string;
  detectedLevel: string | null;
}

export interface Claim {
  id: string;
  kind: ClaimKind;
  text: string;
  sourceIds: string[];
  userApproved: boolean;
  status: ClaimStatus;
  reasons: string[];
}

export interface TailoredRole {
  roleId: string;
  claims: Claim[];
}

export interface DraftAnswer {
  id: string;
  question: string;
  claim: Claim;
}

export interface TailoredPack {
  generatedBy: "rules" | "model";
  modelNote: string;
  summary: Claim;
  roles: TailoredRole[];
  skillOrder: string[];
  cover: Claim[];
  answers: DraftAnswer[];
  contact: {
    name: string;
    role: string;
    claim: Claim;
  };
  questions: { id: string; question: string; cue: string }[];
  followUpDraft: string;
}

export interface LivenessResult {
  url: string;
  finalUrl: string;
  httpStatus: number | null;
  state: "live" | "closed" | "unknown";
  signals: string[];
  text: string;
  checkedAt: string;
}

export interface EvaluationRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  company: string;
  title: string;
  location: string;
  url: string;
  rawText: string;
  liveness: LivenessResult | null;
  result: EvaluationResult;
  tailored: TailoredPack | null;
  applicationId: string | null;
  userOverride: Recommendation | null;
}

export interface Note {
  id: string;
  at: string;
  text: string;
}

export interface ContactDraft {
  id: string;
  name: string;
  role: string;
  url: string;
  note: string;
}

export interface Application {
  id: string;
  evaluationId: string | null;
  company: string;
  title: string;
  url: string;
  source: string;
  location: string;
  salaryLabel: string;
  score: number | null;
  stage: Stage;
  appliedAt: string | null;
  followUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  notes: Note[];
  contacts: ContactDraft[];
  rejectionReason: string;
  followUpDraft: string;
}

export interface WorkdayConfig {
  host: string;
  tenant: string;
  site: string;
}

export interface JobSource {
  id: string;
  name: string;
  kind: BoardKind;
  token: string;
  country: string;
  industry: string;
  keywords: string[];
  location: string;
  enabled: boolean;
  workday: WorkdayConfig | null;
  notes: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  keywords: string[];
  location: string;
  country: string;
  sourceIds: string[];
  enabled: boolean;
  createdAt: string;
}

export interface JobMatch {
  id: string;
  searchId: string | null;
  sourceId: string | null;
  sourceName: string;
  sourceKind: BoardKind | "paste";
  externalId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salaryLabel: string;
  postedAt: string | null;
  foundAt: string;
  status: "new" | "saved" | "dismissed" | "evaluated";
}

export interface StarStory {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
  sourceIds: string[];
  tags: string[];
}

export interface PracticeNote {
  id: string;
  question: string;
  answer: string;
  feedback: string[];
  updatedAt: string;
}

export interface OfferNote {
  id: string;
  applicationId: string | null;
  company: string;
  role: string;
  currency: CurrencyCode;
  desiredMin: number;
  desiredMax: number;
  advertisedMin: number | null;
  advertisedMax: number | null;
  actualBase: number | null;
  bonus: string;
  equity: string;
  notes: string;
  lawyerQuestions: string[];
  updatedAt: string;
}

export interface AppData {
  version: 1;
  updatedAt: string;
  profile: Profile;
  cv: MasterCv;
  rubric: Rubric;
  settings: Settings;
  sources: JobSource[];
  searches: SavedSearch[];
  matches: JobMatch[];
  evaluations: EvaluationRecord[];
  applications: Application[];
  stories: StarStory[];
  practice: PracticeNote[];
  offers: OfferNote[];
  lastScanAt: string | null;
  lastScanNote: string;
}

export interface AiSecrets {
  provider: "none" | "openai" | "gemini" | "ollama";
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const WEIGHT_LABELS: Record<WeightKey, string> = {
  skills: "Skills",
  seniority: "Seniority",
  location: "Location and remote",
  salary: "Salary",
  workAuth: "Work authorisation",
  company: "Company preferences",
  dealbreakers: "Dealbreakers",
};

export const STAGE_LABELS: Record<Stage, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "Ghosted",
};

export const AUTH_LABELS: Record<AuthStatus, string> = {
  citizen: "Citizen",
  permanent_resident: "Permanent resident",
  open_permit: "Open work permit",
  needs_sponsorship: "Needs sponsorship",
  other: "Other",
};
