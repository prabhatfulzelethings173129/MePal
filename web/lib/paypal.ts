import { parseAmountToCents, toDecimalString } from "./money";
import type { QuoteTokenPayload } from "./types";

// PayPal base URL is HARD-CODED to sandbox. This app must never call live.
const BASE = "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  status: number;
  name: string;
  details?: string;
  debugId?: string;

  constructor(status: number, name: string, message: string, details?: string, debugId?: string) {
    super(message);
    this.status = status;
    this.name = name;
    this.details = details;
    this.debugId = debugId;
  }
}

export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

let tokenCache: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (!paypalConfigured()) {
    throw new PayPalError(0, "CONFIGURATION", "PayPal sandbox is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to web/.env.local and restart the server.");
  }
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.value;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new PayPalError(0, "NETWORK", "Could not reach the PayPal sandbox API. Check your network and try again.");
  }
  if (!res.ok) {
    throw new PayPalError(res.status, "AUTH_FAILED", `PayPal OAuth failed (HTTP ${res.status}). Check the sandbox client id and secret in .env.local.`, undefined, res.headers.get("paypal-debug-id") ?? undefined);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (typeof data.access_token !== "string" || typeof data.expires_in !== "number") {
    throw new PayPalError(res.status, "AUTH_FAILED", "PayPal OAuth returned an unexpected response.");
  }
  tokenCache = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return tokenCache.value;
}

interface PpFetchOpts {
  method?: string;
  body?: unknown;
  requestId?: string;
  preferRepresentation?: boolean;
}

async function ppFetch(path: string, opts: PpFetchOpts = {}): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (opts.requestId) headers["PayPal-Request-Id"] = opts.requestId;
  if (opts.preferRepresentation) headers["Prefer"] = "return=representation";
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new PayPalError(0, "NETWORK", "Could not reach the PayPal sandbox API. Check your network and try again.");
  }
  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = {};
    }
  }
  if (!res.ok) {
    const errName = typeof json.name === "string" ? json.name : "PAYPAL_ERROR";
    const errMessage = typeof json.message === "string" ? json.message : `PayPal returned HTTP ${res.status}`;
    const details = Array.isArray(json.details)
      ? (json.details as unknown[]).map(d => JSON.stringify(d)).join("; ").slice(0, 400)
      : undefined;
    throw new PayPalError(res.status, errName, errMessage, details, res.headers.get("paypal-debug-id") ?? undefined);
  }
  return json;
}

function asObj(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : [];
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export interface OrderView {
  id: string;
  status: string;
  customId: string | null;
  amountValue: string | null;
  currency: string | null;
  captureId: string | null;
  captureStatus: string | null;
  capturedValue: string | null;
  capturedCurrency: string | null;
}

export function readOrder(json: Record<string, unknown>): OrderView {
  const pu = asArray(json.purchase_units)[0] ?? {};
  const amount = asObj(pu.amount);
  const payments = asObj(pu.payments);
  const cap = asArray(payments.captures)[0] ?? {};
  const capAmount = asObj(cap.amount);
  return {
    id: str(json.id) ?? "",
    status: str(json.status) ?? "UNKNOWN",
    customId: str(pu.custom_id),
    amountValue: str(amount.value),
    currency: str(amount.currency_code),
    captureId: str(cap.id),
    captureStatus: str(cap.status),
    capturedValue: str(capAmount.value),
    capturedCurrency: str(capAmount.currency_code),
  };
}

export interface CreateOrderResult {
  orderId: string;
  approveUrl: string;
}

function approveUrlOf(json: Record<string, unknown>): string {
  const links = asArray(json.links);
  const payerAction = links.find(l => str(l.rel) === "payer-action");
  const approve = links.find(l => str(l.rel) === "approve");
  const href = str(payerAction?.href) ?? str(approve?.href) ?? links.find(l => typeof str(l.href) === "string")?.href;
  if (typeof href === "string" && href.startsWith("https://")) return href;
  throw new PayPalError(200, "NO_APPROVE_URL", "PayPal did not return an approval link for this order.");
}

export function buildOrderBody(payload: QuoteTokenPayload, baseUrlApp: string, includeItems: boolean): Record<string, unknown> {
  const total = payload.lines.reduce((a, l) => a + l.cents, 0);
  const byKind = (kinds: string[]) => payload.lines.filter(l => kinds.includes(l.kind)).reduce((a, l) => a + l.cents, 0);
  const itemTotal = byKind(["item"]);
  const shipping = byKind(["shipping"]);
  const handling = byKind(["fee"]);
  const insurance = byKind(["addon"]);
  const tax = byKind(["tax"]);
  const money = (c: number) => ({ currency_code: "USD", value: toDecimalString(c) });
  const pu: Record<string, unknown> = {
    reference_id: payload.qid,
    custom_id: payload.qid,
    invoice_id: `MEPAL-${payload.qid}`,
    description: "MePal guarded purchase (demo store, nothing ships)",
    amount: {
      currency_code: "USD",
      value: toDecimalString(total),
      breakdown: {
        item_total: money(itemTotal),
        shipping: money(shipping),
        handling: money(handling),
        insurance: money(insurance),
        tax_total: money(tax),
      },
    },
  };
  if (includeItems) {
    pu.items = payload.lines
      .filter(l => l.kind === "item")
      .map(l => ({
        name: l.label.slice(0, 127),
        quantity: String(payload.qty),
        unit_amount: { currency_code: "USD", value: toDecimalString(Math.round(l.cents / payload.qty)) },
        sku: payload.sku,
      }));
  }
  return {
    intent: "CAPTURE",
    purchase_units: [pu],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "MePal",
          locale: "en-US",
          landing_page: "LOGIN",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          return_url: `${baseUrlApp}/return`,
          cancel_url: `${baseUrlApp}/?cancelled=1`,
        },
      },
    },
  };
}

export async function createOrder(payload: QuoteTokenPayload, appBaseUrl: string): Promise<CreateOrderResult> {
  let json: Record<string, unknown>;
  try {
    json = await ppFetch("/v2/checkout/orders", {
      method: "POST",
      body: buildOrderBody(payload, appBaseUrl, true),
      requestId: `${payload.qid}-create`,
      preferRepresentation: true,
    });
  } catch (e) {
    if (e instanceof PayPalError && e.status === 422) {
      console.log(`[MePal] PayPal 422 on create-order for ${payload.qid}; retrying once without items array`);
      json = await ppFetch("/v2/checkout/orders", {
        method: "POST",
        body: buildOrderBody(payload, appBaseUrl, false),
        requestId: `${payload.qid}-create-2`,
        preferRepresentation: true,
      });
    } else {
      throw e;
    }
  }
  return { orderId: str(json.id) ?? "", approveUrl: approveUrlOf(json) };
}

export async function getOrder(orderId: string): Promise<Record<string, unknown>> {
  return ppFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

export async function captureOrder(orderId: string, qid: string): Promise<Record<string, unknown>> {
  return ppFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    requestId: `${qid}-capture`,
    preferRepresentation: true,
  });
}

export async function refundCapture(captureId: string): Promise<Record<string, unknown>> {
  return ppFetch(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    method: "POST",
    requestId: `${captureId}-refund`,
    body: { note_to_payer: "Refund requested via MePal Undo" },
    preferRepresentation: true,
  });
}

export function parseMoneyOrZero(value: string | null): number {
  if (value === null) return 0;
  const cents = parseAmountToCents(value);
  return Number.isFinite(cents) && cents > 0 ? cents : 0;
}
