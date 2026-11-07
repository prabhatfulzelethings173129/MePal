import { llmChat } from "@/lib/llm";
import type { ExplainNote } from "@/lib/types";

const fail = (code: string, error: string, details?: string) =>
  Response.json({ ok: false, error, code, ...(details ? { details } : {}) });

const SYSTEM =
  "You rewrite facts for MePal, a demo checkout guard, as 2 or 3 plain sentences, 45 to 70 words. Use ONLY the facts provided and copy numbers exactly as given. Never compare numbers yourself. Never use the words lower, higher, cheaper, costlier, expensive, greater, less than, original price, special handling. Do not repeat the verdict label in capital letters. No markdown, no lists, no emojis, no financial advice. Address the shopper directly, neutral and confident.";

const BANNED = /\b(lower|higher|cheaper|costlier|expensive|greater than|less than|original price|special handling|thorough review|upgrade)\b/i;

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

const nums = (s: string): string[] => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map(n => n.replace(/,/g, ""));

// Reject notes that invent numbers, drop the key total, or use banned wording
function noteIsSafe(note: string, block: string, kind: string, facts: Record<string, unknown>): boolean {
  if (BANNED.test(note) || /[A-Z]{9,}/.test(note)) return false;
  const allowed = new Set(nums(block));
  const used = nums(note);
  if (used.some(n => !allowed.has(n))) return false;
  if (kind === "decision") {
    const total = nums(pick(facts, "guarded_total"))[0];
    if (total && !used.includes(total)) return false;
  }
  const words = note.split(/\s+/).length;
  return words >= 25 && words <= 120;
}

function templateDecision(facts: Record<string, unknown>): string {
  const g = (k: string) => pick(facts, k);
  if (!g("chosen_store") || g("chosen_store") === "none") {
    return `All three demo stores failed your mandate for ${g("product") || "this errand"}. QuickKart and BargainBay hide fees and pre-tick add-ons, so MePal refused to pay rather than chase the cheapest sticker. Loosen your mandate limits if you want to proceed, but the honesty rules always stay on.`;
  }
  const hidden = g("hidden_fees_after_cleaning");
  const noHidden = hidden.startsWith("$0.00") || hidden.startsWith("0");
  const hiddenBit = noHidden
    ? `No hidden fees remain after cleaning, so anything above the ${g("sticker_price")} sticker is tax and shipping.`
    : `${hidden} sits beyond the ${g("sticker_price")} sticker even after stripping pre-ticked extras (${g("preticked_addons_removed")}).`;
  const saved = g("saved_vs_naive");
  const savedBit = saved.startsWith("-") || saved.includes("extra")
    ? `that is ${saved.replace("paid extra for the honest pick", "more than the naive all-in price")}, the cost of an honest quote`
    : `so ${saved} compared with the naive all-in price`;
  return `MePal picked ${g("chosen_store")} (${g("verdict")}) for ${g("product")} at ${g("guarded_total")} all-in. ${hiddenBit} Honesty score ${g("honesty_score")}. The naive sticker pick, ${g("naive_pick")}, would really cost ${g("naive_all_in_total")}; ${savedBit}. Nothing is charged until you approve it on PayPal sandbox.`;
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
      if (note.length > 0 && noteIsSafe(note, block, kind, facts)) {
        return Response.json({ ok: true, note, source: "llm", model: llm.model });
      }
      console.warn("[MePal] AI note rejected by validator; using template.");
    }
    const note = kind === "decision" ? templateDecision(facts) : templateAudit(facts);
    return Response.json({ ok: true, note, source: "fallback" } satisfies { ok: true; note: string; source: ExplainNote["source"] });
  } catch (e) {
    console.error("[MePal] route error:", e instanceof Error ? e.message : e);
    return fail("internal_error", "The explainer hit an unexpected error. Try again.");
  }
}