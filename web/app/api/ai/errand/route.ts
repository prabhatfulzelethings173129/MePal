import { PRODUCTS, matchProduct, productBySku } from "@/lib/catalog";
import { parseAmountToCents } from "@/lib/money";
import { clampInt, clampOptionalCents } from "@/lib/guard";
import { extractJsonObject, llmChat } from "@/lib/llm";

const fail = (code: string, error: string, details?: string) =>
  Response.json({ ok: false, error, code, ...(details ? { details } : {}) });

const PRODUCT_LIST = PRODUCTS.map(p => p.name).join(", ");
const BUDGET_RE = /(under|below|maximum|max|less than|up to|within|budget of)\s*\$?\s*([\d][\d,]*(?:\.\d{1,2})?)/i;

function budgetFromText(text: string): number | null {
  const m = BUDGET_RE.exec(text);
  if (!m) return null;
  const cents = parseAmountToCents(m[2]);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 500) : "";
    if (!text) return fail("bad_input", "Type a shopping errand first, e.g. 'I need a USB-C hub under $40'.");

    let sku: string | null = null;
    let qty = 1;
    let budgetCents = budgetFromText(text);
    let source: "llm" | "fallback" = "fallback";
    let model: string | undefined;

    const llm = await llmChat(
      [
        {
          role: "system",
          content:
            'You map a shopping errand to JSON. Products: hub, mouse, powerbank, stand, keyboard. Respond with ONLY minified JSON, no markdown: {"sku": <"hub"|"mouse"|"powerbank"|"stand"|"keyboard"|null>, "qty": <integer 1-5>, "budget": <positive number in the currency mentioned, or null>}',
        },
        { role: "user", content: `Errand: ${text}` },
      ],
      120
    );
    if (llm.ok && llm.content) {
      const obj = extractJsonObject(llm.content);
      if (obj) {
        const rawSku = typeof obj.sku === "string" ? obj.sku : null;
        const hit = rawSku ? productBySku(rawSku) : null;
        if (hit) sku = hit.sku;
        qty = clampInt(typeof obj.qty === "number" ? obj.qty : NaN, 1, 5, 1);
        if (typeof obj.budget === "number" && Number.isFinite(obj.budget) && obj.budget > 0) {
          const c = parseAmountToCents(String(obj.budget));
          if (Number.isFinite(c) && c > 0) budgetCents = c;
        }
        if (sku) {
          source = "llm";
          model = llm.model;
        }
      }
    }

    if (!sku) {
      const hit = matchProduct(text);
      if (hit) sku = hit.sku;
    }
    if (!sku) {
      return fail(
        "no_product",
        `I could not tell which product you want. MePal demo stores sell: ${PRODUCT_LIST}. Try naming one of them.`
      );
    }

    return Response.json({
      ok: true,
      sku,
      qty,
      budgetCents: clampOptionalCents(budgetCents, 1, 10000000),
      source,
      model,
    });
  } catch (e) {
    console.error("[MePal] route error:", e instanceof Error ? e.message : e);
    return fail("internal_error", "The errand parser hit an unexpected error. Try again.");
  }
}
