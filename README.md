# MePal - a trust layer for AI shopping (PayPal AI Hackathon)

MePal sits between a shopping AI agent and PayPal checkout and solves two surveyed problems at once:

1. **People will let AI recommend but not pay.** Forrester (June 2026) found about three quarters of online adults in the US, UK and Canada are uncomfortable letting an AI agent pay autonomously, even with preset spending limits.
2. **Hidden charges at checkout.** LocalCircles (2026) found 63% of Indian online payment users meet hidden charges or drip pricing, up from 52% two years earlier; a Datum Intelligence report (June 2026) found 69% of 12 studied platforms use drip pricing.

(Shown in the UI as "survey evidence, directional" with those source names.)

## What it does

Flow: `Errand -> Hunt -> Truth Check -> Guard -> Pay -> Proof -> Undo`

- **Mandate**: a permission slip for the agent (max total, max hidden-fee %, minimum honesty score, strip pre-ticked add-ons, confirm-above threshold). Exceptions can lift only the soft spending rules; honesty rules are hard.
- **Hunt**: the agent hunts 3 simulated demo stores (TrueMart, QuickKart, BargainBay).
- **Truth Check**: MePal computes the true total and a Fee Honesty Score (0-100, grade A-F) per store, plus tags (drip pricing, basket sneaking, false urgency, subscription trap) and a price-creep chart.
- **Guard**: mandate rules run per offer with verdicts FAST / CONFIRM / NEEDS_EXCEPTION / BLOCK.
- **Pay**: the winning offer is paid through the PayPal **sandbox** Orders API. Order amounts are built from a server-signed quote token only; the browser never sets amounts.
- **Proof**: the return page captures, verifies against live PayPal data, and seals an HMAC proof receipt into a SHA-256 hash-chained local ledger.
- **Undo**: one-click sandbox refund from the ledger, recorded in the chain.
- **Auditor**: paste any real checkout text (INR, USD, EUR, GBP) and see hidden charges versus the advertised price, avoidable pre-ticked extras and warnings.

This is a demo: the 3 stores are simulated, nothing ships, and every payment is PayPal sandbox.

## Architecture

- Next.js App Router + TypeScript + Tailwind, no database, no new npm packages beyond the framework.
- All money math is integer cents (`lib/money.ts`). Percentages are rounded for display only.
- `lib/` holds pure domain logic (catalog, truth, guard, signing, paypal, llm, ledger, storage).
- `app/api/*` route handlers all return `{ok:true,...}` or `{ok:false,error,code,details?}` and never throw to the client.
- The main page and components are client components; the layout and `/how-it-works` are static server components.
- Compatible with Cache Components: no route segment config exports, no cache directives, no dynamic APIs during render.

## PayPal APIs used (sandbox only, base URL hard-coded to https://api-m.sandbox.paypal.com)

| Purpose | Call |
| --- | --- |
| Access token | `POST /v1/oauth2/token` (client credentials, cached) |
| Create order | `POST /v2/checkout/orders` (CAPTURE, full breakdown, PayPal-Request-Id) |
| Show order | `GET /v2/checkout/orders/{id}` |
| Capture | `POST /v2/checkout/orders/{id}/capture` (handles ORDER_ALREADY_CAPTURED) |
| Refund (Undo) | `POST /v2/payments/captures/{id}/refund` |

## How AI is used - and what it cannot do

AI (any OpenAI-compatible endpoint via `lib/llm.ts`; defaults target a local Ollama `llama3.2:3b`) is used only to:

1. parse the errand text into product/qty/budget,
2. extract lines from pasted checkout text in the Auditor,
3. write short explanations from numbers the code hands it.

AI never touches money: prices, scores, rules, verdicts, signing and PayPal calls are plain code. Every AI feature has a code fallback (keyword parser, regex line extractor, template writer), so the app is fully usable with no model. All model output is validated and clamped before use.

## Security model

- The server creates the PayPal order only from the signed quote token (HMAC-SHA256, 10-minute expiry); the token lines must exactly match a server-rebuilt quote.
- CONFIRM requires an explicit user confirmation; NEEDS_EXCEPTION requires an explicit one-time exception; BLOCK is never payable.
- Secrets are server-only (`PAYPAL_CLIENT_ID/SECRET`, `MEPAL_SIGNING_SECRET`, `LLM_API_KEY`); nothing secret is exposed to the browser and there is no PayPal client-side SDK.
- PayPal-Request-Id values derive from the quote id, so capture retries are idempotent.
- The ledger is hash-chained per entry and each purchase is sealed with `hmacSeal(orderId|captureId|amount|currency)`; the Ledger tab re-verifies seals against live PayPal data.

## Setup

1. Create a **PayPal sandbox app** at developer.paypal.com (Apps & Credentials > Sandbox > Create App) and a **sandbox personal (buyer) account** with some test funds.
2. Copy `web/.env.example` to `web/.env.local` and fill in `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and any long random string for `MEPAL_SIGNING_SECRET`. `APP_BASE_URL` defaults to `http://localhost:3000`.
3. Run the app:

```
cd web
npm run dev
```

4. Open http://localhost:3000. The header should show "PayPal sandbox connected".
5. Optional AI: install Ollama and `ollama pull llama3.2:3b`, or point `LLM_BASE_URL` at any OpenAI-compatible endpoint. Without it, the UI shows "AI offline, fallbacks active" and everything still works.

## Test script (3 scenarios + audit)

1. **Hub (CONFIRM path)** - click the preset "I need a USB-C hub, keep it under $40" and Run errand. TrueMart: sticker $34.00, true total $36.72, honesty 100 (A), verdict CONFIRM. QuickKart: raw $42.84, cleaned $39.85, honesty 25 (F), BLOCKED. BargainBay: raw $43.53, cleaned $37.54, honesty 28 (F), BLOCKED. Naive pick QuickKart would cost $42.84 ($15.64 hidden surprise); MePal's pick saves $6.12. Tick "I reviewed the full price", pay in the sandbox window, land on the receipt, see the sealed Proof Receipt.
2. **Mouse (FAST path)** - "Get me a wireless mouse under $25": TrueMart $19.98 all-in, verdict FAST, one click to pay.
3. **Keyboard (exception path)** - "Buy a mechanical keyboard, max $70": TrueMart $88.56 exceeds both the mandate and the errand budget, so MePal asks for a one-time exception to the spending limit (honesty rules untouched) before the button unlocks.
4. **Auditor** - Auditor tab > Load example (INR): advertised 499, would pay 626 (+21.8% hidden), avoidable pre-ticked tip 20, honesty 60 (C). Save it to the ledger.

## Honest limitations

- The three stores are simulated; catalog and fee schedules are demo data.
- Sandbox only: no real money moves, nothing ships.
- Survey statistics are directional, cited from third-party sources.
- AI output is validated in code and never required.
- The ledger lives in one browser's localStorage; clearing it clears receipts (export JSON first).

## Roadmap

- PayPal Agent Toolkit / MCP integration for real agents.
- Webhooks (CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED) instead of return-page capture.
- A merchant plugin exposing machine-readable fee schedules.
- INR + multi-currency shopping flow (Auditor already multi-currency).
- A browser extension that audits live checkout pages.
