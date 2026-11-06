"use client";

import type { HealthStatus } from "@/lib/types";
import { Btn, Chip } from "./ui";

function shorten(s: string, max = 56): string {
  return s.length > max ? `${s.slice(0, max - 1)}\u2026` : s;
}

export function StatusChips({ health, loading, onRefresh }: { health: HealthStatus | null; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {health === null ? (
        <Chip tone="muted">checking PayPal{"\u2026"}</Chip>
      ) : health.paypal.ok ? (
        <Chip tone="ok">{"\u2713"} PayPal sandbox connected</Chip>
      ) : health.paypal.configured ? (
        <Chip tone="bad">PayPal error: {shorten(health.paypal.error ?? "unknown")}</Chip>
      ) : (
        <Chip tone="warn">PayPal not configured: set .env.local</Chip>
      )}
      {health === null ? (
        <Chip tone="muted">checking AI{"\u2026"}</Chip>
      ) : health.llm.ok ? (
        <Chip tone="ai">{"\u2713"} AI online ({health.llm.model ?? "llm"})</Chip>
      ) : (
        <Chip tone="code">AI offline, fallbacks active</Chip>
      )}
      <Btn variant="ghost" onClick={onRefresh} disabled={loading} className="!px-2 !py-1 text-xs">
        {loading ? "Refreshing" : "Refresh"}
      </Btn>
    </div>
  );
}
