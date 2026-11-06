import type { Currency } from "./types";

export interface AuditExample {
  id: string;
  label: string;
  currency: Currency;
  advertised: number;
  text: string;
}

export const AUDIT_EXAMPLES: AuditExample[] = [
  {
    id: "inr",
    label: "INR food delivery (drip fees + pre-ticked tip)",
    currency: "INR",
    advertised: 499,
    text: [
      "Item total \u20B9499",
      "Delivery fee \u20B940",
      "Handling fee \u20B915",
      "Platform fee \u20B99",
      "Surge fee \u20B925",
      "GST \u20B918",
      "Tip \u20B920 (pre-selected)",
      "To pay \u20B9626",
    ].join("\n"),
  },
  {
    id: "usd",
    label: "USD electronics store (fees + protection plan)",
    currency: "USD",
    advertised: 59,
    text: [
      "Subtotal $59.00",
      "Service fee $6.49",
      "Convenience fee $4.00",
      "Shipping $7.95",
      "Protection plan $5.99 (added)",
      "Tax $5.21",
      "Total $88.64",
    ].join("\n"),
  },
];

export const ERRAND_PRESETS: string[] = [
  "I need a USB-C hub, keep it under $40",
  "Get me a wireless mouse under $25",
  "Buy a mechanical keyboard, max $70",
];
