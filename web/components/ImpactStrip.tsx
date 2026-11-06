"use client";

import type { ImpactStats } from "@/lib/types";
import { Chip, Stat } from "./ui";

// The two surveyed problems MePal addresses. Directional survey evidence only.
const FACTS: { text: string; source: string }[] = [
  {
    text: "About three quarters of online adults in the US, UK and Canada are uncomfortable letting an AI agent pay autonomously, even with preset spending limits.",
    source: "Forrester, June 2026",
  },
  {
    text: "63% of Indian online payment users hit hidden charges or drip pricing at checkout, up from 52% two years earlier; 69% of 12 studied platforms use drip pricing.",
    source: "LocalCircles 2026; Datum Intelligence, June 2026",
  },
];

export function ImpactStrip({ stats }: { stats: ImpactStats | null }) {
  return (
    <section aria-label="Why MePal exists" className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {FACTS.map(f => (
          <div key={f.source} className="rounded-2xl border border-[#1f2b46] bg-[#111a2e] p-4">
            <p className="text-sm leading-relaxed text-[#cdd9f2]">{f.text}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Chip tone="muted">{f.source}</Chip>
              <Chip tone="warn">survey evidence, directional</Chip>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Guarded purchases" value={stats ? String(stats.purchases) : "\u2013"} />
        <Stat label="Hidden-fee exposure avoided" value={stats ? `$${(stats.hiddenAvoidedCents / 100).toFixed(2)}` : "\u2013"} />
        <Stat label="Audits run" value={stats ? String(stats.audits) : "\u2013"} />
        {stats === null ? (
          <Stat label="Ledger integrity" value={"\u2013"} />
        ) : stats.entries === 0 ? (
          <Stat label="Ledger integrity" value="empty" />
        ) : stats.chainOk ? (
          <Stat label="Ledger integrity" value={`valid \u00B7 ${stats.entries}`} tone="ok" />
        ) : (
          <Stat label="Ledger integrity" value="BROKEN" tone="bad" />
        )}
      </div>
    </section>
  );
}
