import { quoteTotal } from "./catalog";
import { formatMoney, pctText } from "./money";
import type { GuardResult, GuardRule, Mandate, NaivePick, Quote, TruthReport, Verdict } from "./types";

export const DEFAULT_MANDATE: Mandate = {
  maxTotalCents: 6000,
  maxHiddenFeePct: 5,
  minHonestyScore: 70,
  blockPreselectedAddons: true,
  confirmAboveCents: 2500,
};

export const MANDATE_PRESETS: { id: string; label: string; blurb: string; mandate: Mandate }[] = [
  {
    id: "cautious",
    label: "Cautious",
    blurb: "Max $40 total, 2% hidden fees, honesty 85+, confirm above $15",
    mandate: { maxTotalCents: 4000, maxHiddenFeePct: 2, minHonestyScore: 85, blockPreselectedAddons: true, confirmAboveCents: 1500 },
  },
  { id: "balanced", label: "Balanced", blurb: "MePal defaults", mandate: DEFAULT_MANDATE },
  {
    id: "relaxed",
    label: "Relaxed",
    blurb: "Max $120, 10% hidden fees, honesty 55+, confirm above $60",
    mandate: { maxTotalCents: 12000, maxHiddenFeePct: 10, minHonestyScore: 55, blockPreselectedAddons: true, confirmAboveCents: 6000 },
  },
];

function clampMoney(v: unknown, min: number, max: number, dflt: number): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    const i = Math.round(v);
    return Math.min(max, Math.max(min, i));
  }
  return dflt;
}

export function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    const i = Math.round(v);
    if (Number.isNaN(i)) return dflt;
    return Math.min(max, Math.max(min, i));
  }
  return dflt;
}

export function clampOptionalCents(v: unknown, min: number, max: number): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const i = Math.round(v);
    return Math.min(max, Math.max(min, i));
  }
  return null;
}

export function clampMandate(input: unknown): Mandate {
  const m = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  return {
    maxTotalCents: clampMoney(m.maxTotalCents, 100, 10000000, DEFAULT_MANDATE.maxTotalCents),
    maxHiddenFeePct: clampMoney(m.maxHiddenFeePct, 0, 100, DEFAULT_MANDATE.maxHiddenFeePct),
    minHonestyScore: clampMoney(m.minHonestyScore, 0, 100, DEFAULT_MANDATE.minHonestyScore),
    blockPreselectedAddons: m.blockPreselectedAddons !== false,
    confirmAboveCents: clampMoney(m.confirmAboveCents, 0, 10000000, DEFAULT_MANDATE.confirmAboveCents),
  };
}

export function evaluateGuard(truth: TruthReport, mandate: Mandate, errandBudgetCents: number | null): GuardResult {
  const total = truth.evaluatedTotalCents;
  const rules: GuardRule[] = [
    {
      id: "max_total",
      label: "Total within mandate limit",
      passed: total <= mandate.maxTotalCents,
      hard: false,
      detail: `${formatMoney(total)} vs limit ${formatMoney(mandate.maxTotalCents)}`,
    },
  ];
  if (errandBudgetCents !== null && errandBudgetCents !== undefined) {
    rules.push({
      id: "errand_budget",
      label: "Total within errand budget",
      passed: total <= errandBudgetCents,
      hard: false,
      detail: `${formatMoney(total)} vs errand budget ${formatMoney(errandBudgetCents)}`,
    });
  }
  rules.push({
    id: "hidden_fee_pct",
    label: "Hidden fees within limit",
    passed: truth.hiddenEvalPct <= mandate.maxHiddenFeePct,
    hard: true,
    detail: `${pctText(truth.hiddenEvalPct)} hidden vs ${pctText(mandate.maxHiddenFeePct)} allowed`,
  });
  rules.push({
    id: "honesty_score",
    label: "Honesty score at least minimum",
    passed: truth.honestyScore >= mandate.minHonestyScore,
    hard: true,
    detail: `score ${truth.honestyScore} vs minimum ${mandate.minHonestyScore}`,
  });
  return { verdict: verdictFor(rules, total, mandate.confirmAboveCents), rules };
}

function verdictFor(rules: GuardRule[], total: number, confirmAboveCents: number): Verdict {
  if (rules.some(r => r.hard && !r.passed)) return "BLOCK";
  if (rules.some(r => !r.hard && !r.passed)) return "NEEDS_EXCEPTION";
  if (total > confirmAboveCents) return "CONFIRM";
  return "FAST";
}

interface Guardable {
  evaluated: Quote;
  truth: TruthReport;
  guard: GuardResult;
}

// Exceptions can lift only the soft spending rules, never the hard honesty rules:
// NEEDS_EXCEPTION offers are eligible, BLOCK offers never are.
export function chooseAgentOffer<T extends Guardable>(offers: T[]): T | null {
  const safe = offers.filter(o => o.guard.verdict === "FAST" || o.guard.verdict === "CONFIRM");
  const pool = safe.length > 0 ? safe : offers.filter(o => o.guard.verdict === "NEEDS_EXCEPTION");
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => {
    const ta = quoteTotal(a.evaluated);
    const tb = quoteTotal(b.evaluated);
    if (ta !== tb) return ta - tb;
    if (a.truth.honestyScore !== b.truth.honestyScore) return b.truth.honestyScore - a.truth.honestyScore;
    return a.evaluated.merchantId.localeCompare(b.evaluated.merchantId);
  })[0];
}

export function naivePickOf(offers: { raw: Quote; truth: TruthReport }[]): NaivePick {
  const pick = [...offers].sort((a, b) => {
    if (a.truth.stickerCents !== b.truth.stickerCents) return a.truth.stickerCents - b.truth.stickerCents;
    if (a.truth.honestyScore !== b.truth.honestyScore) return b.truth.honestyScore - a.truth.honestyScore;
    return a.raw.merchantId.localeCompare(b.raw.merchantId);
  })[0];
  return {
    merchantId: pick.raw.merchantId,
    stickerCents: pick.truth.stickerCents,
    rawTotalCents: quoteTotal(pick.raw),
  };
}
