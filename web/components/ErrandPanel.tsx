"use client";

import { useCallback, useEffect, useState } from "react";
import { ERRAND_PRESETS } from "@/lib/examples";
import { DEFAULT_MANDATE, clampMandate } from "@/lib/guard";
import { formatMoney, pctText } from "@/lib/money";
import { ApiError, KEYS, loadJson, postJson } from "@/lib/storage";
import type { ErrandInfo, ExplainNote, HuntResult, Mandate, Offer } from "@/lib/types";
import { DecisionCard } from "./DecisionCard";
import { MerchantCard } from "./MerchantCard";
import { PayPanel } from "./PayPanel";
import { Timeline, type StepKey, type StepStatus, type StepView } from "./Timeline";
import { Btn, Chip, ErrorNote, Field, Panel } from "./ui";

interface StepState {
  status: StepStatus;
  note?: string;
}

const STEP_DEFS: { key: StepKey; label: string; who: string }[] = [
  { key: "understand", label: "Understand errand", who: "AI+CODE" },
  { key: "hunt", label: "Hunt 3 stores", who: "CODE" },
  { key: "truth", label: "Truth Check", who: "CODE" },
  { key: "guard", label: "Mandate Guard", who: "CODE" },
  { key: "decide", label: "Decision with explanation", who: "CODE+AI" },
  { key: "pay", label: "Pay with PayPal", who: "PAYPAL" },
  { key: "proof", label: "Proof and Undo", who: "PAYPAL+CODE" },
];

function blankSteps(): Record<StepKey, StepState> {
  const out = {} as Record<StepKey, StepState>;
  for (const d of STEP_DEFS) out[d.key] = { status: "waiting" };
  return out;
}

function decisionFacts(h: HuntResult, ch: Offer | null): Record<string, string> {
  const naiveName = h.offers.find(o => o.merchant.id === h.naive.merchantId)?.merchant.name ?? h.naive.merchantId;
  return {
    product: h.product.name,
    chosen_store: ch ? ch.merchant.name : "none",
    verdict: ch ? ch.guard.verdict : "BLOCK",
    guarded_total: ch ? formatMoney(ch.truth.evaluatedTotalCents) : "-",
    sticker_price: ch ? formatMoney(ch.truth.stickerCents) : "-",
    hidden_fees_after_cleaning: ch ? `${formatMoney(ch.truth.hiddenEvalCents)} (${pctText(ch.truth.hiddenEvalPct)})` : "-",
    honesty_score: ch ? `${ch.truth.honestyScore}/100 grade ${ch.truth.grade}` : "-",
    preticked_addons_removed: ch ? `${ch.truth.strippedCount} worth ${formatMoney(ch.truth.strippedCents)}` : "0",
    naive_pick: naiveName,
    naive_sticker: formatMoney(h.naive.stickerCents),
    naive_all_in_total: formatMoney(h.naive.rawTotalCents),
    saved_vs_naive:
      h.savedVsNaiveCents >= 0
        ? `${formatMoney(h.savedVsNaiveCents)} saved`
        : `${formatMoney(-h.savedVsNaiveCents)} paid extra for the honest pick`,
  };
}

function templateNote(h: HuntResult, ch: Offer | null): string {
  const f = decisionFacts(h, ch);
  if (!ch) {
    return `All three demo stores failed your mandate for ${f.product}. QuickKart and BargainBay hide fees and pre-tick add-ons, so MePal refused to pay instead of chasing the cheapest sticker. Loosen your spending limits if you want to proceed; the honesty rules always stay hard.`;
  }
  const savedBit =
    h.savedVsNaiveCents >= 0
      ? `so ${f.saved_vs_naive} compared with the naive all-in price`
      : `that is ${f.saved_vs_naive.replace(" paid extra for the honest pick", " more than the naive all-in price")}, the cost of an honest quote`;
  return `MePal picked ${f.chosen_store} (${f.verdict}) for ${f.product} at ${f.guarded_total} all-in. ${f.hidden_fees_after_cleaning} sits beyond the ${f.sticker_price} sticker even after stripping pre-ticked extras (${f.preticked_addons_removed}). Honesty score ${f.honesty_score}. The naive sticker pick, ${f.naive_pick}, would really cost ${f.naive_all_in_total}; ${savedBit}. Nothing is charged until you approve it on PayPal sandbox.`;
}

export function ErrandPanel({ onOpenMandate }: { onOpenMandate: () => void }) {
  const [text, setText] = useState("");
  const [ranText, setRanText] = useState("");
  const [steps, setSteps] = useState<Record<StepKey, StepState>>(blankSteps);
  const [mandate, setMandate] = useState<Mandate>(DEFAULT_MANDATE);
  const [hunt, setHunt] = useState<HuntResult | null>(null);
  const [chosen, setChosen] = useState<Offer | null>(null);
  const [note, setNote] = useState<ExplainNote | null>(null);
  const [budgetCents, setBudgetCents] = useState<number | null>(null);
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMandate(clampMandate(loadJson(KEYS.mandate, DEFAULT_MANDATE)));
  }, []);

  const mark = useCallback((key: StepKey, status: StepStatus, noteText?: string) => {
    setSteps(prev => ({ ...prev, [key]: { status, note: noteText ?? prev[key].note } }));
  }, []);

  const failRunningSteps = useCallback(() => {
    setSteps(prev => {
      const copy = { ...prev };
      (Object.keys(copy) as StepKey[]).forEach(k => {
        if (copy[k].status === "running") copy[k] = { ...copy[k], status: "error" };
      });
      return copy;
    });
  }, []);

  const run = useCallback(
    async (raw: string) => {
      const t = raw.trim();
      setError(null);
      setHunt(null);
      setChosen(null);
      setNote(null);
      setBudgetCents(null);
      setSteps(blankSteps());
      if (!t) {
        setError({ message: "Type an errand first, for example: I need a USB-C hub under $40." });
        return;
      }
      setBusy(true);
      setRanText(t);
      try {
        mark("understand", "running");
        const info = await postJson<ErrandInfo>("/api/ai/errand", { text: t });
        setBudgetCents(info.budgetCents);
        mark(
          "understand",
          "done",
          `${info.sku} \u00D7 ${info.qty}${info.budgetCents !== null ? ` \u00B7 budget ${formatMoney(info.budgetCents)}` : ""} \u00B7 ${info.source === "llm" ? `AI (${info.model ?? "llm"})` : "code fallback"}`
        );

        mark("hunt", "running");
        const h = await postJson<HuntResult>("/api/hunt", {
          sku: info.sku,
          qty: info.qty,
          mandate,
          errandBudgetCents: info.budgetCents,
        });
        setHunt(h);
        const ch = h.chosen ? (h.offers.find(o => o.merchant.id === h.chosen?.merchantId) ?? null) : null;
        setChosen(ch);
        mark("hunt", "done", `3 demo stores quoted for ${h.product.name}`);
        mark(
          "truth",
          "done",
          ch
            ? `true total ${formatMoney(ch.truth.evaluatedTotalCents)} at ${ch.merchant.name} (${pctText(ch.truth.hiddenEvalPct)} hidden after cleaning)`
            : "every offer failed the truth check"
        );
        mark(
          "guard",
          "done",
          ch ? `verdict ${ch.guard.verdict.replaceAll("_", " ")} against your mandate` : "your mandate blocked all three stores"
        );

        mark("decide", "running");
        try {
          const ex = await postJson<ExplainNote>("/api/ai/explain", { kind: "decision", facts: decisionFacts(h, ch) });
          setNote(ex);
          mark("decide", "done", ex.source === "llm" ? `note written by ${ex.model ?? "AI"}` : "note from code template");
        } catch {
          setNote({ note: templateNote(h, ch), source: "fallback" });
          mark("decide", "done", "note from code template");
        }
      } catch (e) {
        failRunningSteps();
        if (e instanceof ApiError) setError({ message: e.message, details: e.details });
        else setError({ message: "Something went wrong while running the errand. Try again." });
      } finally {
        setBusy(false);
      }
    },
    [mandate, mark, failRunningSteps]
  );

  const views: StepView[] = STEP_DEFS.map(d => ({ ...d, status: steps[d.key].status, note: steps[d.key].note }));

  return (
    <div className="fade-up space-y-4">
      <Panel title="Errand" subtitle="Tell MePal what to buy. AI reads the sentence; plain code sets every price and rule.">
        <Field label="Shopping errand" hint="Preset chips below match the hackathon demo script. All money is PayPal sandbox.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="e.g. I need a USB-C hub, keep it under $40"
              className="w-full rounded-lg border border-[#1f2b46] bg-[#0b1220] px-3 py-2 text-sm text-[#e8eefc] outline-none placeholder:text-[#44506e] focus:border-[#2a8de0]"
            />
            <Btn onClick={() => void run(text)} disabled={busy}>
              {busy ? "Running" : "Run errand"}
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => {
                const p = ERRAND_PRESETS[0];
                setText(p);
                void run(p);
              }}
              disabled={busy}
            >
              Run demo
            </Btn>
          </div>
        </Field>
        <div className="mt-2 flex flex-wrap gap-2">
          {ERRAND_PRESETS.map(p => (
            <button
              key={p}
              onClick={() => setText(p)}
              className="rounded-full border border-[#1f2b46] px-3 py-1 text-xs text-[#8da2c8] transition hover:border-[#2a8de0] hover:text-[#e8eefc]"
            >
              {p}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <ErrorNote error={error?.message} details={error?.details} />
        </div>
      </Panel>

      <Panel title="Timeline" subtitle="Who does what at every step: [AI] model, [CODE] plain rules, [PAYPAL] sandbox APIs">
        <Timeline steps={views} />
      </Panel>

      {hunt && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {hunt.offers.map(o => (
              <MerchantCard key={o.merchant.id} offer={o} chosen={chosen?.merchant.id === o.merchant.id} />
            ))}
          </div>

          <DecisionCard hunt={hunt} onOpenMandate={onOpenMandate} />

          {chosen ? (
            <PayPanel
              offer={chosen}
              product={hunt.product}
              naive={hunt.naive}
              surpriseCents={hunt.surpriseCents}
              savedVsNaiveCents={hunt.savedVsNaiveCents}
              mandate={mandate}
              errandText={ranText}
              errandBudgetCents={budgetCents}
              onPayStep={(status, noteText) => mark("pay", status, noteText)}
              onOpenMandate={onOpenMandate}
            />
          ) : (
            <Panel title="No safe offer to pay">
              <p className="text-sm text-[#8da2c8]">
                Every store failed your mandate, so MePal refuses to pay. The mandate guard can lift soft spending limits with your
                approval, but hidden-fee and honesty rules are hard and never overridden.
              </p>
              <div className="mt-3">
                <Btn variant="ghost" onClick={onOpenMandate}>
                  Change my mandate
                </Btn>
              </div>
            </Panel>
          )}

          {note && (
            <Panel title="Why this decision">
              <p className="text-sm leading-relaxed text-[#cdd9f2]">{note.note}</p>
              <div className="mt-2">
                <Chip tone={note.source === "llm" ? "ai" : "code"}>
                  {note.source === "llm" ? `Written by ${note.model ?? "AI"}` : "Written by code template"}
                </Chip>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
