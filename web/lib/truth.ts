import { quoteTotal } from "./catalog";
import type { CreepPoint, DarkPattern, LineKind, Quote, TruthReport } from "./types";

export function sumLines(q: Quote, kinds: LineKind[]): number {
  return q.lines.filter(l => kinds.includes(l.kind)).reduce((a, l) => a + l.cents, 0);
}

export function stickerCents(q: Quote): number {
  return sumLines(q, ["item"]);
}

// Hidden = shipping + fees + add-ons revealed at stage 2 or later (tax is standard, never hidden).
export function hiddenCents(q: Quote): number {
  return q.lines
    .filter(l => (l.kind === "shipping" || l.kind === "fee" || l.kind === "addon") && l.revealedAtStage >= 2)
    .reduce((a, l) => a + l.cents, 0);
}

export function hiddenPctOf(q: Quote): number {
  const s = stickerCents(q);
  return s > 0 ? (hiddenCents(q) / s) * 100 : 0;
}

export function pretickedAddons(q: Quote) {
  return q.lines.filter(l => l.kind === "addon" && l.preselected && !l.mandatory);
}

export function honestyScore(q: Quote): number {
  let s = 100;
  s -= Math.min(50, Math.round(hiddenPctOf(q)));
  const surprise = q.lines.filter(l => l.kind === "shipping" || l.kind === "fee" || l.kind === "addon");
  if (surprise.some(l => l.revealedAtStage === 3)) s -= 10;
  else if (surprise.some(l => l.revealedAtStage === 2)) s -= 5;
  s -= Math.min(16, pretickedAddons(q).length * 8);
  if (q.flags.falseUrgency) s -= 8;
  if (q.flags.trialAutoRenew) s -= 12;
  return Math.max(0, Math.min(100, s));
}

export function gradeFor(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function tagsFor(q: Quote, extra: DarkPattern[] = []): DarkPattern[] {
  const tags: DarkPattern[] = [];
  if (hiddenCents(q) > 0) tags.push("drip_pricing");
  if (pretickedAddons(q).length > 0) tags.push("basket_sneaking");
  if (q.flags.falseUrgency) tags.push("false_urgency");
  if (q.flags.trialAutoRenew) tags.push("subscription_trap");
  for (const t of extra) if (!tags.includes(t)) tags.push(t);
  return tags;
}

export function creepFor(q: Quote): CreepPoint[] {
  const at = (max: 1 | 2 | 3) => q.lines.filter(l => l.revealedAtStage <= max).reduce((a, l) => a + l.cents, 0);
  return [
    { stage: 1, label: "Sticker price", cumulativeCents: at(1) },
    { stage: 2, label: "Stage 2: shipping + tax", cumulativeCents: at(2) },
    { stage: 3, label: "Stage 3: fees + add-ons", cumulativeCents: at(3) },
  ];
}

export function truthReport(
  rawQuote: Quote,
  evaluatedQuote: Quote,
  strippedCents: number,
  strippedCount: number
): TruthReport {
  const rawTotal = quoteTotal(rawQuote);
  const evalTotal = quoteTotal(evaluatedQuote);
  const hiddenRaw = hiddenCents(rawQuote);
  const hiddenEval = hiddenCents(evaluatedQuote);
  const sticker = stickerCents(rawQuote);
  const score = honestyScore(rawQuote);
  return {
    stickerCents: sticker,
    rawTotalCents: rawTotal,
    evaluatedTotalCents: evalTotal,
    hiddenRawCents: hiddenRaw,
    hiddenRawPct: sticker > 0 ? (hiddenRaw / sticker) * 100 : 0,
    hiddenEvalCents: hiddenEval,
    hiddenEvalPct: sticker > 0 ? (hiddenEval / sticker) * 100 : 0,
    strippedCents,
    strippedCount,
    tags: tagsFor(rawQuote),
    honestyScore: score,
    grade: gradeFor(score),
    creep: creepFor(rawQuote),
  };
}
