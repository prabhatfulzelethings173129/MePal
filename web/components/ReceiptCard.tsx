"use client";

import { useState } from "react";
import { appendEntry } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { ApiError, downloadJson, newId, postJson } from "@/lib/storage";
import type { LedgerEntry, RefundResp, VerifyResp } from "@/lib/types";
import { Btn, Chip, ErrorNote, Money, Panel } from "./ui";

export function ReceiptCard({ entry, refunds, onChanged }: { entry: LedgerEntry; refunds: LedgerEntry[]; onChanged: () => void }) {
  const [verifyMsg, setVerifyMsg] = useState<{ tone: "ok" | "bad" | "warn"; text: string } | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    const orderId = entry.paypal?.orderId;
    if (!orderId) {
      setVerifyMsg({ tone: "warn", text: "This receipt has no PayPal order id." });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await postJson<VerifyResp>("/api/paypal/verify", { orderId });
      if (entry.seal && r.seal === entry.seal) {
        setVerifyMsg({ tone: "ok", text: `Seal matches: PayPal live status ${r.status}, ${formatMoney(r.capturedCents, r.currency)} captured.` });
      } else {
        setVerifyMsg({ tone: "bad", text: `Seal mismatch: live PayPal data differs from the sealed receipt (live status ${r.status}).` });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Verify failed.");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!confirmUndo) {
      setConfirmUndo(true);
      return;
    }
    const orderId = entry.paypal?.orderId;
    const captureId = entry.paypal?.captureId;
    if (!orderId || !captureId) {
      setError("This receipt has no PayPal capture id, so it cannot be refunded here.");
      setConfirmUndo(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await postJson<RefundResp>("/api/paypal/refund", { orderId, captureId });
      await appendEntry({
        id: newId("rfd"),
        type: "refund",
        createdAt: new Date().toISOString(),
        purchaseId: entry.id,
        paypal: { refundId: r.refundId, status: r.status, amountCents: r.amountCents, currency: r.currency, env: "sandbox" },
      });
      setVerifyMsg({ tone: "ok", text: `Refunded ${formatMoney(r.amountCents, r.currency)} (sandbox), refund id ${r.refundId}.` });
      setConfirmUndo(false);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Refund failed.");
      setConfirmUndo(false);
    } finally {
      setBusy(false);
    }
  }

  const refunded = refunds.length > 0;

  if (entry.type === "audit" && entry.audit) {
    const a = entry.audit;
    return (
      <article className="rounded-2xl border border-[#1f2b46] bg-[#111a2e] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="ai">AUDIT</Chip>
          <span className="num text-xs text-[#8da2c8]">{new Date(entry.createdAt).toLocaleString()}</span>
        </div>
        <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          <span className="text-[#8da2c8]">
            Advertised <Money cents={a.advertisedCents} currency={a.currency} className="text-[#e8eefc]" />
          </span>
          <span className="text-[#8da2c8]">
            Would pay <Money cents={a.totalCents} currency={a.currency} className="text-[#ef4b5f]" />
          </span>
          <span className="text-[#8da2c8]">
            Hidden <Money cents={a.hiddenCents} currency={a.currency} className="text-[#ef4b5f]" />
          </span>
          <span className="num text-[#8da2c8]">
            Honesty {a.honestyScore}/100 grade <span className="font-bold text-[#e8eefc]">{a.grade}</span>
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={() => downloadJson(`mepal-audit-${entry.id}.json`, entry)} className="text-xs">
            Download receipt JSON
          </Btn>
        </div>
      </article>
    );
  }

  if (entry.type === "refund" && entry.paypal) {
    return (
      <article className="rounded-2xl border border-[#1f2b46] bg-[#111a2e] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="warn">REFUND</Chip>
          <span className="num text-xs text-[#8da2c8]">{new Date(entry.createdAt).toLocaleString()}</span>
        </div>
        <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          <span className="text-[#8da2c8]">
            Amount <Money cents={entry.paypal.amountCents} currency={entry.paypal.currency} className="text-[#e8eefc]" />
          </span>
          <span className="text-[#8da2c8]">
            Status <span className="num text-[#e8eefc]">{entry.paypal.status}</span>
          </span>
          <span className="num text-[#8da2c8]">refund {entry.paypal.refundId ?? "\u2013"}</span>
          <span className="num text-[#8da2c8]">purchase {entry.purchaseId ?? "\u2013"}</span>
        </div>
      </article>
    );
  }

  // purchase
  const truth = entry.truth;
  return (
    <article className="rounded-2xl border border-[#1f2b46] bg-[#111a2e] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="paypal">PURCHASE</Chip>
        <span className="text-sm font-semibold text-[#e8eefc]">{entry.merchant?.name ?? "Store"}</span>
        {refunded && <Chip tone="ok">Refunded {formatMoney(refunds.reduce((a, r) => a + (r.paypal?.amountCents ?? 0), 0))}</Chip>}
        <span className="num ml-auto text-xs text-[#8da2c8]">{new Date(entry.createdAt).toLocaleString()}</span>
      </div>

      <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
        <span className="text-[#8da2c8]">
          Total <Money cents={truth?.evaluatedTotalCents ?? entry.paypal?.amountCents ?? 0} className="font-semibold text-[#e8eefc]" />
        </span>
        <span className="text-[#8da2c8]">
          Verdict <span className="num text-[#e8eefc]">{entry.guard?.verdict.replaceAll("_", " ") ?? "\u2013"}</span>
          {entry.exceptionApproved ? " (exception approved)" : ""}
        </span>
        <span className="num text-[#8da2c8]">
          Honesty {truth?.honestyScore ?? "\u2013"}/100 grade <span className="font-bold text-[#e8eefc]">{truth?.grade ?? "\u2013"}</span>
        </span>
        <span className="text-[#8da2c8]">
          Surprise avoided{" "}
          <span className="num text-[#22c7a0]">+{formatMoney(entry.naive?.surpriseCents ?? 0)}</span> on the naive pick
        </span>
        <span className="num text-[#8da2c8]">PayPal order {entry.paypal?.orderId ?? "\u2013"}</span>
        <span className="num text-[#8da2c8]">capture {entry.paypal?.captureId ?? "\u2013"}</span>
      </div>

      {verifyMsg && (
        <p className={`mt-2 rounded-lg border px-3 py-2 text-xs ${verifyMsg.tone === "ok" ? "border-[#1d4a3f] bg-[#0f2f28] text-[#22c7a0]" : verifyMsg.tone === "bad" ? "border-[#5c2229] bg-[#331419] text-[#ef4b5f]" : "border-[#5a431a] bg-[#33270d] text-[#f5a524]"}`}>
          {verifyMsg.text}
        </p>
      )}
      <div className="mt-2">
        <ErrorNote error={error} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Btn variant="ghost" onClick={() => void verify()} disabled={busy} className="text-xs">
          Verify with PayPal
        </Btn>
        {!refunded && (
          <Btn variant={confirmUndo ? "danger" : "ghost"} onClick={() => void undo()} disabled={busy} className="text-xs">
            {confirmUndo ? "Really refund? Click again" : "Undo purchase (sandbox refund)"}
          </Btn>
        )}
        <Btn variant="ghost" onClick={() => downloadJson(`mepal-receipt-${entry.id}.json`, entry)} className="text-xs">
          Download receipt JSON
        </Btn>
      </div>
    </article>
  );
}
