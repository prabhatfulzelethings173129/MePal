import { extractJsonObject, llmChat } from "@/lib/llm";
import { formatMoney, parseAmountToCents } from "@/lib/money";
import { gradeFor } from "@/lib/truth";
import type { AuditLine, AuditLineKind, AuditReport, Currency, DarkPattern, QuoteFlags } from "@/lib/types";

const fail = (code: string, error: string, details?: string) =>
  Response.json({ ok: false, error, code, ...(details ? { details } : {}) });

const CURRENCIES: Currency[] = ["USD", "INR", "EUR", "GBP"];
const LINE_TYPES: AuditLineKind[] = ["item", "shipping", "fee", "tax", "discount", "addon", "total"];

interface RawLine {
  label: string;
  cents: number;
  kind: AuditLineKind;
  preselected: boolean;
}

function classifyLabel(label: string): AuditLineKind {
  const l = label.toLowerCase();
  if (/sub\s*total/.test(l)) return "item";
  if (/\bitem\b|\bmerch\b|\bprice\b/.test(l)) return "item";
  if (/discount|coupon|saving|promo|\boff\b/.test(l)) return "discount";
  if (/\btip\b|donation|protect|warranty|insurance|\bplan\b|add-?on|optional|pre-?selected/.test(l)) return "addon";
  if (/deliver|\bship|courier|postage/.test(l)) return "shipping";
  if (/\bgst\b|\btax\b|\bvat\b|duty|cess/.test(l)) return "tax";
  if (/grand\s*total|to pay|payable|total due|\btotal\b/.test(l)) return "total";
  if (/\bfee\b|charge|surge|platform|handling|convenience|service/.test(l)) return "fee";
  return "fee";
}

const AMOUNT_RE = /((?:\u20B9|\u20AC|\u00A3|\$)|\b(?:rs\.?|inr|usd|eur|gbp)\b)?\s*([\d][\d,]*(?:\.\d{1,2})?)/i;

function extractFallbackLines(text: string): RawLine[] {
  const lines: RawLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = AMOUNT_RE.exec(line);
    if (!m) continue;
    const cents = parseAmountToCents(m[0].replace(/^[^\d]*/, ""));
    if (!Number.isFinite(cents) || cents < 0) continue;
    const label = line.slice(0, m.index).trim().replace(/[:\-\u2013\u2014]+\s*$/, "").slice(0, 80) || "Line";
    const preselected = /pre-?selected|\(added\)|\badded\b|default|auto-?added/i.test(line);
    lines.push({ label, cents, kind: classifyLabel(label), preselected });
  }
  return lines;
}

function flagsFromText(text: string): QuoteFlags {
  const t = text.toLowerCase();
  return {
    falseUrgency: /only \d+ left|ends in \d|offer ends|hurry|limited time|last chance/.test(t),
    trialAutoRenew: /trial|auto-?renew|renews (at|automatically)/.test(t),
  };
}

// Same honesty formula as lib/truth.ts, with the advertised price as the sticker denominator
// and every non-item, non-tax line counted as hidden at stage 3.
function auditHonesty(hiddenCents: number, advertisedCents: number, hiddenLineCount: number, pretickedCount: number, flags: QuoteFlags): number {
  let s = 100;
  s -= Math.min(50, Math.round(advertisedCents > 0 ? (hiddenCents / advertisedCents) * 100 : 0));
  if (hiddenLineCount > 0) s -= 10;
  s -= Math.min(16, pretickedCount * 8);
  if (flags.falseUrgency) s -= 8;
  if (flags.trialAutoRenew) s -= 12;
  return Math.max(0, Math.min(100, s));
}

function buildReport(
  currency: Currency,
  advertisedCents: number,
  rawLines: RawLine[],
  flags: QuoteFlags
): AuditReport {
  const lines: AuditLine[] = rawLines.map((l, i) => ({
    id: `l${i + 1}`,
    label: l.label,
    kind: l.kind,
    cents: l.cents,
    preselected: l.preselected && l.kind === "addon",
    stage: l.kind === "item" ? 1 : l.kind === "tax" ? 2 : 3,
  }));

  const itemTotal = lines.filter(l => l.kind === "item").reduce((a, l) => a + l.cents, 0);
  const discount = lines.filter(l => l.kind === "discount").reduce((a, l) => a + l.cents, 0);
  const total =
    lines.filter(l => l.kind !== "total").reduce((a, l) => a + l.cents, 0) - discount;
  const statedTotalCents =
    lines.filter(l => l.kind === "total").reduce((a, l) => Math.max(a, l.cents), 0) || null;

  const baseHidden = lines
    .filter(l => l.kind === "shipping" || l.kind === "fee" || l.kind === "addon" || l.kind === "discount")
    .reduce((a, l) => a + l.cents, 0);
  const priceChange = Math.max(0, itemTotal - advertisedCents);
  const hiddenCents = baseHidden + priceChange;
  const hiddenPct = advertisedCents > 0 ? (hiddenCents / advertisedCents) * 100 : 0;
  const avoidable = lines.filter(l => l.kind === "addon" && l.preselected).reduce((a, l) => a + l.cents, 0);

  const tags: DarkPattern[] = [];
  if (baseHidden > 0) tags.push("drip_pricing");
  if (lines.some(l => l.kind === "addon" && l.preselected)) tags.push("basket_sneaking");
  if (flags.falseUrgency) tags.push("false_urgency");
  if (flags.trialAutoRenew) tags.push("subscription_trap");
  if (priceChange > 0) tags.push("price_change");

  const pretickedCount = lines.filter(l => l.kind === "addon" && l.preselected).length;
  const score = auditHonesty(hiddenCents, advertisedCents, lines.filter(l => l.stage === 3 && l.kind !== "discount").length, pretickedCount, flags);

  const warnings: string[] = [];
  if (statedTotalCents !== null) {
    const diff = Math.abs(total - statedTotalCents);
    const tol = Math.max(Math.round(statedTotalCents * 0.01), 1);
    if (diff > tol) {
      warnings.push(
        `The lines add up to ${formatMoney(total, currency)} but the checkout says ${formatMoney(statedTotalCents, currency)}; some charges may be missing from the text you pasted.`
      );
    }
  }
  if (priceChange > 0) {
    warnings.push(
      `The item lines (${formatMoney(itemTotal, currency)}) are higher than the advertised price (${formatMoney(advertisedCents, currency)}).`
    );
  }

  return {
    currency,
    advertisedCents,
    lines,
    itemTotalCents: itemTotal,
    totalCents: total,
    statedTotalCents,
    hiddenCents,
    hiddenPct,
    avoidableCents: avoidable,
    tags,
    honestyScore: score,
    grade: gradeFor(score),
    warnings,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: unknown; advertised?: unknown; currency?: unknown };
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
    if (!text) return fail("bad_input", "Paste the checkout text you want to audit.");
    const currency = CURRENCIES.includes(body.currency as Currency) ? (body.currency as Currency) : null;
    if (!currency) return fail("bad_input", "Pick a currency: USD, INR, EUR or GBP.");
    const advertisedRaw = body.advertised === null || body.advertised === undefined ? "" : String(body.advertised);
    const advertisedCents = parseAmountToCents(advertisedRaw);
    if (!Number.isFinite(advertisedCents) || advertisedCents <= 0) {
      return fail("bad_input", "Enter the advertised price as a number, e.g. 499 or 59.00.");
    }

    let rawLines: RawLine[] | null = null;
    let flags: QuoteFlags = { falseUrgency: false, trialAutoRenew: false };
    let source: "llm" | "fallback" = "fallback";
    let model: string | undefined;

    const llm = await llmChat(
      [
        {
          role: "system",
          content:
            'You extract checkout line items. Respond with ONLY minified JSON, no markdown: {"lines":[{"label":string,"amount":number,"type":"item"|"shipping"|"fee"|"tax"|"discount"|"addon"|"total","preselected":boolean}],"flags":{"falseUrgency":boolean,"trialAutoRenew":boolean}}. amount is the number shown on the line. preselected is true only when the line says pre-selected, added, default or auto-added.',
        },
        { role: "user", content: `Currency: ${currency}\nCheckout text:\n${text}` },
      ],
      700,
      12000
    );

    if (llm.ok && llm.content) {
      const obj = extractJsonObject(llm.content);
      const rawArr = obj && Array.isArray(obj.lines) ? (obj.lines as unknown[]) : null;
      if (rawArr) {
        const parsed: RawLine[] = [];
        for (const item of rawArr.slice(0, 40)) {
          if (typeof item !== "object" || item === null) continue;
          const o = item as Record<string, unknown>;
          if (typeof o.label !== "string" || typeof o.amount !== "number" || !Number.isFinite(o.amount)) continue;
          const cents = parseAmountToCents(String(o.amount));
          if (!Number.isFinite(cents) || cents < 0) continue;
          const kind = LINE_TYPES.includes(o.type as AuditLineKind) ? (o.type as AuditLineKind) : classifyLabel(o.label);
          parsed.push({
            label: o.label.trim().slice(0, 80) || "Line",
            cents,
            kind,
            preselected: o.preselected === true,
          });
        }
        const f = obj ? obj.flags : null;
        if (typeof f === "object" && f !== null) {
          const fo = f as Record<string, unknown>;
          flags = { falseUrgency: fo.falseUrgency === true, trialAutoRenew: fo.trialAutoRenew === true };
        }
        if (parsed.length > 0) {
          rawLines = parsed;
          source = "llm";
          model = llm.model;
        }
      }
    }

    if (!rawLines) {
      rawLines = extractFallbackLines(text);
      flags = flagsFromText(text);
    }
    if (rawLines.length === 0) {
      return fail(
        "no_lines",
        "I could not find any prices in that text. Paste checkout lines like 'Delivery fee 40' or 'Total 626'."
      );
    }

    const report = buildReport(currency, advertisedCents, rawLines, flags);
    return Response.json({ ok: true, report, source, model });
  } catch (e) {
    console.error("[MePal] route error:", e instanceof Error ? e.message : e);
    return fail("internal_error", "The audit hit an unexpected error. Try again.");
  }
}
