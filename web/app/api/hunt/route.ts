import { MERCHANTS, buildQuote, cleanQuote, productBySku, quoteTotal } from "@/lib/catalog";
import { clampInt, clampMandate, clampOptionalCents, chooseAgentOffer, evaluateGuard, naivePickOf } from "@/lib/guard";
import { quoteToken, signQuote, signingConfigured } from "@/lib/signing";
import { truthReport } from "@/lib/truth";
import type { Offer, Merchant } from "@/lib/types";

const fail = (code: string, error: string, details?: string) =>
  Response.json({ ok: false, error, code, ...(details ? { details } : {}) });

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { sku?: unknown; qty?: unknown; mandate?: unknown; errandBudgetCents?: unknown };
    const product = typeof body.sku === "string" ? productBySku(body.sku) : null;
    if (!product) return fail("bad_product", "Unknown product for this hunt.");
    const qty = clampInt(body.qty, 1, 5, 1);
    const mandate = clampMandate(body.mandate);
    const errandBudgetCents = clampOptionalCents(body.errandBudgetCents, 1, 10000000);

    const offers: Offer[] = MERCHANTS.map(m => {
      const raw = buildQuote(m.id, product.sku, qty);
      const cleaned = mandate.blockPreselectedAddons ? cleanQuote(raw) : { quote: raw, strippedCents: 0, strippedCount: 0 };
      const truth = truthReport(raw, cleaned.quote, cleaned.strippedCents, cleaned.strippedCount);
      const guard = evaluateGuard(truth, mandate, errandBudgetCents);
      const token = guard.verdict === "BLOCK" || !signingConfigured() ? null : signQuote(quoteToken(cleaned.quote));
      const merchant: Merchant = { id: m.id, name: m.name, tier: m.tier, blurb: m.blurb };
      return { merchant, raw, evaluated: cleaned.quote, truth, guard, token };
    });

    const naive = naivePickOf(offers);
    const chosen = chooseAgentOffer(offers);
    const surpriseCents = naive.rawTotalCents - naive.stickerCents;
    const savedVsNaiveCents = chosen ? naive.rawTotalCents - quoteTotal(chosen.evaluated) : 0;

    return Response.json({
      ok: true,
      product: { sku: product.sku, name: product.name },
      offers,
      naive,
      chosen: chosen ? { merchantId: chosen.merchant.id, verdict: chosen.guard.verdict } : null,
      surpriseCents,
      savedVsNaiveCents,
    });
  } catch (e) {
    console.error("[MePal] hunt error:", e instanceof Error ? e.message : e);
    return fail("internal_error", "The hunt hit an unexpected error. Try again.");
  }
}
