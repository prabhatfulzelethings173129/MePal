import { buildQuote, cleanQuote, quoteTotal } from "@/lib/catalog";
import { clampMandate, clampOptionalCents, evaluateGuard } from "@/lib/guard";
import { PayPalError, createOrder } from "@/lib/paypal";
import { verifyQuote } from "@/lib/signing";
import { truthReport } from "@/lib/truth";

const fail = (code: string, error: string, details?: string) =>
  Response.json({ ok: false, error, code, ...(details ? { details } : {}) });

function tokenLinesOf(lines: { id: string; label: string; kind: string; cents: number }[]): string {
  return JSON.stringify(lines.map(l => [l.id, l.label, l.kind, l.cents]));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      token?: unknown;
      mandate?: unknown;
      errandBudgetCents?: unknown;
      confirmedByUser?: unknown;
      exceptionApproved?: unknown;
    };
    if (typeof body.token !== "string") return fail("bad_token", "Missing signed quote for this payment.");

    const verified = verifyQuote(body.token);
    if (!verified.ok) {
      if (verified.reason === "expired") {
        return fail("quote_expired", "This price quote expired after 10 minutes. Run the errand again to get a fresh quote.");
      }
      if (verified.reason === "no_secret") {
        return fail("no_signing_secret", "MePal server has no signing secret. Set MEPAL_SIGNING_SECRET in web/.env.local.");
      }
      return fail("bad_token", "This payment quote failed signature verification. Run the errand again.");
    }
    const payload = verified.payload;

    const mandate = clampMandate(body.mandate);
    const errandBudgetCents = clampOptionalCents(body.errandBudgetCents, 1, 10000000);
    const confirmedByUser = body.confirmedByUser === true;
    const exceptionApproved = body.exceptionApproved === true;

    // Rebuild the quote server-side from the signed sku/qty and require an exact
    // match with the token lines, so the browser can never set amounts.
    let raw;
    try {
      raw = buildQuote(payload.merchantId, payload.sku, payload.qty);
    } catch (e) {
    console.error("[MePal] route error:", e instanceof Error ? e.message : e);
      return fail("quote_mismatch", "This offer no longer matches the MePal catalog. Run the errand again.");
    }
    const cleaned = mandate.blockPreselectedAddons ? cleanQuote(raw) : { quote: raw, strippedCents: 0, strippedCount: 0 };
    if (tokenLinesOf(payload.lines) !== tokenLinesOf(cleaned.quote.lines.map(l => ({ id: l.id, label: l.label, kind: l.kind, cents: l.cents })))) {
      return fail("quote_mismatch", "This offer no longer matches the MePal catalog. Run the errand again.");
    }
    if (payload.totalCents !== quoteTotal(cleaned.quote)) {
      return fail("quote_mismatch", "This offer total no longer matches the MePal catalog. Run the errand again.");
    }

    const truth = truthReport(raw, cleaned.quote, cleaned.strippedCents, cleaned.strippedCount);
    const guard = evaluateGuard(truth, mandate, errandBudgetCents);

    if (guard.verdict === "BLOCK") {
      const broken = guard.rules.filter(r => !r.passed).map(r => `${r.label}: ${r.detail}`).join("; ");
      return fail("blocked", `Your mandate blocks this payment. ${broken}`);
    }
    if (guard.verdict === "NEEDS_EXCEPTION" && !exceptionApproved) {
      return fail("needs_exception", "This total is above your spending limit. Approve a one-time exception in MePal first (honesty rules cannot be overridden).");
    }
    if (guard.verdict === "CONFIRM" && !confirmedByUser) {
      return fail("needs_confirmation", "Tick 'I reviewed the full price' before paying.");
    }

    const appBase = (process.env.APP_BASE_URL || new URL(req.url).origin).replace(/\/+$/, "");
    const order = await createOrder(payload, appBase);
    return Response.json({ ok: true, orderId: order.orderId, approveUrl: order.approveUrl });
  } catch (e) {
    if (e instanceof PayPalError) {
      return fail("paypal_error", `PayPal sandbox error: ${e.message}`.slice(0, 300), e.debugId);
    }
    return fail("internal_error", "Creating the PayPal order failed unexpectedly. Try again.");
  }
}
