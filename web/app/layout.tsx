import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MePal: a trust layer for AI shopping",
  description:
    "MePal guards AI shopping errands with mandates, fee honesty scores, PayPal sandbox payments and hash-chained proof receipts.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
