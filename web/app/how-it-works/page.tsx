import type { Metadata } from "next";
import Link from "next/link";
import { Chip, Logo } from "@/components/ui";

export const metadata: Metadata = {
  title: "How MePal works",
  description: "The problem, the architecture, the PayPal APIs, the security model and the honest limitations of MePal.",
};

const EVIDENCE: { text: string; source: string }[] = [
  {
    text: "About three quarters of online adults in the US, UK and Canada are uncomfortable letting an AI agent pay autonomously, even with preset spending limits.",
    source: "Forrester, June 2026",
  },
  {
    text: "63% of Indian online payment users hit hidden charges or drip pricing at checkout, up from 52% two years earlier. A Datum Intelligence study of 12 platforms found 69% using drip pricing.",
    source: "LocalCircles 2026; Datum Intelligence, June 2026",
  },
];

const DIVISION: { who: string; tone: "ai" | "code" | "paypal"; items: string[] }[] = [
  {
    who: "AI does",
    tone: "ai",
    items: [
      "Parses the errand sentence into product, quantity and budget (with a keyword fallback).",
      "Extracts lines from pasted checkout text in the Auditor (with a regex fallback).",
      "Writes short explanations from numbers the code hands it (with a template fallback).",
    ],
  },
  {
    who: "Code does",
    tone: "code",
    items: [
      "Builds all quotes and prices in integer cents.",
      "Computes the Fee Honesty Score, tags and price-creep stages.",
      "Enforces the mandate: hard rules can never be overridden by exceptions.",
      "Signs quotes with HMAC, verifies seals, chains the ledger with SHA-256.",
    ],
  },
  {
    who: "PayPal does",
    tone: "paypal",
    items: [
      "OAuth 2.0 client-credentials access tokens (cached).",
      "Orders: create, show, capture on the sandbox REST API.",
      "Payments: full refund of a capture for Undo.",
      "The buyer approves on PayPal; MePal never sees the login.",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <Logo />
        <Link href="/" className="rounded-lg bg-[#0070ba] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#2a8de0]">
          Open the demo
        </Link>
      </div>

      <section className="rounded-2xl border border-[#1f2b46] bg-[#111a2e] p-5">
        <h1 className="text-xl font-bold text-[#e8eefc]">MePal: a trust layer for AI shopping</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#cdd9f2]">
          MePal sits between a shopping AI agent and PayPal checkout. The agent hunts three simulated stores, MePal computes the
          true total and a Fee Honesty Score for each, enforces the buyer{"'"}s mandate, strips pre-ticked add-ons, pays through the
          PayPal sandbox, seals a hash-chained Proof Receipt verified live against PayPal, and offers a one-click refund. Flow:{" "}
          <span className="num">Errand {"\u2192"} Hunt {"\u2192"} Truth Check {"\u2192"} Guard {"\u2192"} Pay {"\u2192"} Proof {"\u2192"} Undo</span>.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {EVIDENCE.map(f => (
            <div key={f.source} className="rounded-xl border border-[#1f2b46] bg-[#0d1526] p-3">
              <p className="text-sm leading-relaxed text-[#cdd9f2]">{f.text}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip tone="muted">{f.source}</Chip>
                <Chip tone="warn">survey evidence, directional</Chip>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#1f2b46] bg-[#111a2e] p-5">
        <h2 className="text-lg font-semibold text-[#e8eefc]">Architecture</h2>
        <svg viewBox="0 0 640 300" className="mt-3 w-full" role="img" aria-label="MePal architecture diagram">
          <rect x="20" y="30" width="160" height="64" rx="10" fill="#16233f" stroke="#1f2b46" />
          <text x="100" y="56" textAnchor="middle" fill="#e8eefc" fontSize="13" fontWeight="700">
            Browser (client)
          </text>
          <text x="100" y="74" textAnchor="middle" fill="#8da2c8" fontSize="10">
            UI {"\u00B7"} hash-chained ledger
          </text>

          <rect x="240" y="30" width="200" height="88" rx="10" fill="#16233f" stroke="#2a8de0" />
          <text x="340" y="54" textAnchor="middle" fill="#e8eefc" fontSize="13" fontWeight="700">
            Next.js API routes
          </text>
          <text x="340" y="72" textAnchor="middle" fill="#8da2c8" fontSize="10">
            hunt {"\u00B7"} truth {"\u00B7"} guard {"\u00B7"} sign
          </text>
          <text x="340" y="90" textAnchor="middle" fill="#8da2c8" fontSize="10">
            PayPal proxy {"\u00B7"} AI proxy
          </text>
          <text x="340" y="108" textAnchor="middle" fill="#22c7a0" fontSize="10">
            signed quote token lives here
          </text>

          <rect x="500" y="14" width="120" height="56" rx="10" fill="#0c2438" stroke="#0070ba" />
          <text x="560" y="38" textAnchor="middle" fill="#e8eefc" fontSize="12" fontWeight="700">
            PayPal sandbox
          </text>
          <text x="560" y="54" textAnchor="middle" fill="#8da2c8" fontSize="9">
            Orders {"\u00B7"} Payments REST
          </text>

          <rect x="500" y="88" width="120" height="56" rx="10" fill="#241a3f" stroke="#8b5cf6" />
          <text x="560" y="112" textAnchor="middle" fill="#e8eefc" fontSize="12" fontWeight="700">
            AI endpoint
          </text>
          <text x="560" y="128" textAnchor="middle" fill="#8da2c8" fontSize="9">
            optional {"\u00B7"} validated in code
          </text>

          <rect x="240" y="200" width="200" height="70" rx="10" fill="#0f2f28" stroke="#22c7a0" />
          <text x="340" y="228" textAnchor="middle" fill="#e8eefc" fontSize="12" fontWeight="700">
            Proof Receipt
          </text>
          <text x="340" y="246" textAnchor="middle" fill="#8da2c8" fontSize="10">
            HMAC seal + SHA-256 chain
          </text>
          <text x="340" y="261" textAnchor="middle" fill="#8da2c8" fontSize="9">
            re-verifiable against PayPal any time
          </text>

          <line x1="180" y1="62" x2="238" y2="62" stroke="#4aa3e8" strokeWidth="2" markerEnd="url(#arr)" />
          <line x1="440" y1="48" x2="498" y2="44" stroke="#4aa3e8" strokeWidth="2" markerEnd="url(#arr)" />
          <line x1="440" y1="104" x2="498" y2="112" stroke="#b79bff" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#arr)" />
          <line x1="560" y1="70" x2="440" y2="220" stroke="#22c7a0" strokeWidth="2" markerEnd="url(#arr)" />
          <line x1="240" y1="235" x2="120" y2="96" stroke="#22c7a0" strokeWidth="2" markerEnd="url(#arr)" />

          <defs>
            <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill="#8da2c8" />
            </marker>
          </defs>
        </svg>
        <p className="mt-2 text-xs text-[#8da2c8]">
          The signed quote token (HMAC-SHA256, 10-minute expiry) is created server-side after the guard passes and must be presented
          back to create the PayPal order. Amounts are always rebuilt from that token, never from the browser.
        </p>
      </section>

      <section className="rounded-2xl border border-[#1f2b46] bg-[#111a2e] p-5">
        <h2 className="text-lg font-semibold text-[#e8eefc]">Who does what</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {DIVISION.map(d => (
            <div key={d.who} className="rounded-xl border border-[#1f2b46] bg-[#0d1526] p-3">
              <Chip tone={d.tone}>{d.who}</Chip>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-[#cdd9f2]">
                {d.items.map(i => (
                  <li key={i}>{"\u2022"} {i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#1f2b46] bg-[#111a2e] p-5">
        <h2 className="text-lg font-semibold text-[#e8eefc]">PayPal APIs used (sandbox only)</h2>
        <ul className="num mt-2 space-y-1.5 text-xs text-[#cdd9f2]">
          <li>{"\u2022"} OAuth2 token: POST /v1/oauth2/token (grant_type=client_credentials, cached until expiry minus 60s)</li>
          <li>{"\u2022"} Create order: POST /v2/checkout/orders (intent CAPTURE, full amount breakdown, request-id per quote)</li>
          <li>{"\u2022"} Show order: GET /v2/checkout/orders/&#123;id&#125; (status, custom_id, capture amount)</li>
          <li>{"\u2022"} Capture: POST /v2/checkout/orders/&#123;id&#125;/capture (idempotent request-id, handles ORDER_ALREADY_CAPTURED)</li>
          <li>{"\u2022"} Refund: POST /v2/payments/captures/&#123;id&#125;/refund (full refund for Undo)</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-[#1f2b46] bg-[#111a2e] p-5">
        <h2 className="text-lg font-semibold text-[#e8eefc]">Security model</h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-[#cdd9f2]">
          <li>{"\u2022"} The server builds order amounts only from a signed quote; the browser never sends money numbers.</li>
          <li>{"\u2022"} Hard rules (hidden-fee percent, honesty score) cannot be lifted by exceptions; exceptions touch soft spending limits only.</li>
          <li>{"\u2022"} Secrets stay server-side: no secrets are exposed to the browser env, no PayPal client SDK in the browser, REST called with fetch only.</li>
          <li>{"\u2022"} PayPal-Request-Id values are derived from the quote id, so capture retries are idempotent.</li>
          <li>{"\u2022"} The ledger is hash-chained (SHA-256 over canonical JSON) and the purchase row is sealed with an HMAC over order, capture, amount and currency; the Ledger tab re-verifies the seal against live PayPal data.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-[#1f2b46] bg-[#111a2e] p-5">
        <h2 className="text-lg font-semibold text-[#e8eefc]">Honest limitations</h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-[#cdd9f2]">
          <li>{"\u2022"} The three stores are simulated; the catalog and fee schedules are demo data.</li>
          <li>{"\u2022"} Every payment is PayPal sandbox: no real money moves and nothing ships.</li>
          <li>{"\u2022"} The survey statistics are directional evidence from the cited sources, not our own measurements.</li>
          <li>{"\u2022"} AI output is length- and schema-validated in code and always has a code fallback; AI never touches prices or rules.</li>
          <li>{"\u2022"} The ledger lives in localStorage on one device: clearing browser data clears receipts (export JSON first).</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-[#1f2b46] bg-[#111a2e] p-5">
        <h2 className="text-lg font-semibold text-[#e8eefc]">Roadmap</h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-[#cdd9f2]">
          <li>{"\u2022"} PayPal Agent Toolkit and MCP integration so real agents can request mandate-scoped quotes.</li>
          <li>{"\u2022"} Webhooks (CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED) instead of return-page capture.</li>
          <li>{"\u2022"} A merchant plugin so real checkouts can expose machine-readable fee schedules.</li>
          <li>{"\u2022"} INR and multi-currency shopping flow (the Auditor already supports INR, USD, EUR and GBP).</li>
          <li>{"\u2022"} Browser extension that audits any live checkout page automatically.</li>
        </ul>
      </section>

      <p className="pb-6 text-center text-[11px] text-[#44506e]">
        MePal {"\u00B7"} PayPal AI Hackathon demo {"\u00B7"} simulated stores {"\u00B7"} sandbox payments {"\u00B7"} nothing ships
      </p>
    </main>
  );
}
