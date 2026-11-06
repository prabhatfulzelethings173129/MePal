export const KEYS = {
  ledger: "mepal:ledger:v1",
  pending: "mepal:pending",
  mandate: "mepal:mandate:v1",
} as const;

export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked (private mode/quota): app still works for this session
  }
}

export function removeKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  code: string;
  details?: string;

  constructor(message: string, code: string, details?: string) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError("Could not reach the MePal server. Is `npm run dev` still running?", "network");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(`MePal server returned HTTP ${res.status} with an unreadable body.`, "bad_response");
  }
  const obj = data as { ok?: unknown; error?: unknown; code?: unknown; details?: unknown };
  if (obj.ok !== true) {
    throw new ApiError(
      typeof obj.error === "string" ? obj.error : `Request failed (HTTP ${res.status}).`,
      typeof obj.code === "string" ? obj.code : "unknown",
      typeof obj.details === "string" ? obj.details : undefined
    );
  }
  return data as T;
}

export function newId(prefix: string): string {
  const rnd =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rnd.replace(/-/g, "").slice(0, 16)}`;
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
