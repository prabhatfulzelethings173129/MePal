"use client";

import type { ReactNode } from "react";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/types";

export const INPUT_CLS =
  "w-full rounded-lg border border-[#1f2b46] bg-[#0b1220] px-3 py-2 text-sm text-[#e8eefc] outline-none placeholder:text-[#44506e] focus:border-[#2a8de0]";

type Tone = "ok" | "warn" | "bad" | "info" | "ai" | "code" | "paypal" | "muted";

const TONES: Record<Tone, string> = {
  ok: "bg-[#0f2f28] text-[#22c7a0] border-[#1d4a3f]",
  warn: "bg-[#33270d] text-[#f5a524] border-[#5a431a]",
  bad: "bg-[#331419] text-[#ef4b5f] border-[#5c2229]",
  info: "bg-[#10233f] text-[#7fb3ff] border-[#1f3c66]",
  ai: "bg-[#241a3f] text-[#b79bff] border-[#3d2f66]",
  code: "bg-[#1b2436] text-[#a9b8d8] border-[#2a3a5c]",
  paypal: "bg-[#0c2438] text-[#4aa3e8] border-[#1a4a75]",
  muted: "bg-[#141d31] text-[#8da2c8] border-[#1f2b46]",
};

export function Chip({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Panel({
  title,
  subtitle,
  right,
  children,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#1f2b46] bg-[#111a2e] p-4 sm:p-5">
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-semibold text-[#e8eefc]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-[#8da2c8]">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-[#0070ba] hover:bg-[#2a8de0] text-white border border-transparent",
    ghost: "bg-transparent text-[#cdd9f2] border border-[#1f2b46] hover:border-[#2a8de0]",
    danger: "bg-[#ef4b5f] hover:bg-[#ff5f73] text-white border border-transparent",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#cdd9f2]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[#8da2c8]">{hint}</span>}
    </label>
  );
}

export function Money({ cents, currency = "USD", className = "" }: { cents: number; currency?: Currency; className?: string }) {
  return <span className={`num ${className}`}>{formatMoney(cents, currency)}</span>;
}

export function ErrorNote({ error, details }: { error?: string | null; details?: string | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-lg border border-[#5c2229] bg-[#331419] px-3 py-2 text-sm text-[#ffb3bc]">
      {error}
      {details && <span className="ml-1 text-xs text-[#d98a94]">(PayPal debug id: {details})</span>}
    </div>
  );
}

export function Stat({ label, value, tone = "muted" }: { label: string; value: string; tone?: "ok" | "bad" | "muted" }) {
  const color = tone === "ok" ? "text-[#22c7a0]" : tone === "bad" ? "text-[#ef4b5f]" : "text-[#e8eefc]";
  return (
    <div className="rounded-xl border border-[#1f2b46] bg-[#111a2e] px-3 py-2.5">
      <div className="text-[11px] text-[#8da2c8]">{label}</div>
      <div className={`num mt-0.5 text-base font-bold ${color}`}>{value}</div>
    </div>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 1.7l8.5 3.2v6.3c0 5.2-3.5 8.9-8.5 11.1C7 20.1 3.5 16.4 3.5 11.2V4.9L12 1.7z" fill="#0070ba" />
        <path d="M8.4 11.6l2.5 2.5 4.7-4.9" fill="none" stroke="#e8eefc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-lg font-bold tracking-tight text-[#e8eefc]">
        Me<span className="text-[#2a8de0]">Pal</span>
      </span>
    </span>
  );
}
