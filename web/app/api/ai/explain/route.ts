import { extractJsonObject, llmChat } from "@/lib/llm";
import type { ExplainNote } from "@/lib/types";

const fail = (code: string, error: string, details?: string) =>
  Response.json({ ok: false, error, code, ...(details ? { details } : {}) });

const SYSTEM =
  "You write a 60-90 word plain-text explanation for MePal, a demo checkout guard. Use ONLY the facts provided; never invent numbers; no markdown, no lists, no emojis, no financial advice. Address the shopper directly, neutral and confident.";

function factsBlock(facts: Record<string, unknown>): string {
  return Object.entries(facts)
    .slice(0, 40)
    .map(([k, v]) => `${k.replace(/[\r\n]+/g, " ").slice(0, 40)}: ${String(v).replace(/[\r\n]+/g, " ").slice(0, 160)}`)
    .join("\n");
}

function pick(facts: Record<string, unknown>, key: string): string {
  const v = facts[key];
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}

function templateDecision(facts: Record<string, unknown>): string {
  const g = (k: string) => pick(facts, k);
  if (!g("chosen_store") || g("chosen_store") === "none") {
    return `All three demo stores failed your mandate for ${g("product") || "this errand"}. QuickKart and BargainBay hide fees and pre-tick add-ons, so MePal refused to pay rather than chase the cheapest sticker. Loosen your mandate limits if you want to proceed, but the honesty rules always stay on.`;
  }
  const savedBit = g("saved_vs_naive").startsWith("-") || g("saved_vs_naive").includes("extra")
    ? `that is ${g("saved_vs_naive").replace("paid extra for the honest pick", "more than the naive all-in price")}, the cost of an honest quote`
    : `so ${g("saved_vs_naive")} compared with the naive all-in price`;
  return `MePal picked ${g("chosen_store")} (${g("verdict")}) for ${g("product")} at ${g("guarded_total")} all-in. ${g("hidden_fees_after_cleaning")} sits beyond the ${g("sticker_price")} sticker even after stripping pre-ticked extras (${g("preticked_addons_removed")}). Honesty score ${g("honesty_score")}. The naive sticker pick, ${g("naive_pick")}, would really cost ${g("naive_all_in_total")}; ${savedBit}. Nothing is charged until you approve it on PayPal sandbox.`;
}

function templateAudit(facts: Record<string, unknown>): string {
  const g = (k: string) => pick(facts, k);
  const warning = g("warning");
  const warningBit = !warning || warning === "none" ? "Compare the final line against the advertised price before you pay." : warning;
  return `This checkout advertises ${g("advertised")} but every line adds up to ${g("total")}: ${g("hidden")} sits beyond the sticker in delivery, handling or platform fees. Honesty score ${g("honesty_score")}. ${g("avoidable")} of that is avoidable because it was pre-ticked for you. ${warningBit}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { kind?: unknown; facts?: unknown };
    const kind = body.kind === "decision" || body.kind === "audit" ? body.kind : null;
    if (!kind) return fail("bad_input", "Explanation kind must be 'decision' or 'audit'.");
    if (typeof body.facts !== "object" || body.facts === null || Array.isArray(body.facts)) {
      return fail("bad_input", "facts must be an object of numbers and strings.");
    }
    const facts = body.facts as Record<string, unknown>;
    const block = factsBlock(facts);

    const llm = await llmChat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Kind: ${kind}\nFacts:\n${block}` },
      ],
      220
    );
    if (llm.ok && llm.content) {
      const note = llm.content.replace(/[\r\n]+/g, " ").replace(/[*_#`]+/g, "").trim().slice(0, 900);
      if (note.length > 0) {
        return Response.json({ ok: true, note, source: "llm", model: llm.model });
      }
    }
    const note = kind === "decision" ? templateDecision(facts) : templateAudit(facts);
    return Response.json({ ok: true, note, source: "fallback" } satisfies { ok: true; note: string; source: ExplainNote["source"] });
  } catch (e) {
    console.error("[MePal] route error:", e instanceof Error ? e.message : e);
    return fail("internal_error", "The explainer hit an unexpected error. Try again.");
  }
}
