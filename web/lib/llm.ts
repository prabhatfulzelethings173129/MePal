export interface ChatMsg {
  role: "system" | "user";
  content: string;
}

export interface LlmChatResult {
  ok: boolean;
  content?: string;
  model?: string;
  error?: string;
}

function baseUrl(): string {
  return (process.env.LLM_BASE_URL || "").trim().replace(/\/+$/, "");
}

function model(): string {
  return (process.env.LLM_MODEL || "").trim();
}

function apiKey(): string {
  return (process.env.LLM_API_KEY || "").trim();
}

export async function llmChat(messages: ChatMsg[], maxTokens: number, timeoutMs = 9000): Promise<LlmChatResult> {
  const base = baseUrl();
  const mdl = model();
  if (!base || !mdl) return { ok: false, error: "llm_not_configured" };
  const key = apiKey();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ model: mdl, messages, max_tokens: maxTokens, temperature: 0.2 }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `llm_http_${res.status}` };
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return { ok: false, error: "llm_empty" };
    return { ok: true, content, model: mdl };
  } catch {
    return { ok: false, error: "llm_unreachable" };
  }
}

export async function llmHealthy(): Promise<{ ok: boolean; model?: string }> {
  const base = baseUrl();
  const mdl = model();
  if (!base || !mdl) return { ok: false };
  const key = apiKey();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${base}/models`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return { ok: res.ok, model: mdl };
  } catch {
    return { ok: false };
  }
}

// Extracts the first balanced JSON object from model text, tolerating code fences.
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
