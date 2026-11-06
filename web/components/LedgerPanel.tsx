"use client";

import { useCallback, useEffect, useState } from "react";
import { loadLedger, verifyChain } from "@/lib/ledger";
import { downloadJson, removeKey } from "@/lib/storage";
import type { ChainStatus, LedgerEntry } from "@/lib/types";
import { ReceiptCard } from "./ReceiptCard";
import { Btn, Chip, Panel } from "./ui";

export function LedgerPanel({ onChanged }: { onChanged: () => void }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [chain, setChain] = useState<ChainStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const e = loadLedger();
    setEntries(e);
    setChain(await verifyChain(e));
    setLoaded(true);
    onChanged();
  }, [onChanged]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const refunds = entries.filter(e => e.type === "refund");
  const purchases = entries.filter(e => e.type === "purchase");
  const audits = entries.filter(e => e.type === "audit");
  const orphanRefunds = refunds.filter(r => !purchases.some(p => p.id === r.purchaseId));

  return (
    <div className="fade-up space-y-4">
      <Panel
        title="Proof ledger"
        subtitle="Every purchase, refund and audit is hash-chained on this device and sealed only after PayPal confirms."
        right={
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => downloadJson("mepal-ledger.json", entries)} disabled={entries.length === 0} className="text-xs">
              Export ledger JSON
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => {
                if (window.confirm("Delete all MePal receipts on this device? This cannot be undone.")) {
                  removeKey("mepal:ledger:v1");
                  void reload();
                }
              }}
              disabled={entries.length === 0}
              className="text-xs"
            >
              Reset ledger
            </Btn>
          </div>
        }
      >
        {chain === null || !loaded ? (
          <p className="text-sm text-[#8da2c8]">Checking the chain{"\u2026"}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-[#8da2c8]">
            No receipts yet. Run an errand (Errand tab) or an audit (Auditor tab) and they will be sealed here.
          </p>
        ) : chain.ok ? (
          <Chip tone="ok">{"\u2713"} Chain valid {"\u00B7"} {entries.length} entries {"\u00B7"} SHA-256 hash-linked</Chip>
        ) : (
          <Chip tone="bad">{"\u2717"} Chain BROKEN at entry #{(chain.brokenAtIndex ?? -1) + 1}: local data was edited outside MePal</Chip>
        )}
      </Panel>

      {purchases.length > 0 && (
        <div className="space-y-3">
          {[...purchases].reverse().map(p => (
            <ReceiptCard key={p.id} entry={p} refunds={refunds.filter(r => r.purchaseId === p.id)} onChanged={() => void reload()} />
          ))}
        </div>
      )}
      {orphanRefunds.length > 0 && (
        <div className="space-y-3">
          {orphanRefunds.map(r => (
            <ReceiptCard key={r.id} entry={r} refunds={[]} onChanged={() => void reload()} />
          ))}
        </div>
      )}
      {audits.length > 0 && (
        <div className="space-y-3">
          {[...audits].reverse().map(a => (
            <ReceiptCard key={a.id} entry={a} refunds={[]} onChanged={() => void reload()} />
          ))}
        </div>
      )}
    </div>
  );
}
