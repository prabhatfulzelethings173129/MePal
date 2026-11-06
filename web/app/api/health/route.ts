import { llmHealthy } from "@/lib/llm";
import { PayPalError, getAccessToken, paypalConfigured } from "@/lib/paypal";

export async function POST() {
  const paypal: { configured: boolean; ok: boolean; error?: string } = {
    configured: paypalConfigured(),
    ok: false,
  };
  if (paypal.configured) {
    try {
      await getAccessToken();
      paypal.ok = true;
    } catch (e) {
      paypal.error = e instanceof PayPalError ? e.message : "PayPal sandbox is not reachable right now.";
    }
  } else {
    paypal.error = "PayPal not configured: set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in web/.env.local";
  }
  const llm = await llmHealthy();
  return Response.json({ ok: true, paypal, llm: { ok: llm.ok, model: llm.model } });
}
