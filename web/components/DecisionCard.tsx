"use client";

import { formatMoney, pctText } from "@/lib/money";
import type { HuntResult } from "@/lib/types";
import { Btn, Chip, Money, Panel } from "./ui";

export function DecisionCard({ hunt, onOpenMandate }: { hunt: HuntResult; onOpenMandate: () => void }) {
  const naiveOffer = hunt.offers.find(o => o.merchant.id === hunt.naive.merchantId) ?? null;
  const chosen = hunt.chosen ? hunt.offers.find(o => o.merchant.id === hunt.chosen?.merchantId) ?? null : null;
  const naiveSurprise = hunt.naive.rawTotalCents - hunt.naive.stickerCents;
  const saved = hunt.savedVsNaiveCents;

  return (
    <Panel
      title="Decision"
      subtitle="What a naive sticker-chasing agent would do vs what the MePal-guarded agent does"
      right={chosen ? <Chip tone="paypal">{chosen.guard.verdict.replaceAll("_", " ")}</Chip> : <Chip tone="bad">NO SAFE OFFER</Chip>}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[#1f2b46] border-l-4 border-l-[#ef4b5f] bg-[#0d1526] p-3">
          <Chip tone="bad">NAIVE AGENT</Chip>
          <div className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-[#8da2c8]">Picks (lowest sticker)</span>
              <span className="font-medium text-[#e8eefc]">{naiveOffer?.merchant.name ?? hunt.naive.merchantId}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#8da2c8]">Advertised</span>
              <Money cents={hunt.naive.stickerCents} className="text-[#e8eefc]" />
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#8da2c8]">Would actually charge</span>
              <Money cents={hunt.naive.rawTotalCents} className="font-semibold text-[#ef4b5f]" />
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#8da2c8]">Hidden surprise</span>
              <span className="num text-[#ef4b5f]">+{formatMoney(naiveSurprise)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#1f2b46] border-l-4 border-l-[#22c7a0] bg-[#0d1526] p-3">
          <Chip tone="ok">MEPAL-GUARDED AGENT</Chip>
          <div className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-[#8da2c8]">Picks (true total + honesty)</span>
              <span className="font-medium text-[#e8eefc]">{chosen ? chosen.merchant.name : "none passed the guard"}</span>
            </div>
            {chosen && (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-[#8da2c8]">Advertised</span>
                  <Money cents={chosen.truth.stickerCents} className="text-[#e8eefc]" />
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#8da2c8]">You pay after cleaning</span>
                  <Money cents={chosen.truth.evaluatedTotalCents} className="font-semibold text-[#22c7a0]" />
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#8da2c8]">Hidden fees left ({pctText(chosen.truth.hiddenEvalPct)})</span>
                  <Money cents={chosen.truth.hiddenEvalCents} className="text-[#f5a524]" />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#cdd9f2]">
        {chosen ? (
          saved >= 0 ? (
            <span>
              {"\u2713"} MePal{"'"}s pick avoids <b className="num text-[#22c7a0]">{formatMoney(saved)}</b> of the naive pick{"'"}s
              all-in price, so <b className="num">{formatMoney(hunt.surpriseCents)}</b> of hidden charges never landed.
            </span>
          ) : (
            <span>
              MePal paid <b className="num text-[#f5a524]">{formatMoney(-saved)}</b> more than the naive pick{"'"}s all-in price:
              that is the cost of an honest price with no hidden charges.
            </span>
          )
        ) : (
          <span>Nothing passed your mandate. Loosen the spending limits if you want to proceed; honesty rules stay hard.</span>
        )}
        <Btn variant="ghost" onClick={onOpenMandate}>
          Change my mandate
        </Btn>
      </div>
    </Panel>
  );
}
