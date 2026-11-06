"use client";

import { useState } from "react";
import { AUDIT_EXAMPLES } from "@/lib/examples";
import { appendEntry } from "@/lib/ledger";
import { formatMoney, pctText } from "@/lib/money";
import { ApiError, newId, postJson } from "@/lib/storage";
import type { AuditReport, Currency, ExplainNote } from "@/lib/types";
import { HonestyRing } from "./HonestyRing";
import { PriceCreepBar, type CreepSegment } from "./PriceCreepBar";
import { Btn, Chip, ErrorNote, Field, INPUT_CLS, Money, Panel } from "./ui";

const CURRENCIES: Currency[] = ["USD", "INR", "EUR", "GBP"];

const KIND_TONE: Record<string, "info" | "warn" | "bad" | "ai" | "ok" | "muted"> = {
  item: "info",
  shipping: "warn",
  fee: "bad",
  addon: "ai",
  tax: "muted",
  discount: "ok",
  total: "ok",
};

function auditFacts(r: AuditReport): Record<string, string> {
  return {
    advertised: formatMoney(r.advertisedCents, r.currency),
    total: formatMoney(r.totalCents, r.currency),
    hidden: `${formatMoney(r.hiddenCents, r.currency)} (${pctText(r.hiddenPct)})`,
    avoidable: formatMoney(r.avoidableCents, r.currency),
    honesty_score: `${r.honestyScore}/100 grade ${r.grade}`,
    warning: r.warnings[0] ?? "none",
  };
}

function templateAuditNote(r: AuditReport): string {
  const f = auditFacts(r);
  return `This checkout advertises ${f.advertised} but every line adds up to ${f.total}: ${f.hidden} sits beyond the sticker in delivery, handling or platform fees. Honesty score ${f.honesty_score}. ${f.avoidable} of that is avoidable because it was pre-ticked for you. ${r.warnings[0] ?? ""} Un-tick extras and compare the final line against the advertised price before you pay.`;
}

export function AuditorPanel({ onSaved }: { onSaved: () => void }) {
  const [advertised, setAdvertised] = useState("");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [text, setText] = useState("");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [meta, setMeta] = useState<{ source: "llm" | "fallback"; model?: string } | null>(null);
  const [aiNote, setAiNote] = useState<ExplainNote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function loadExample(i: number) {
    const ex = AUDIT_EXAMPLES[i];
    if (!ex) return;
    setAdvertised(String(ex.advertised));
    setCurrency(ex.currency);
    setText(ex.text);
    setReport(null);
    setMeta(null);
    setAiNote(null);
    setError(null);
    setSavedMsg(null);
  }

  async function audit() {
    setBusy(true);
    setError(null);
    setSavedMsg(null);
    setAiNote(null);
    try {
      const r = await postJson<{ report: AuditReport; source: "llm" | "fallback"; model?: string }>("/api/ai/audit", {
        text,
        advertised,
        currency,
      });
      setReport(r.report);
      setMeta({ source: r.source, model: r.model });
      try {
        const n = await postJson<ExplainNote>("/api/ai/explain", { kind: "audit", facts: auditFacts(r.report) });
        setAiNote(n);
      } catch {
        setAiNote({ note: templateAuditNote(r.report), source: "fallback" });
      }
    } catch (e) {
      if (e instanceof ApiError) setError({ message: e.message, details: e.details });
      else setError({ message: "The audit failed. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!report) return;
    try {
      await appendEntry({
        id: newId("aud"),
        type: "audit",
        createdAt: new Date().toISOString(),
        audit: {
          currency: report.currency,
          advertisedCents: report.advertisedCents,
          totalCents: report.totalCents,
          hiddenCents: report.hiddenCents,
          hiddenPct: report.hiddenPct,
          avoidableCents: report.avoidableCents,
          honestyScore: report.honestyScore,
          grade: report.grade,
          tags: report.tags,
        },
      });
      setSavedMsg("Audit saved to your ledger.");
      onSaved();
    } catch {
      setSavedMsg(null);
      setError({ message: "Could not save this audit to the ledger." });
    }
  }

  async function copyReport() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError({ message: "Copy failed: open 'Report JSON' below and copy it manually." });
    }
  }

  const byKind = (k: string) => (report ? report.lines.filter(l => l.kind === k).reduce((a, l) => a + l.cents, 0) : 0);
  const segments: CreepSegment[] = report
    ? [
        { key: "item", label: "Item", cents: byKind("item"), color: "#60a5fa" },
        { key: "shipping", label: "Shipping", cents: byKind("shipping"), color: "#f5a524" },
        { key: "fees", label: "Fees", cents: byKind("fee"), color: "#ef4b5f" },
        { key: "addons", label: "Add-ons", cents: byKind("addon"), color: "#8b5cf6" },
        { key: "tax", label: "Tax", cents: byKind("tax"), color: "#64748b" },
      ]
    : [];

  return (
    <div className="fade-up space-y-4">
      <Panel
        title="Checkout Auditor"
        subtitle="Paste any real checkout text. Code scores it; AI only helps read the lines (with a code fallback)."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Advertised price" hint="The headline price before extras.">
            <input value={advertised} onChange={e => setAdvertised(e.target.value)} inputMode="decimal" placeholder="e.g. 499 or 59.00" className={INPUT_CLS} />
          </Field>
          <Field label="Currency">
            <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className={INPUT_CLS}>
              {CURRENCIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end gap-2">
            <Btn onClick={() => void audit()} disabled={busy}>
              {busy ? "Auditing" : "Audit this checkout"}
            </Btn>
          </div>
        </div>
        <div className="mt-3">
          <Field label="Checkout text" hint="One charge per line, copied from any app, site or bill.">
            <textarea value={text} onChange={e => setText(e.target.value)} rows={7} className={`${INPUT_CLS} font-mono text-xs`} placeholder={"Item total 499\nDelivery fee 40\nTo pay 626"} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {AUDIT_EXAMPLES.map((ex, i) => (
            <Btn key={ex.id} variant="ghost" onClick={() => loadExample(i)} className="text-xs">
              Load example: {ex.label}
            </Btn>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <ErrorNote error={error?.message} details={error?.details} />
        </div>
      </Panel>

      {report && (
        <>
          <Panel
            title="Audit result"
            subtitle={`Line extraction: ${meta?.source === "llm" ? `AI (${meta.model ?? "llm"})` : "code fallback extractor"}; scoring always by code`}
            right={<HonestyRing score={report.honestyScore} grade={report.grade} />}
          >
            <p className="text-sm text-[#e8eefc]">
              You were advertised <Money cents={report.advertisedCents} currency={report.currency} className="font-bold" /> but would pay{" "}
              <Money cents={report.totalCents} currency={report.currency} className="font-bold text-[#ef4b5f]" /> (
              <span className="num text-[#ef4b5f]">+{pctText(report.hiddenPct)}</span> beyond the sticker).
            </p>
            <div className="mt-3">
              <PriceCreepBar segments={segments} markerCents={report.advertisedCents} markerLabel="advertised" currency={report.currency} />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[#8da2c8]">
                    <th className="py-1 pr-2 font-medium">Line</th>
                    <th className="py-1 pr-2 font-medium">Type</th>
                    <th className="py-1 pr-2 text-right font-medium">Amount</th>
                    <th className="py-1 font-medium">Pre-ticked</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lines.map(l => (
                    <tr key={l.id} className="border-t border-[#1f2b46]">
                      <td className="py-1.5 pr-2 text-[#e8eefc]">{l.label}</td>
                      <td className="py-1.5 pr-2">
                        <Chip tone={KIND_TONE[l.kind] ?? "muted"}>{l.kind}</Chip>
                      </td>
                      <td className="num py-1.5 pr-2 text-right text-[#e8eefc]">
                        <Money cents={l.cents} currency={report.currency} />
                      </td>
                      <td className="py-1.5">
                        {l.preselected ? <Chip tone="warn">yes</Chip> : <span className="text-[#44506e]">{"\u2013"}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <Chip tone="bad">Hidden beyond sticker: {formatMoney(report.hiddenCents, report.currency)}</Chip>
              <Chip tone="warn">Avoidable (pre-ticked): {formatMoney(report.avoidableCents, report.currency)}</Chip>
              {report.tags.map(t => (
                <Chip key={t} tone="ai">
                  {t}
                </Chip>
              ))}
            </div>
            {report.warnings.length > 0 && (
              <ul className="mt-3 space-y-1">
                {report.warnings.map((w, i) => (
                  <li key={i} className="rounded-lg border border-[#5a431a] bg-[#33270d] px-3 py-2 text-xs text-[#f5a524]">
                    <span aria-hidden>{"\u26A0"}</span> {w}
                  </li>
                ))}
              </ul>
            )}
            {aiNote && (
              <div className="mt-3 rounded-xl border border-[#1f2b46] bg-[#0d1526] p-3">
                <p className="text-sm leading-relaxed text-[#cdd9f2]">{aiNote.note}</p>
                <div className="mt-2">
                  <Chip tone={aiNote.source === "llm" ? "ai" : "code"}>
                    {aiNote.source === "llm" ? `Written by ${aiNote.model ?? "AI"}` : "Written by code template"}
                  </Chip>
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Btn onClick={() => void save()}>Save to ledger</Btn>
              <Btn variant="ghost" onClick={() => void copyReport()}>
                {copied ? "Copied" : "Copy report"}
              </Btn>
              {savedMsg && <Chip tone="ok">{"\u2713"} {savedMsg}</Chip>}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-[#8da2c8] hover:text-[#e8eefc]">Report JSON</summary>
              <pre className="num mt-2 max-h-56 overflow-auto rounded-lg border border-[#1f2b46] bg-[#0b1220] p-3 text-[11px] text-[#8da2c8]">
                {JSON.stringify(report, null, 2)}
              </pre>
            </details>
          </Panel>
        </>
      )}
    </div>
  );
}
