"use client";

import { sumLines } from "@/lib/truth";
import { formatMoney } from "@/lib/money";
import type { Offer } from "@/lib/types";
import { Chip, Money } from "./ui";
import { PriceCreepBar, type CreepSegment } from "./PriceCreepBar";
import { HonestyRing } from "./HonestyRing";

const TAG_LABELS: Record<string, string> = {
  drip_pricing: "Drip pricing",
  basket_sneaking: "Basket sneaking",
  false_urgency: "False urgency",
  subscription_trap: "Subscription trap",
  price_change: "Price changed",
};

const VERDICT: Record<string, { tone: "ok" | "warn" | "bad" | "paypal"; label: string }> = {
  FAST: { tone: "ok", label: "FAST" },
  CONFIRM: { tone: "paypal", label: "CONFIRM" },
  NEEDS_EXCEPTION: { tone: "warn", label: "NEEDS EXCEPTION" },
  BLOCK: { tone: "bad", label: "BLOCKED" },
};

const TIER_LABEL: Record<string, { tone: "ok" | "warn" | "bad"; label: string }> = {
  honest: { tone: "ok", label: "honest pricing" },
  drip: { tone: "warn", label: "drip pricing" },
  sneaky: { tone: "bad", label: "basket sneaking" },
};

export function MerchantCard({ offer, chosen }: { offer: Offer; chosen: boolean }) {
  const v = VERDICT[offer.guard.verdict] ?? VERDICT.BLOCK;
  const tier = TIER_LABEL[offer.merchant.tier] ?? TIER_LABEL.honest;
  const segments: CreepSegment[] = [
    { key: "item", label: "Item", cents: sumLines(offer.raw, ["item"]), color: "#60a5fa" },
    { key: "shipping", label: "Shipping", cents: sumLines(offer.raw, ["shipping"]), color: "#f5a524" },
    { key: "fees", label: "Fees", cents: sumLines(offer.raw, ["fee"]), color: "#ef4b5f" },
    { key: "addons", label: "Add-ons", cents: sumLines(offer.raw, ["addon"]), color: "#8b5cf6" },
    { key: "tax", label: "Tax", cents: sumLines(offer.raw, ["tax"]), color: "#64748b" },
  ];
  return (
    <article className={`flex flex-col gap-3 rounded-2xl border bg-[#111a2e] p-4 ${chosen ? "border-[#22c7a0]" : "border-[#1f2b46]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#e8eefc]">{offer.merchant.name}</h3>
          <div className="mt-1">
            <Chip tone={tier.tone}>{tier.label}</Chip>
          </div>
        </div>
        <Chip tone={v.tone}>{v.label}</Chip>
      </div>

      {offer.raw.flags.falseUrgency && offer.raw.urgencyText && (
        <div className="rounded-lg border border-[#5a431a] bg-[#33270d] px-2.5 py-1.5 text-xs text-[#f5a524]">
          <span aria-hidden>{"\u26A0"}</span> {offer.raw.urgencyText}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-[#8da2c8]">Sticker (stage 1)</div>
          <Money cents={offer.truth.stickerCents} className="text-sm font-semibold text-[#e8eefc]" />
        </div>
        <div>
          <div className="text-[#8da2c8]">Raw total if you accept all</div>
          <Money cents={offer.truth.rawTotalCents} className="text-sm font-semibold text-[#ef4b5f]" />
        </div>
      </div>

      <PriceCreepBar segments={segments} markerCents={offer.truth.stickerCents} markerLabel="sticker" currency="USD" />

      <div className="flex items-center justify-between gap-2">
        <HonestyRing score={offer.truth.honestyScore} grade={offer.truth.grade} />
        <div className="flex max-w-[60%] flex-wrap justify-end gap-1.5">
          {offer.truth.tags.map(t => (
            <Chip key={t} tone="warn">
              {TAG_LABELS[t] ?? t}
            </Chip>
          ))}
        </div>
      </div>

      {offer.truth.strippedCount > 0 && (
        <Chip tone="ok">
          {"\u2713"} MePal removed {offer.truth.strippedCount} pre-ticked add-on{offer.truth.strippedCount === 1 ? "" : "s"} (
          {formatMoney(offer.truth.strippedCents)})
        </Chip>
      )}

      <div>
        <div className="mb-1 text-xs font-medium text-[#8da2c8]">Mandate rules</div>
        <ul className="space-y-1">
          {offer.guard.rules.map(r => (
            <li key={r.id} className="flex items-start gap-2 text-xs">
              <span aria-hidden className={r.passed ? "text-[#22c7a0]" : "text-[#ef4b5f]"}>
                {r.passed ? "\u2713" : "\u2717"}
              </span>
              <span className="text-[#cdd9f2]">
                {r.label} <span className="num text-[#8da2c8]">{r.detail}</span>{" "}
                <span className="text-[10px] uppercase tracking-wide text-[#44506e]">{r.hard ? "hard" : "soft"}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto border-t border-[#1f2b46] pt-2 text-xs text-[#8da2c8]">
        MePal would pay <Money cents={offer.truth.evaluatedTotalCents} className="font-semibold text-[#22c7a0]" />
        {offer.truth.evaluatedTotalCents !== offer.truth.rawTotalCents ? " (after stripping pre-ticked extras)" : " (nothing to strip)"}
      </div>
    </article>
  );
}
