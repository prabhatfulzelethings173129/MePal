import { createHmac, timingSafeEqual } from "node:crypto";
import { quoteTotal } from "./catalog";
import type { Quote, QuoteTokenPayload } from "./types";

export const SIGN_TTL_MS = 10 * 60 * 1000;

function serverSecret(): string | null {
  return process.env.MEPAL_SIGNING_SECRET || process.env.PAYPAL_CLIENT_SECRET || null;
}

export function signingConfigured(): boolean {
  return serverSecret() !== null;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function hmac(payload: string): string {
  return b64url(createHmac("sha256", serverSecret() as string).update(payload).digest());
}

export function quoteToken(q: Quote): QuoteTokenPayload {
  return {
    v: 1,
    qid: q.qid,
    merchantId: q.merchantId,
    sku: q.sku,
    qty: q.qty,
    currency: q.currency,
    lines: q.lines.map(l => ({ id: l.id, label: l.label, kind: l.kind, cents: l.cents })),
    totalCents: quoteTotal(q),
    exp: Date.now() + SIGN_TTL_MS,
  };
}

export function signQuote(payload: QuoteTokenPayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${hmac(body)}`;
}

export type VerifyResult =
  | { ok: true; payload: QuoteTokenPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "no_secret" };

export function verifyQuote(token: string): VerifyResult {
  if (!serverSecret()) return { ok: false, reason: "no_secret" };
  const parts = token.split(".");
  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
    return { ok: false, reason: "malformed" };
  }
  const [body, sig] = parts;
  const expected = Buffer.from(hmac(body), "utf8");
  const provided = Buffer.from(sig, "utf8");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return { ok: false, reason: "bad_signature" };
  }
  let payload: QuoteTokenPayload;
  try {
    const parsed = JSON.parse(fromB64url(body).toString("utf8")) as QuoteTokenPayload;
    if (parsed.v !== 1 || typeof parsed.totalCents !== "number" || !Array.isArray(parsed.lines)) {
      return { ok: false, reason: "malformed" };
    }
    payload = parsed;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}

// Deterministic seal over receipt facts; recomputed later to re-verify against PayPal live data.
export function hmacSeal(text: string): string {
  return hmac(text);
}
