// What the Claude API calls cost, worked out from the tokens logged for every call (ai_usage_events).
// Prices are Anthropic's list prices in US dollars per million tokens (October 2026); update them here if they change.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-fable-5-1": { input: 10, output: 50 },
};
const DEFAULT_MODEL = "claude-opus-5-5"; // the app's default (lib/ai.ts), also used for calls logged without a known model
export const USD_TO_INR = 84; // approximate; for showing rupees only

export type AiCall = { parentId: string | null; ok: boolean; inputTokens: number; outputTokens: number; model?: string | null; purpose?: string | null; sessionId?: string | null; createdAt?: string | null };

// The response's model can carry a date or suffix ("claude-opus-5-5-…"): match the longest known name it starts with.
export function priceFor(model: string | null | undefined) {
  const id = (model ?? "").toLowerCase();
  const known = Object.keys(PRICES).filter((k) => id.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return { model: known ?? DEFAULT_MODEL, ...PRICES[known ?? DEFAULT_MODEL], known: Boolean(known) };
}

export const costOf = (c: AiCall) => {
  const p = priceFor(c.model);
  return (Number(c.inputTokens) * p.input + Number(c.outputTokens) * p.output) / 1e6;
};

const DAY = 864e5;
const dayKey = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function costSummary(calls: AiCall[], markedWorksheetIds: Set<string>, now = Date.now()) {
  const at = (c: AiCall) => (c.createdAt ? Date.parse(c.createdAt) : NaN);
  const month = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
  const sum = (list: AiCall[]) => list.reduce((t, c) => t + costOf(c), 0);
  const thisMonth = calls.filter((c) => !Number.isNaN(at(c)) && dayKey(at(c)).startsWith(month));
  const last30 = calls.filter((c) => !Number.isNaN(at(c)) && now - at(c) <= 30 * DAY);
  const reads = calls.filter((c) => c.purpose === "read_answers" && c.ok);
  // Per marked worksheet: every call made for it (reading each page, marking, and any retries or failures).
  const forMarked = calls.filter((c) => c.sessionId && markedWorksheetIds.has(c.sessionId));
  const marked = new Set(forMarked.map((c) => c.sessionId)).size;
  const daily = [...Array(30)].map((_, i) => {
    const d = dayKey(now - (29 - i) * DAY);
    return { day: d.slice(5).split("-").reverse().join("/"), usd: Math.round(sum(last30.filter((c) => dayKey(at(c)) === d)) * 100) / 100 };
  });
  const byModel = Object.entries(
    calls.reduce<Record<string, number>>((m, c) => ((m[priceFor(c.model).model] = (m[priceFor(c.model).model] ?? 0) + costOf(c)), m), {}),
  ).sort((a, b) => b[1] - a[1]);
  return {
    total: sum(calls),
    thisMonth: sum(thisMonth),
    last30: sum(last30),
    calls: calls.length,
    failed: calls.filter((c) => !c.ok).length,
    perWorksheet: marked ? sum(forMarked) / marked : null,
    perPage: reads.length ? sum(reads) / reads.length : null,
    reading: sum(calls.filter((c) => c.purpose === "read_answers")),
    marking: sum(calls.filter((c) => c.purpose === "grade_answers")),
    byModel,
    daily,
    unknownModels: calls.some((c) => c.model && !priceFor(c.model).known),
  };
}

export const usd = (n: number) => `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;
export const inr = (n: number) => `₹${Math.round(n * USD_TO_INR).toLocaleString("en-IN")}`;
