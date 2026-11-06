import { PayPalError, refundCapture } from "@/lib/paypal";
import { parseAmountToCents } from "@/lib/money";
import type { Currency } from "@/lib/types";

const fail = (code: string, error: string, details?: string) =>
  Response.json({ ok: false, error, code, ...(details ? { details } : {}) });

const ID_RE = /^[A-Za-z0-9-]{6,40}$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { orderId?: unknown; captureId?: unknown };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const captureId = typeof body.captureId === "string" ? body.captureId.trim() : "";
    if (!ID_RE.test(orderId) || !ID_RE.test(captureId)) {
      return fail("bad_input", "A valid PayPal order id and capture id are required for a refund.");
    }
    const json = await refundCapture(captureId);
    const status = typeof json.status === "string" ? json.status : "REFUND_PENDING";
    const id = typeof json.id === "string" ? json.id : "";
    const amount = (json.amount ?? {}) as { value?: unknown; currency_code?: unknown };
    const cents = typeof amount.value === "string" ? parseAmountToCents(amount.value) : 0;
    const currency = (typeof amount.currency_code === "string" ? amount.currency_code : "USD") as Currency;
    return Response.json({ ok: true, status, refundId: id, amountCents: Number.isFinite(cents) ? cents : 0, currency });
  } catch (e) {
    if (e instanceof PayPalError) {
      return fail("paypal_error", `PayPal sandbox error: ${e.message}`.slice(0, 300), e.debugId);
    }
    return fail("internal_error", "The sandbox refund failed unexpectedly. Try again from the Ledger tab.");
  }
}
