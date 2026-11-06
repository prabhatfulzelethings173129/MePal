import { PayPalError, getOrder, parseMoneyOrZero, readOrder } from "@/lib/paypal";
import { hmacSeal, signingConfigured } from "@/lib/signing";
import type { Currency } from "@/lib/types";

const fail = (code: string, error: string, details?: string) =>
  Response.json({ ok: false, error, code, ...(details ? { details } : {}) });

const ID_RE = /^[A-Za-z0-9-]{6,40}$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { orderId?: unknown };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!ID_RE.test(orderId)) return fail("bad_input", "That PayPal order id does not look right.");
    if (!signingConfigured()) {
      return fail("no_signing_secret", "MePal server has no signing secret. Set MEPAL_SIGNING_SECRET in web/.env.local.");
    }

    const view = readOrder(await getOrder(orderId));
    const captureId = view.captureId;
    const capturedCents = parseMoneyOrZero(view.capturedValue ?? view.amountValue);
    const currency = ((view.capturedCurrency ?? view.currency ?? "USD") as Currency) || "USD";
    const seal = hmacSeal(`${orderId}|${captureId ?? ""}|${capturedCents}|${currency}`);
    return Response.json({ ok: true, status: view.status, captureId, capturedCents, currency, seal });
  } catch (e) {
    if (e instanceof PayPalError) {
      return fail("paypal_error", `PayPal sandbox error: ${e.message}`.slice(0, 300), e.debugId);
    }
    return fail("internal_error", "Verifying this order with PayPal failed. Try again.");
  }
}
