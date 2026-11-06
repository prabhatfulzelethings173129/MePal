import { PayPalError, captureOrder, getOrder, parseMoneyOrZero, readOrder } from "@/lib/paypal";
import { parseAmountToCents } from "@/lib/money";
import { verifyQuote } from "@/lib/signing";
import type { Currency } from "@/lib/types";

const fail = (code: string, error: string, details?: string) =>
  Response.json({ ok: false, error, code, ...(details ? { details } : {}) });

const ID_RE = /^[A-Za-z0-9-]{6,40}$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { orderId?: unknown; token?: unknown };
    if (typeof body.token !== "string") return fail("bad_token", "Missing signed quote for this payment.");
    const verified = verifyQuote(body.token);
    if (!verified.ok) {
      if (verified.reason === "expired") {
        return fail("quote_expired", "The signed quote expired. Run the errand again; if PayPal already took the money it will show in your ledger.");
      }
      return fail("bad_token", "This payment quote failed signature verification.");
    }
    const payload = verified.payload;
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!ID_RE.test(orderId)) return fail("bad_input", "That PayPal order id does not look right.");

    const view = readOrder(await getOrder(orderId));
    if (view.customId !== payload.qid) {
      return fail("order_mismatch", "This PayPal order does not match the approved MePal quote.");
    }
    const orderCents = parseAmountToCents(view.amountValue ?? "");
    if (view.amountValue === null || !Number.isFinite(orderCents) || orderCents !== payload.totalCents) {
      return fail("order_mismatch", "The PayPal order amount does not match the approved MePal quote.");
    }

    let orderJson: Record<string, unknown>;
    let alreadyCaptured = false;

    if (view.status === "COMPLETED") {
      orderJson = await getOrder(orderId);
      alreadyCaptured = true;
    } else if (view.status === "APPROVED") {
      try {
        orderJson = await captureOrder(orderId, payload.qid);
      } catch (e) {
        if (e instanceof PayPalError && (e.name === "ORDER_ALREADY_CAPTURED" || /already/i.test(e.message))) {
          orderJson = await getOrder(orderId);
          alreadyCaptured = true;
        } else {
          throw e;
        }
      }
    } else {
      return fail("not_approved", "The payment was not approved on PayPal, nothing was charged.");
    }

    const done = readOrder(orderJson);
    const captureId = done.captureId;
    const capturedCents = parseMoneyOrZero(done.capturedValue ?? done.amountValue);
    const currency = ((done.capturedCurrency ?? done.currency ?? "USD") as Currency) || "USD";
    return Response.json({
      ok: true,
      status: done.status,
      captureId,
      capturedCents,
      currency,
      alreadyCaptured,
    });
  } catch (e) {
    if (e instanceof PayPalError) {
      return fail("paypal_error", `PayPal sandbox error: ${e.message}`.slice(0, 300), e.debugId);
    }
    return fail("internal_error", "Capturing the payment failed unexpectedly. You can retry from this page.");
  }
}
