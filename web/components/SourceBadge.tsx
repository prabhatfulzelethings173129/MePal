"use client";

import { Chip } from "./ui";

// Shows who did a step: [AI] purple, [CODE] slate, [PAYPAL] blue.
export function SourceBadges({ who }: { who: string }) {
  const parts = who.split("+").map(p => p.trim()).filter(Boolean);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {parts.map(p => (
        <Chip key={p} tone={p === "AI" ? "ai" : p === "PAYPAL" ? "paypal" : "code"}>
          [{p}]
        </Chip>
      ))}
    </span>
  );
}
