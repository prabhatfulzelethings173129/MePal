"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_MANDATE, MANDATE_PRESETS, clampMandate } from "@/lib/guard";
import { formatMoney, parseAmountToCents, pctText } from "@/lib/money";
import { ApiError, KEYS, loadJson, postJson, saveJson } from "@/lib/storage";
import type { HuntResult, Mandate } from "@/lib/types";
import { Btn, Chip, ErrorNote, Field, INPUT_CLS, Money, Panel } from "./ui";

const VERDICT_TONE: Record<string, "ok" | "warn" | "bad" | "paypal"> = {
  FAST: "ok",
  CONFIRM: "paypal",
  NEEDS_EXCEPTION: "warn",
  BLOCK: "bad",
};

interface PreviewRow {
  name: string;
  total: number;
  hiddenPct: number;
  grade: string;
  verdict: string;
}

function mandateFromStrings(maxTotal: string, hiddenPct: string, honesty: string, confirmAbove: string, strip: boolean): Mandate {
  return clampMandate({
    maxTotalCents: parseAmountToCents(maxTotal),
    maxHiddenFeePct: Number(hiddenPct),
    minHonestyScore: Number(honesty),
    confirmAboveCents: parseAmountToCents(confirmAbove),
    blockPreselectedAddons: strip,
  });
}

function stringsFromMandate(m: Mandate) {
  return {
    maxTotal: (m.maxTotalCents / 100).toFixed(2),
    hiddenPct: String(m.maxHiddenFeePct),
    honesty: String(m.minHonestyScore),
    confirmAbove: (m.confirmAboveCents / 100).toFixed(2),
    strip: m.blockPreselectedAddons,
  };
}

export function MandatePanel() {
  const initial = stringsFromMandate(clampMandate(loadJson(KEYS.mandate, DEFAULT_MANDATE)));
  const [maxTotal, setMaxTotal] = useState(initial.maxTotal);
  const [hiddenPct, setHiddenPct] = useState(initial.hiddenPct);
  const [honesty, setHonesty] = useState(initial.honesty);
  const [confirmAbove, setConfirmAbove] = useState(initial.confirmAbove);
  const [strip, setStrip] = useState(initial.strip);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ busy: boolean; rows: PreviewRow[] | null }>({ busy: true, rows: null });

  const currentMandate = useCallback(
    () => mandateFromStrings(maxTotal, hiddenPct, honesty, confirmAbove, strip),
    [maxTotal, hiddenPct, honesty, confirmAbove, strip]
  );

  const runPreview = useCallback(async (m: Mandate) => {
    setPreview({ busy: true, rows: null });
    try {
      const h = await postJson<HuntResult>("/api/hunt", { sku: "hub", qty: 1, mandate: m, errandBudgetCents: null });
      setPreview({
        busy: false,
        rows: h.offers.map(o => ({
          name: o.merchant.name,
          total: o.truth.evaluatedTotalCents,
          hiddenPct: o.truth.hiddenEvalPct,
          grade: o.truth.grade,
          verdict: o.guard.verdict,
        })),
      });
    } catch (e) {
      setPreview({ busy: false, rows: null });
      setError(e instanceof ApiError ? e.message : "The live preview failed.");
    }
  }, []);

  useEffect(() => {
    void runPreview(clampMandate(loadJson(KEYS.mandate, DEFAULT_MANDATE)));
  }, [runPreview]);

  function save() {
    const m = currentMandate();
    saveJson(KEYS.mandate, m);
    setSavedMsg("Mandate saved on this device. New errands will use it.");
    setError(null);
    void runPreview(m);
  }

  function applyPreset(i: number) {
    const p = MANDATE_PRESETS[i];
    if (!p) return;
    const s = stringsFromMandate(p.mandate);
    setMaxTotal(s.maxTotal);
    setHiddenPct(s.hiddenPct);
    setHonesty(s.honesty);
    setConfirmAbove(s.confirmAbove);
    setStrip(s.strip);
    setSavedMsg(null);
  }

  return (
    <div className="fade-up space-y-4">
      <Panel
        title="Your mandate"
        subtitle="A permission slip for the AI agent. Exceptions can only lift the soft spending limits; honesty rules are hard."
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {MANDATE_PRESETS.map((p, i) => (
            <Btn key={p.id} variant="ghost" onClick={() => applyPreset(i)} className="text-xs">
              {p.label}: {p.blurb}
            </Btn>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Max total per purchase ($)" hint="Hard ceiling on the full price. Soft rule: an exception can lift it.">
            <input value={maxTotal} onChange={e => setMaxTotal(e.target.value)} inputMode="decimal" className={INPUT_CLS} />
          </Field>
          <Field label="Errand budget override" hint="Optional per-errand budget is set by the errand text, e.g. 'under $40'.">
            <input value="(from errand text)" readOnly className={`${INPUT_CLS} opacity-60`} />
          </Field>
          <Field label="Max hidden fees (% of sticker)" hint="Hard rule. TrueMart has 0%; QuickKart over 38% even after cleaning.">
            <input value={hiddenPct} onChange={e => setHiddenPct(e.target.value)} inputMode="decimal" className={INPUT_CLS} />
          </Field>
          <Field label="Min honesty score (0-100)" hint="Hard rule. TrueMart scores 100, QuickKart 25, BargainBay 28.">
            <input value={honesty} onChange={e => setHonesty(e.target.value)} inputMode="decimal" className={INPUT_CLS} />
          </Field>
          <Field label="Confirm above ($)" hint="Totals above this need you to tick 'I reviewed the full price'.">
            <input value={confirmAbove} onChange={e => setConfirmAbove(e.target.value)} inputMode="decimal" className={INPUT_CLS} />
          </Field>
          <Field label="Pre-ticked add-ons" hint="Strip add-ons that the store silently pre-selected in your basket.">
            <label className="flex items-center gap-2 text-sm text-[#cdd9f2]">
              <input type="checkbox" checked={strip} onChange={e => setStrip(e.target.checked)} className="h-4 w-4 accent-[#0070ba]" />
              Strip pre-ticked add-ons before scoring (recommended)
            </label>
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Btn onClick={save}>Save mandate</Btn>
          {savedMsg && <Chip tone="ok">{"\u2713"} {savedMsg}</Chip>}
        </div>
        <div className="mt-3">
          <ErrorNote error={error} />
        </div>
      </Panel>

      <Panel title="Live preview" subtitle="With this mandate, the 3 demo stores would be: (USB-C 7-in-1 Hub, qty 1)">
        {preview.busy && <p className="text-sm text-[#8da2c8]">Checking stores{"\u2026"}</p>}
        {preview.rows && (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[#8da2c8]">
                <th className="py-1 pr-2 font-medium">Store</th>
                <th className="py-1 pr-2 text-right font-medium">MePal total</th>
                <th className="py-1 pr-2 text-right font-medium">Hidden</th>
                <th className="py-1 pr-2 font-medium">Grade</th>
                <th className="py-1 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map(r => (
                <tr key={r.name} className="border-t border-[#1f2b46]">
                  <td className="py-1.5 pr-2 text-[#e8eefc]">{r.name}</td>
                  <td className="num py-1.5 pr-2 text-right text-[#e8eefc]">
                    <Money cents={r.total} />
                  </td>
                  <td className="num py-1.5 pr-2 text-right text-[#f5a524]">{pctText(r.hiddenPct)}</td>
                  <td className="num py-1.5 pr-2 text-[#e8eefc]">{r.grade}</td>
                  <td className="py-1.5">
                    <Chip tone={VERDICT_TONE[r.verdict] ?? "muted"}>{r.verdict.replaceAll("_", " ")}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!preview.busy && !preview.rows && <p className="text-sm text-[#8da2c8]">Save the mandate to refresh the preview.</p>}
      </Panel>
    </div>
  );
}
