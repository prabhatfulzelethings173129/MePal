import type { LedgerEntry } from "./types";

export const ZERO_HASH = "0".repeat(64);

export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export function loadLedger(): LedgerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("mepal:ledger:v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is LedgerEntry =>
        typeof e === "object" && e !== null && typeof (e as LedgerEntry).hash === "string" && typeof (e as LedgerEntry).type === "string"
    );
  } catch {
    return [];
  }
}

function saveLedger(entries: LedgerEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("mepal:ledger:v1", JSON.stringify(entries));
  } catch {
    // storage full or blocked; ledger stays in memory for this session
  }
}

// Hash chain: each entry seals canonicalJson(entry + prevHash), excluding its own hash field.
export async function appendEntry(core: Omit<LedgerEntry, "prevHash" | "hash">): Promise<LedgerEntry> {
  const entries = loadLedger();
  const prevHash = entries.length > 0 ? entries[entries.length - 1].hash : ZERO_HASH;
  const withPrev = { ...core, prevHash } as LedgerEntry;
  const hash = await sha256Hex(canonicalJson(withPrev));
  const entry: LedgerEntry = { ...withPrev, hash };
  entries.push(entry);
  saveLedger(entries);
  return entry;
}

export async function verifyChain(entries: LedgerEntry[]): Promise<{ ok: boolean; brokenAtIndex: number }> {
  let prev = ZERO_HASH;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const body: Record<string, unknown> = { ...e };
    delete body.hash;
    const expected = await sha256Hex(canonicalJson(body));
    if (expected !== e.hash || e.prevHash !== prev) {
      return { ok: false, brokenAtIndex: i };
    }
    prev = e.hash;
  }
  return { ok: true, brokenAtIndex: -1 };
}
