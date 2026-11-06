"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ReceiptCard } from "@/components/ReceiptCard";
import { Timeline, type StepStatus, type StepView } from "@/components/Timeline";
import { appendEntry, loadLedger } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { ApiError, KEYS, loadJson, newId, postJson, removeKey } from "@/lib/storage";
import type { CaptureResp, LedgerEntry, PendingPayment, VerifyResp } from "@/lib/types";
import { Btn, Chip, ErrorNote, Money, Panel } from "@/components/ui";

type Phase = "starting" | "capturing" | "verifying" | "sealing" | "done" | "missing" | "blocked" | "error";
type StepId = "capture" | "verify" | "seal";

function stepStatus(phase: Phase, failedAt: StepId | null, mine: StepId): StepStatus {
  const order: Record<StepId, number> = { capture: 0, verify: 1, seal: 2 };
  const idx = order[mine];
  if (phase === "done") return "done";
  if (phase === "starting" || phase === "missing") return "waiting";
  if (phase === "error" || phase === "blocked") {
    if (failedAt === null || order[failedAt] === undefined) return "error";
    return idx < order[failedAt] ? "done" : idx === order[failedAt] ? "error" : "waiting";
  }
  const phaseIdx = phase === "capturing" ? 0 : phase === "verifying" ? 1 : 2;
  if (idx < phaseIdx) return "done";
  if (idx === phaseIdx) return "running";
  return "waiting";
}

export default function ReturnPage() {
  const [phase, setPhase] = useState<Phase>("starting");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [receipt, setReceipt] = useState<LedgerEntry | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);
  const [failedAt, setFailedAt] = useState<StepId | null>(null);

  const run = useCallback(async (oid: string, pend: PendingPayment) => {
    setError(null);
    setStatusLine(null);
    setFailedAt("capture");
    setPhase("capturing");
    try {
      const cap = await postJson<CaptureResp>("/api/paypal/capture", { orderId: oid, token: pend.token });
      setStatusLine(`PayPal status ${cap.status} \u00B7 capture ${cap.captureId ?? "pending"} \u00B7 ${formatMoney(cap.capturedCents, cap.currency)}`);
      setFailedAt("verify");
      setPhase("verifying");
      const ver = await postJson<VerifyResp>("/api/paypal/verify", { orderId: oid });
      setFailedAt("seal");
      setPhase("sealing");

      const existing = loadLedger();
      const dup = existing.find(e => e.type === "purchase" && e.paypal?.orderId === oid);
      let entry: LedgerEntry;
      if (dup) {
        entry = dup;
      } else {
        entry = await appendEntry({
          id: newId("pur"),
          type: "purchase",
          createdAt: new Date().toISOString(),
          errandText: pend.errandText,
          mandate: pend.mandate,
          merchant: pend.merchant,
          items: [{ name: pend.product.name, qty: pend.qty }],
          truth: pend.truth,
          guard: pend.guard,
          exceptionApproved: pend.exceptionApproved,
          naive: pend.naive,
          paypal: {
            orderId: oid,
            captureId: cap.captureId ?? ver.captureId ?? undefined,
            status: cap.status,
            amountCents: cap.capturedCents,
            currency: cap.currency,
            env: "sandbox",
          },
          seal: ver.seal,
        });
      }
      removeKey(KEYS.pending);
      setPending(null);
      setReceipt(entry);
      setPhase("done");
    } catch (e) {
      if (e instanceof ApiError && ["not_approved", "order_mismatch", "quote_expired", "bad_token", "blocked"].includes(e.code)) {
        setError({ message: e.message, details: e.details });
        setPhase("blocked");
        return;
      }
      setError({
        message: e instanceof ApiError ? e.message : "Something went wrong while finishing the payment.",
        details: e instanceof ApiError ? e.details : undefined,
      });
      setPhase("error");
    }
  }, []);

  const checkStatus = useCallback(async (oid: string) => {
    setError(null);
    try {
      const r = await postJson<VerifyResp>("/api/paypal/verify", { orderId: oid });
      setStatusLine(`PayPal order ${oid}: status ${r.status}${r.captureId ? `, capture ${r.captureId}` : ""}, ${formatMoney(r.capturedCents, r.currency)}`);
    } catch (e) {
      setError({ message: e instanceof ApiError ? e.message : "Checking the order failed.", details: e instanceof ApiError ? e.details : undefined });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oid = params.get("token");
    const pend = loadJson<PendingPayment | null>(KEYS.pending, null);
    setOrderId(oid);
    setPending(pend && oid && pend.orderId === oid ? pend : null);
    if (!oid) {
      setPhase("missing");
      return;
    }
    if (!pend || pend.orderId !== oid) {
      setPhase("missing");
      return;
    }
    void run(oid, pend);
  }, [run]);

  const steps: StepView[] = [
    { key: "capture", label: "Capturing payment", who: "PAYPAL", status: stepStatus(phase, failedAt, "capture"), note: statusLine ?? undefined },
    { key: "verify", label: "Verifying with PayPal", who: "PAYPAL", status: stepStatus(phase, failedAt, "verify") },
    { key: "seal", label: "Sealing proof receipt", who: "CODE", status: stepStatus(phase, failedAt, "seal") },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-[#e8eefc]">Proof and Undo</h1>
        <Link href="/" className="text-sm text-[#4aa3e8] underline-offset-2 hover:underline">
          Back to MePal
        </Link>
      </div>
      <Chip tone="warn">Sandbox demo {"\u00B7"} nothing ships {"\u00B7"} no real money</Chip>

      <Panel title="Finishing your guarded purchase" subtitle="MePal captures, verifies against PayPal live data, then seals the receipt into your local hash chain.">
        <Timeline steps={steps} />
        <div className="mt-3 space-y-2">
          <ErrorNote error={error?.message} details={error?.details} />
        </div>
        {phase === "capturing" || phase === "verifying" || phase === "sealing" ? (
          <p className="mt-3 text-xs text-[#8da2c8]">Keep this tab open; this takes a few seconds.</p>
        ) : null}
        {(phase === "error" || phase === "blocked") && pending && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn onClick={() => orderId && pending && void run(orderId, pending)}>Retry</Btn>
            <Btn variant="ghost" onClick={() => orderId && void checkStatus(orderId)}>
              Check order status
            </Btn>
          </div>
        )}
      </Panel>

      {phase === "done" && receipt && (
        <Panel title="Proof Receipt" subtitle="Sealed after PayPal confirmed the capture. Stored in your local hash-chained ledger.">
          <div className="mb-3 flex flex-wrap gap-2">
            <Chip tone="ok">{"\u2713"} Captured (sandbox)</Chip>
            <Chip tone="paypal">Verified live against PayPal</Chip>
            <Chip tone="code">Sealed into hash chain</Chip>
          </div>
          <ReceiptCard entry={receipt} refunds={[]} onChanged={() => undefined} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/?tab=ledger"
              className="rounded-lg border border-[#1f2b46] px-3.5 py-2 text-sm font-semibold text-[#cdd9f2] hover:border-[#2a8de0]"
            >
              Open ledger
            </Link>
            <Link href="/" className="rounded-lg bg-[#0070ba] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#2a8de0]">
              Back to MePal
            </Link>
          </div>
        </Panel>
      )}

      {phase === "missing" && (
        <Panel title="No pending payment found on this device">
          <p className="text-sm text-[#8da2c8]">
            MePal keeps the pending payment in this browser only. If you approved on a different browser or the local data was
            cleared, the receipt cannot be rebuilt here, but the order itself is fine.{" "}
            {orderId && (
              <>
                PayPal order id: <span className="num text-[#e8eefc]">{orderId}</span>.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {orderId && <Btn onClick={() => void checkStatus(orderId)}>Check order status</Btn>}
            <Link href="/" className="rounded-lg border border-[#1f2b46] px-3.5 py-2 text-sm font-semibold text-[#cdd9f2] hover:border-[#2a8de0]">
              Back to MePal
            </Link>
          </div>
          {statusLine && <p className="num mt-3 text-sm text-[#22c7a0]">{statusLine}</p>}
        </Panel>
      )}
    </main>
  );
}
