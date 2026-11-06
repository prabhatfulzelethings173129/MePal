import type { CleanResult, Currency, Quote, QuoteFlags, QuoteLine } from "./types";

export interface Product {
  sku: string;
  name: string;
  baseCents: number;
  keywords: string[];
}

export const PRODUCTS: Product[] = [
  { sku: "hub", name: "USB-C 7-in-1 Hub", baseCents: 3400, keywords: ["usb-c", "usb c", "hub", "dock", "adapter"] },
  { sku: "mouse", name: "Wireless Mouse", baseCents: 1850, keywords: ["mouse"] },
  { sku: "powerbank", name: "20,000 mAh Power Bank", baseCents: 2900, keywords: ["power bank", "powerbank", "battery pack", "mah"] },
  { sku: "stand", name: "Aluminium Laptop Stand", baseCents: 2400, keywords: ["stand", "riser"] },
  { sku: "keyboard", name: "Mechanical Keyboard", baseCents: 8200, keywords: ["keyboard"] },
];

export function productBySku(sku: string): Product | null {
  return PRODUCTS.find(p => p.sku === sku) ?? null;
}

export function matchProduct(text: string): Product | null {
  const t = text.toLowerCase();
  for (const p of PRODUCTS) {
    if (p.keywords.some(k => t.includes(k))) return p;
  }
  return null;
}

export interface FeeSpec {
  id: string;
  label: string;
  cents?: number;
  pctOfItem?: number;
  minCents?: number;
}

export interface MerchantSpec {
  id: string;
  name: string;
  tier: "honest" | "drip" | "sneaky";
  blurb: string;
  priceMult: number;
  shippingCents: number;
  fees: FeeSpec[];
  addons: { id: string; label: string; cents: number }[];
  falseUrgency: boolean;
  urgencyText?: string;
  trialAutoRenew: boolean;
}

export const MERCHANTS: MerchantSpec[] = [
  {
    id: "truemart",
    name: "TrueMart",
    tier: "honest",
    blurb: "Shelf price is the price. Free shipping, no extras.",
    priceMult: 1.0,
    shippingCents: 0,
    fees: [],
    addons: [],
    falseUrgency: false,
    trialAutoRenew: false,
  },
  {
    id: "quickkart",
    name: "QuickKart",
    tier: "drip",
    blurb: "Low sticker, fees drip in step by step.",
    priceMult: 0.8,
    shippingCents: 499,
    fees: [
      { id: "convenience", label: "Convenience fee", cents: 349 },
      { id: "packaging", label: "Packaging fee", cents: 199 },
    ],
    addons: [{ id: "priority", label: "Priority handling", cents: 299 }],
    falseUrgency: true,
    urgencyText: "Only 2 left! Offer ends in 09:59",
    trialAutoRenew: false,
  },
  {
    id: "bargainbay",
    name: "BargainBay",
    tier: "sneaky",
    blurb: "Extras quietly pre-ticked in your basket.",
    priceMult: 0.9,
    shippingCents: 299,
    fees: [{ id: "service", label: "Service fee", pctOfItem: 4, minCents: 150 }],
    addons: [
      { id: "warranty", label: "Extended warranty", cents: 599 },
      { id: "bayplus", label: "BayPlus 7-day free trial", cents: 0 },
    ],
    falseUrgency: false,
    trialAutoRenew: true,
  },
];

export function merchantSpec(id: string): MerchantSpec | null {
  return MERCHANTS.find(m => m.id === id) ?? null;
}

export function buildQuote(merchantId: string, sku: string, qty: number): Quote {
  const m = merchantSpec(merchantId);
  const p = productBySku(sku);
  if (!m || !p) throw new Error(`unknown merchant or sku: ${merchantId}/${sku}`);
  const n = Math.max(1, Math.min(5, Math.round(qty)));
  const unit = Math.round(p.baseCents * m.priceMult);
  const itemTotal = unit * n;
  const lines: QuoteLine[] = [
    { id: "item", label: `${p.name} \u00D7 ${n}`, kind: "item", cents: itemTotal, revealedAtStage: 1, mandatory: true, preselected: false },
  ];
  if (m.shippingCents > 0) {
    lines.push({ id: "shipping", label: "Shipping", kind: "shipping", cents: m.shippingCents, revealedAtStage: 2, mandatory: true, preselected: false });
  } else {
    lines.push({ id: "shipping", label: "Shipping (free)", kind: "shipping", cents: 0, revealedAtStage: 1, mandatory: true, preselected: false });
  }
  for (const f of m.fees) {
    const cents =
      f.cents !== undefined
        ? f.cents
        : Math.max(f.minCents ?? 0, Math.round(((f.pctOfItem ?? 0) / 100) * itemTotal));
    lines.push({ id: f.id, label: f.label, kind: "fee", cents, revealedAtStage: 3, mandatory: true, preselected: false });
  }
  for (const a of m.addons) {
    lines.push({ id: a.id, label: a.label, kind: "addon", cents: a.cents, revealedAtStage: 3, mandatory: false, preselected: true });
  }
  lines.push({ id: "tax", label: "Tax (8%)", kind: "tax", cents: Math.round(0.08 * itemTotal), revealedAtStage: 2, mandatory: true, preselected: false });
  const flags: QuoteFlags = { falseUrgency: m.falseUrgency, trialAutoRenew: m.trialAutoRenew };
  const q: Quote = {
    qid: `${m.id}-${sku}-${n}`,
    merchantId: m.id,
    sku,
    qty: n,
    currency: "USD" as Currency,
    lines,
    flags,
  };
  if (m.urgencyText) q.urgencyText = m.urgencyText;
  return q;
}

export function cleanQuote(q: Quote): CleanResult {
  const stripped = q.lines.filter(l => l.kind === "addon" && l.preselected && !l.mandatory);
  const kept = q.lines.filter(l => !(l.kind === "addon" && l.preselected && !l.mandatory));
  return {
    quote: { ...q, lines: kept },
    strippedCents: stripped.reduce((a, l) => a + l.cents, 0),
    strippedCount: stripped.length,
  };
}

export function quoteTotal(q: Quote): number {
  return q.lines.reduce((a, l) => a + l.cents, 0);
}
