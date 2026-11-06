import type { Currency } from "./types";

const SYMBOLS: Record<Currency, string> = {
  USD: "$",
  INR: "\u20B9",
  EUR: "\u20AC",
  GBP: "\u00A3",
};

export function toDecimalString(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return neg ? `-${s}` : s;
}

export function formatMoney(cents: number, currency: Currency = "USD"): string {
  return `${SYMBOLS[currency]}${toDecimalString(cents)}`;
}

// Integer-only parse of a human amount like "59.00", "1,299.5", "$40", "-3.20".
// Accepts an optional leading currency symbol/code. Returns NaN when unparseable.
export function parseAmountToCents(raw: string): number {
  const cleaned = raw
    .trim()
    .replace(/^(rs\.?|inr|usd|eur|gbp)/i, "")
    .replace(/[\u20B9$\u20AC\u00A3]/g, "")
    .replace(/\s+/g, "");
  const m = /^(-?)([\d][\d,]*)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return NaN;
  const whole = parseInt(m[2].replace(/,/g, ""), 10);
  if (!Number.isFinite(whole)) return NaN;
  const frac = m[3] ? parseInt((m[3] + "00").slice(0, 2), 10) : 0;
  const cents = whole * 100 + frac;
  return m[1] === "-" ? -cents : cents;
}

export function pctText(pct: number): string {
  return `${(Math.round(pct * 10) / 10).toFixed(1)}%`;
}
