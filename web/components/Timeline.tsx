"use client";

import { SourceBadges } from "./SourceBadge";

export type StepStatus = "waiting" | "running" | "done" | "error";

export type StepKey =
  | "understand"
  | "hunt"
  | "truth"
  | "guard"
  | "decide"
  | "pay"
  | "proof"
  | "capture"
  | "verify"
  | "seal";

export interface StepView {
  key: string;
  label: string;
  who: string;
  status: StepStatus;
  note?: string;
}

const STATE_LABEL: Record<StepStatus, string> = {
  waiting: "waiting",
  running: "running",
  done: "done",
  error: "error",
};

export function Timeline({ steps }: { steps: StepView[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map(s => {
        const ring =
          s.status === "done"
            ? "bg-[#103b31] text-[#22c7a0] border-[#1d5a4b]"
            : s.status === "running"
              ? "bg-[#0c2438] text-[#4aa3e8] border-[#1a4a75] pulse-dot"
              : s.status === "error"
                ? "bg-[#331419] text-[#ef4b5f] border-[#5c2229]"
                : "bg-[#0b1220] text-[#44506e] border-[#1f2b46]";
        const glyph = s.status === "done" ? "\u2713" : s.status === "error" ? "\u2717" : s.status === "running" ? "\u25CF" : "";
        return (
          <li key={s.key} className="flex items-start gap-3">
            <span aria-hidden className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${ring}`}>
              {glyph}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-sm font-medium ${s.status === "waiting" ? "text-[#8da2c8]" : "text-[#e8eefc]"}`}>{s.label}</span>
                <SourceBadges who={s.who} />
                <span className="text-[10px] uppercase tracking-wider text-[#44506e]">{STATE_LABEL[s.status]}</span>
              </div>
              {s.note && <p className="num mt-0.5 text-xs text-[#8da2c8]">{s.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
