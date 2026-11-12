import type { CurrencyCode } from "@/lib/types";
import { CURRENCIES } from "@/lib/types";

/**
 * Approximate units of each currency per 1 Canadian dollar.
 * Static scoring estimates, not a live foreign-exchange feed.
 * Dated for a November 2026 demo and intentionally round.
 */
export const UNITS_PER_CAD: Record<CurrencyCode, number> = {
  CAD: 1,
  USD: 0.72,
  EUR: 0.66,
  GBP: 0.55,
  AUD: 1.09,
  NZD: 1.2,
  CHF: 0.63,
  INR: 64,
  JPY: 110,
  MXN: 13.5,
  SGD: 0.95,
};

export const FX_NOTE =
  "Salary scores use static approximate rates (units per 1 CAD), not a live exchange feed. Treat them as a fit check, not an offer conversion.";

const WORD_TO_CODE: Record<string, CurrencyCode> = {
  cad: "CAD",
  c$: "CAD",
  "ca$": "CAD",
  usd: "USD",
  us$: "USD",
  eur: "EUR",
  euro: "EUR",
  euros: "EUR",
  gbp: "GBP",
  aud: "AUD",
  nzd: "NZD",
  chf: "CHF",
  inr: "INR",
  jpy: "JPY",
  yen: "JPY",
  mxn: "MXN",
  sgd: "SGD",
};

const SYMBOL_TO_CODE: Record<string, CurrencyCode> = {
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
};

export interface MoneyRange {
  min: number;
  max: number;
  currency: CurrencyCode;
  period: "year" | "hour";
  raw: string;
}

export function isCurrency(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function toCad(amount: number, currency: CurrencyCode): number {
  const perCad = UNITS_PER_CAD[currency] || 1;
  return amount / perCad;
}

export function fromCad(amountCad: number, currency: CurrencyCode): number {
  return amountCad * (UNITS_PER_CAD[currency] || 1);
}

export function annualize(amount: number, period: "year" | "hour"): number {
  return period === "hour" ? amount * 2080 : amount;
}

function multiplier(suffix: string | undefined): number {
  if (!suffix) return 1;
  const s = suffix.toLowerCase();
  if (s === "k" || s === "thousand") return 1_000;
  if (s === "m" || s === "million") return 1_000_000;
  if (s === "b" || s === "billion") return 1_000_000_000;
  return 1;
}

function parseAmount(body: string): number | null {
  const match = body.trim().match(/^(\d{1,3}(?:[ ,]\d{3})+|\d+(?:\.\d+)?)(?:\s*(k|m|b|thousand|million|billion))?$/i);
  if (!match) return null;
  const digits = match[1].replace(/[ ,]/g, "");
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return value * multiplier(match[2]);
}

function detectCurrency(windowText: string, symbol: string): CurrencyCode {
  if (SYMBOL_TO_CODE[symbol]) return SYMBOL_TO_CODE[symbol];
  const lower = windowText.toLowerCase();
  if (/\bcad\b|\bc\$|\bca\$/.test(lower) || /canadian/.test(lower)) return "CAD";
  for (const [word, code] of Object.entries(WORD_TO_CODE)) {
    if (word.length <= 2) continue;
    const re = new RegExp(`\\b${word}\\b`, "i");
    if (re.test(lower)) return code;
  }
  if (symbol === "$") return "USD";
  return "USD";
}

function detectPeriod(windowText: string): "year" | "hour" {
  return /\b(hour|hr|hourly)\b/i.test(windowText) ? "hour" : "year";
}

export function parseSalaryMentions(text: string): MoneyRange[] {
  const results: MoneyRange[] = [];
  const rangeRe =
    /((?:cad|usd|eur|gbp|aud|nzd|chf|inr|jpy|mxn|sgd|c\$|ca\$|us\$|€|£|¥|\$)\s*)?(\d{1,3}(?:[ ,]\d{3})+|\d+(?:\.\d+)?)(?:\s*(k|m|b|thousand|million|billion))?\s*(?:–|—|-|to)\s*((?:cad|usd|eur|gbp|aud|nzd|chf|inr|jpy|mxn|sgd|c\$|ca\$|us\$|€|£|¥|\$)\s*)?(\d{1,3}(?:[ ,]\d{3})+|\d+(?:\.\d+)?)(?:\s*(k|m|b|thousand|million|billion))?/gi;

  const seen = new Set<string>();
  for (const match of text.matchAll(rangeRe)) {
    const raw = match[0];
    const min = parseAmount(`${match[2]}${match[3] ? ` ${match[3]}` : ""}`);
    const max = parseAmount(`${match[5]}${match[6] ? ` ${match[6]}` : ""}`);
    if (min == null || max == null) continue;
    if (min < 15 && max < 40 && !/[$€£¥]|cad|usd|eur|gbp/i.test(raw)) continue;
    const start = Math.max(0, (match.index ?? 0) - 24);
    const end = Math.min(text.length, (match.index ?? 0) + raw.length + 32);
    const windowText = `${text.slice(start, end)} ${raw}`;
    const symbol = (match[1] || match[4] || "").trim().slice(0, 1);
    const currency = detectCurrency(windowText, symbol === "c" || symbol === "u" ? "$" : symbol);
    const period = detectPeriod(windowText);
    const key = `${currency}:${period}:${min}:${max}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    if (period === "year" && high < 1000) continue;
    results.push({ min: low, max: high, currency, period, raw: raw.trim() });
  }

  if (results.length > 0) return results;

  const singleRe =
    /((?:cad|usd|eur|gbp|aud|nzd|chf|inr|jpy|mxn|sgd|c\$|ca\$|us\$|€|£|¥|\$)\s*)(\d{1,3}(?:[ ,]\d{3})+|\d+(?:\.\d+)?)(?:\s*(k|m|b|thousand|million|billion))?/gi;
  for (const match of text.matchAll(singleRe)) {
    const amount = parseAmount(`${match[2]}${match[3] ? ` ${match[3]}` : ""}`);
    if (amount == null) continue;
    const raw = match[0];
    const start = Math.max(0, (match.index ?? 0) - 16);
    const end = Math.min(text.length, (match.index ?? 0) + raw.length + 24);
    const windowText = text.slice(start, end);
    const symbol = match[1].trim().slice(0, 1);
    const currency = detectCurrency(windowText, symbol);
    const period = detectPeriod(windowText);
    if (period === "year" && amount < 1000) continue;
    if (period === "hour" && (amount < 8 || amount > 500)) continue;
    const key = `${currency}:${period}:${amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ min: amount, max: amount, currency, period, raw: raw.trim() });
  }
  return results;
}

export function chooseSalary(text: string): MoneyRange | null {
  const mentions = parseSalaryMentions(text);
  const annual = mentions.find((item) => item.period === "year");
  return annual ?? mentions[0] ?? null;
}

export interface Quantity {
  value: number;
  kind: "plain" | "percent" | "multiplier" | "money";
  raw: string;
}

export function extractQuantities(text: string): Quantity[] {
  const quantities: Quantity[] = [];
  const re =
    /(\$?\d{1,3}(?:,\d{3})+|\$?\d+(?:\.\d+)?)(?:\s*(%|percent|x|times|k|m|b|thousand|million|billion))?/gi;
  for (const match of text.matchAll(re)) {
    const rawNumber = match[1].replace(/[$,]/g, "");
    const base = Number(rawNumber);
    if (!Number.isFinite(base)) continue;
    const suffix = (match[2] || "").toLowerCase();
    let kind: Quantity["kind"] = "plain";
    let value = base;
    if (suffix === "%" || suffix === "percent") kind = "percent";
    else if (suffix === "x" || suffix === "times") kind = "multiplier";
    else if (suffix) {
      kind = match[1].includes("$") ? "money" : "plain";
      value = base * multiplier(suffix);
      if (suffix === "b" || suffix === "billion") value = base * 1_000_000_000;
    } else if (match[1].includes("$")) kind = "money";
    if (value === 0 && base === 0) continue;
    quantities.push({ value, kind, raw: match[0] });
  }
  return quantities;
}

export function quantitiesMatch(claim: Quantity, source: Quantity): boolean {
  if (claim.kind === "percent" && source.kind !== "percent" && source.kind !== "plain") return false;
  if (claim.kind === "multiplier" && source.kind !== "multiplier" && source.kind !== "plain") return false;
  const scale = Math.max(Math.abs(claim.value), Math.abs(source.value), 1);
  return Math.abs(claim.value - source.value) <= Math.max(0.01, scale * 0.001);
}
