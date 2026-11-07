"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { AuditorPanel } from "@/components/AuditorPanel";
import { ErrandPanel } from "@/components/ErrandPanel";
import { Header } from "@/components/Header";
import { ImpactStrip } from "@/components/ImpactStrip";
import { LedgerPanel } from "@/components/LedgerPanel";
import { MandatePanel } from "@/components/MandatePanel";
import { loadLedger, verifyChain } from "@/lib/ledger";
import { postJson } from "@/lib/storage";
import type { HealthStatus, ImpactStats, MainTab } from "@/lib/types";

const TAB_IDS: MainTab[] = ["errand", "auditor", "mandate", "ledger"];

export default function Page() {
  const [tab, setTab] = useState<MainTab>("errand");
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [ledgerVersion, setLedgerVersion] = useState(0);

  const bump = useCallback(() => {
    setLedgerVersion(v => v + 1);
  }, []);

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      setHealth(await postJson<HealthStatus>("/api/health", {}));
    } catch {
      setHealth({ paypal: { configured: false, ok: false, error: "health check failed" }, llm: { ok: false } });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCancelled(params.get("cancelled") === "1");
    const t = params.get("tab");
    if (t && (TAB_IDS as string[]).includes(t)) setTab(t as MainTab);
    void refreshHealth();
  }, [refreshHealth]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const entries = loadLedger();
      const chain = await verifyChain(entries);
      if (!live) return;
      const purchaseEntries = entries.filter(e => e.type === "purchase");
      setStats({
        purchases: purchaseEntries.length,
        hiddenAvoidedCents: purchaseEntries.reduce((a, e) => a + (e.naive?.surpriseCents ?? 0), 0),
        audits: entries.filter(e => e.type === "audit").length,
        chainOk: chain.ok,
        entries: entries.length,
      });
    })();
    return () => {
      live = false;
    };
  }, [ledgerVersion]);

  return (
    <div className="min-h-screen">
      <Header tab={tab} onTab={setTab} health={health} healthLoading={healthLoading} onRefresh={() => void refreshHealth()} />
      <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5">
        {cancelled && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#5a431a] bg-[#33270d] px-4 py-3 text-sm text-[#f5a524]">
            <span>Payment cancelled on PayPal {"\u00B7"} nothing was charged.</span>
            <button
              onClick={() => setCancelled(false)}
              className="rounded-lg border border-[#5a431a] px-2 py-1 text-xs font-semibold hover:text-[#e8eefc]"
            >
              Dismiss
            </button>
          </div>
        )}
        <ImpactStrip stats={stats} />
        {tab === "errand" && <ErrandPanel onOpenMandate={() => setTab("mandate")} />}
        {tab === "auditor" && <AuditorPanel onSaved={bump} />}
        {tab === "mandate" && <MandatePanel />}
        {tab === "ledger" && <LedgerPanel onChanged={bump} />}
      </main>
      <footer className="border-t border-[#1f2b46] py-4 text-center text-[11px] text-[#44506e]">
        MePal {"\u00B7"} PayPal AI Hackathon demo {"\u00B7"} simulated stores, sandbox payments, nothing ships
      </footer>
    </div>
  );
}
