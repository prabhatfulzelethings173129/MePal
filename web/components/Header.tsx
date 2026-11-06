"use client";

import Link from "next/link";
import type { HealthStatus, MainTab } from "@/lib/types";
import { StatusChips } from "./StatusChips";
import { Logo } from "./ui";

const TABS: { id: MainTab; label: string }[] = [
  { id: "errand", label: "Errand" },
  { id: "auditor", label: "Auditor" },
  { id: "mandate", label: "Mandate" },
  { id: "ledger", label: "Ledger" },
];

export function Header({
  tab,
  onTab,
  health,
  healthLoading,
  onRefresh,
}: {
  tab: MainTab;
  onTab: (t: MainTab) => void;
  health: HealthStatus | null;
  healthLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="border-b border-[#1f2b46] bg-[#0b1220]">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Logo />
        <nav aria-label="Sections" className="flex flex-wrap items-center gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              aria-pressed={tab === t.id}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === t.id ? "bg-[#16233f] text-[#e8eefc]" : "text-[#8da2c8] hover:text-[#e8eefc]"}`}
            >
              {t.label}
            </button>
          ))}
          <Link href="/how-it-works" className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#8da2c8] underline-offset-2 hover:text-[#e8eefc] hover:underline">
            How it works
          </Link>
        </nav>
        <div className="ml-auto">
          <StatusChips health={health} loading={healthLoading} onRefresh={onRefresh} />
        </div>
      </div>
      <div className="border-t border-[#1f2b46] bg-[#101b31]">
        <p className="mx-auto w-full max-w-6xl px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#f5a524]">
          Sandbox demo {"\u00B7"} nothing ships {"\u00B7"} no real money {"\u00B7"} simulated stores
        </p>
      </div>
    </header>
  );
}
