export type Currency = "USD" | "INR" | "EUR" | "GBP";
export type LineKind = "item" | "shipping" | "fee" | "addon" | "tax" | "discount";
export type AuditLineKind = LineKind | "total";
export type DarkPattern =
  | "drip_pricing"
  | "basket_sneaking"
  | "false_urgency"
  | "subscription_trap"
  | "price_change";

export interface QuoteLine {
  id: string;
  label: string;
  kind: LineKind;
  cents: number;
  revealedAtStage: 1 | 2 | 3;
  mandatory: boolean;
  preselected: boolean;
}

export interface QuoteFlags {
  falseUrgency: boolean;
  trialAutoRenew: boolean;
}

export interface Quote {
  qid: string;
  merchantId: string;
  sku: string;
  qty: number;
  currency: Currency;
  lines: QuoteLine[];
  flags: QuoteFlags;
  urgencyText?: string;
}

export interface CleanResult {
  quote: Quote;
  strippedCents: number;
  strippedCount: number;
}

export interface CreepPoint {
  stage: 1 | 2 | 3;
  label: string;
  cumulativeCents: number;
}

export interface TruthReport {
  stickerCents: number;
  rawTotalCents: number;
  evaluatedTotalCents: number;
  hiddenRawCents: number;
  hiddenRawPct: number;
  hiddenEvalCents: number;
  hiddenEvalPct: number;
  strippedCents: number;
  strippedCount: number;
  tags: DarkPattern[];
  honestyScore: number;
  grade: string;
  creep: CreepPoint[];
}

export type Verdict = "FAST" | "CONFIRM" | "NEEDS_EXCEPTION" | "BLOCK";

export interface GuardRule {
  id: string;
  label: string;
  passed: boolean;
  hard: boolean;
  detail: string;
}

export interface GuardResult {
  verdict: Verdict;
  rules: GuardRule[];
}

export interface Mandate {
  maxTotalCents: number;
  maxHiddenFeePct: number;
  minHonestyScore: number;
  blockPreselectedAddons: boolean;
  confirmAboveCents: number;
}

export interface Merchant {
  id: string;
  name: string;
  tier: string;
  blurb: string;
}

export interface Product {
  sku: string;
  name: string;
}

export interface TokenLine {
  id: string;
  label: string;
  kind: LineKind;
  cents: number;
}

export interface QuoteTokenPayload {
  v: 1;
  qid: string;
  merchantId: string;
  sku: string;
  qty: number;
  currency: Currency;
  lines: TokenLine[];
  totalCents: number;
  exp: number;
}

export interface Offer {
  merchant: Merchant;
  raw: Quote;
  evaluated: Quote;
  truth: TruthReport;
  guard: GuardResult;
  token: string | null;
}

export interface NaivePick {
  merchantId: string;
  stickerCents: number;
  rawTotalCents: number;
}

export interface HuntResult {
  product: Product;
  offers: Offer[];
  naive: NaivePick;
  chosen: { merchantId: string; verdict: Verdict } | null;
  surpriseCents: number;
  savedVsNaiveCents: number;
}

export interface HealthStatus {
  paypal: { configured: boolean; ok: boolean; error?: string };
  llm: { ok: boolean; model?: string };
}

export interface AuditLine {
  id: string;
  label: string;
  kind: AuditLineKind;
  cents: number;
  preselected: boolean;
  stage: 1 | 2 | 3;
}

export interface AuditReport {
  currency: Currency;
  advertisedCents: number;
  lines: AuditLine[];
  itemTotalCents: number;
  totalCents: number;
  statedTotalCents: number | null;
  hiddenCents: number;
  hiddenPct: number;
  avoidableCents: number;
  tags: DarkPattern[];
  honestyScore: number;
  grade: string;
  warnings: string[];
}

export interface NaiveSummary {
  naiveMerchantId: string;
  naiveStickerCents: number;
  naiveRawTotalCents: number;
  surpriseCents: number;
  savedVsNaiveCents: number;
}

export interface TruthSummary {
  stickerCents: number;
  evaluatedTotalCents: number;
  hiddenEvalCents: number;
  honestyScore: number;
  grade: string;
  tags: DarkPattern[];
}

export interface PendingPayment {
  token: string;
  orderId: string;
  errandText: string;
  mandate: Mandate;
  merchant: Merchant;
  product: Product;
  qty: number;
  truth: TruthSummary;
  guard: GuardResult;
  naive: NaiveSummary;
  exceptionApproved: boolean;
  totalCents: number;
  currency: Currency;
}

export type LedgerEntryType = "purchase" | "refund" | "audit";

export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  createdAt: string;
  prevHash: string;
  hash: string;
  errandText?: string;
  mandate?: Mandate;
  merchant?: Merchant;
  items?: { name: string; qty: number }[];
  truth?: TruthSummary;
  guard?: GuardResult;
  exceptionApproved?: boolean;
  naive?: NaiveSummary;
  paypal?: {
    orderId?: string;
    captureId?: string;
    refundId?: string;
    status: string;
    amountCents: number;
    currency: Currency;
    env: "sandbox";
  };
  seal?: string;
  purchaseId?: string;
  audit?: {
    currency: Currency;
    advertisedCents: number;
    totalCents: number;
    hiddenCents: number;
    hiddenPct: number;
    avoidableCents: number;
    honestyScore: number;
    grade: string;
    tags: DarkPattern[];
  };
}

export interface ChainStatus {
  ok: boolean;
  brokenAtIndex: number;
}

export interface ImpactStats {
  purchases: number;
  hiddenAvoidedCents: number;
  audits: number;
  chainOk: boolean;
  entries: number;
}

export type MainTab = "errand" | "auditor" | "mandate" | "ledger";

export interface ErrandInfo {
  sku: string;
  qty: number;
  budgetCents: number | null;
  source: "llm" | "fallback";
  model?: string;
}

export interface ExplainNote {
  note: string;
  source: "llm" | "fallback";
  model?: string;
}

export interface CreateOrderResp {
  orderId: string;
  approveUrl: string;
}

export interface CaptureResp {
  status: string;
  captureId: string | null;
  capturedCents: number;
  currency: Currency;
  alreadyCaptured: boolean;
}

export interface VerifyResp {
  status: string;
  captureId: string | null;
  capturedCents: number;
  currency: Currency;
  seal: string;
}

export interface RefundResp {
  status: string;
  refundId: string;
  amountCents: number;
  currency: Currency;
}

export interface AuditResp {
  report: AuditReport;
  source: "llm" | "fallback";
  model?: string;
}
