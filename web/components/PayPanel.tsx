"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { KEYS, saveJson, postJson, ApiError } from "@/lib/storage";
import type { CreateOrderResp, Mandate, NaivePick, Offer, PendingPayment, Product } from "@/lib/types";
import { Btn, Chip, ErrorNote, Money, Panel } from "./ui";
import type { StepStatus } from "./Timeline";

export function PayPanel({
  offer,
  product,
  naive,
  surpriseCents,
  savedVsNaiveCents,
  mandate,
  errandText,
  errandBudgetCents,
  onPayStep,
  onOpenMandate,
}: {
  offer: Offer;
  product: Product;
  naive: NaivePick;
  surpriseCents: number;
  savedVsNaiveCents: number;
  mandate: Mandate;
  errandText: string;
  errandBudgetCents: number | null;
  onPayStep: (status: StepStatus, note?: string) => void;
  onOpenMandate: () => void;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [exception, setException] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);

  const v = offer.guard.verdict;
  const canPay =
    offer.token !== null &&
    !busy &&
    (v === "FAST" || (v === "CONFIRM" && reviewed) || (v === "NEEDS_EXCEPTION" && exception));

  async function pay() {
    if (!offer.token) return;
    setBusy(true);
    setError(null);
    onPayStep("running");
    try {
      const r = await postJson<CreateOrderResp>("/api/paypal/create-order", {
        token: offer.token,
        mandate,
        errandBudgetCents,
        confirmedByUser: reviewed,
        exceptionApproved: exception,
      });
      const pending: PendingPayment = {
        token: offer.token,
        orderId: r.orderId,
        errandText,
        mandate,
        merchant: offer.merchant,
        product,
        qty: offer.raw.qty,
        truth: {
          stickerCents: offer.truth.stickerCents,
          evaluatedTotalCents: offer.truth.evaluatedTotalCents,
          hiddenEvalCents: offer.truth.hiddenEvalCents,
          honestyScore: offer.truth.honestyScore,
          grade: offer.truth.grade,
          tags: offer.truth.tags,
        },
        guard: offer.guard,
        naive: {
          naiveMerchantId: naive.merchantId,
          naiveStickerCents: naive.stickerCents,
          naiveRawTotalCents: naive.rawTotalCents,
          surpriseCents,
          savedVsNaiveCents,
        },
        exceptionApproved: exception,
        totalCents: offer.truth.evaluatedTotalCents,
        currency: "USD",
      };
      saveJson(KEYS.pending, pending);
      onPayStep("running", "redirecting to PayPal sandbox approval");
      window.location.href = r.approveUrl;
    } catch (e) {
      onPayStep("error", e instanceof ApiError ? e.code : "error");
      setError({
        message: e instanceof ApiError ? e.message : "Starting the PayPal payment failed. Try again.",
        details: e instanceof ApiError ? e.details : undefined,
      });
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Pay with PayPal (sandbox)"
      subtitle="MePal builds the order from the signed quote; the browser never sets amounts."
    >
      <ul className="space-y-1 text-sm">
        {offer.evaluated.lines.map(l => (
          <li key={l.id} className="flex items-center justify-between gap-3 border-b border-[#1f2b46] pb-1">
            <span className="text-[#cdd9f2]">{l.label}</span>
            <Money cents={l.cents} className="text-[#e8eefc]" />
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 pt-1.5">
          <span className="font-semibold text-[#e8eefc]">You pay</span>
          <Money cents={offer.truth.evaluatedTotalCents} className="text-base font-bold text-[#22c7a0]" />
        </li>
      </ul>

      {v === "FAST" && (
        <div className="mt-3">
          <Chip tone="ok">{"\u2713"} Within your mandate: one click</Chip>
        </div>
      )}
      {v === "CONFIRM" && (
        <label className={`mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-[#1f2b46] bg-[#0d1526] p-3 text-sm ${reviewed ? "border-[#1d4a3f]" : ""}`}>
          <input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0070ba]" />
          <span className="text-[#cdd9f2]">I reviewed the full price, including every fee and tax line above.</span>
        </label>
      )}
      {v === "NEEDS_EXCEPTION" && (
        <div className="mt-3 rounded-lg border border-[#5a431a] bg-[#33270d] p-3">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={exception} onChange={e => setException(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#f5a524]" />
            <span className="text-[#f5a524]">
              <b>Approve a one-time exception to my spending limit.</b> This purchase exceeds my mandate total or errand budget.
              Hidden-fee and honesty rules still apply and cannot be overridden.
            </span>
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Btn onClick={() => void pay()} disabled={!canPay}>
          Pay {formatMoney(offer.truth.evaluatedTotalCents)} with PayPal (sandbox)
        </Btn>
        <span className="text-xs text-[#8da2c8]">MePal never sees your PayPal login; approval happens on PayPal.</span>
      </div>

      <div className="mt-3 space-y-2">
        <ErrorNote error={error?.message} details={error?.details} />
        {!offer.token && <Chip tone="bad">No signed quote available: run the errand again.</Chip>}
        <div>
          <button onClick={onOpenMandate} className="text-xs text-[#8da2c8] underline hover:text-[#e8eefc]">
            Change my mandate
          </button>
        </div>
      </div>
    </Panel>
  );
}
