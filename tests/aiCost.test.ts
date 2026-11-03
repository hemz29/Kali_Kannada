import { describe, expect, it } from "vitest";
import { costOf, costSummary, priceFor } from "@/lib/aiCost";

const NOW = Date.parse("2026-11-03T10:00:00Z");
const ago = (d: number) => new Date(NOW - d * 864e5).toISOString();

describe("AI cost", () => {
  it("prices calls by model, matching dated model names and falling back to Opus 5.5", () => {
    expect(costOf({ parentId: "p", ok: true, inputTokens: 1_000_000, outputTokens: 1_000_000, model: "claude-opus-5-5" })).toBeCloseTo(24);
    expect(costOf({ parentId: "p", ok: true, inputTokens: 1_000_000, outputTokens: 0, model: "claude-haiku-5-5-20261001" })).toBeCloseTo(0.1);
    expect(priceFor("claude-sonnet-5-5").model).toBe("claude-sonnet-5-5");
    expect(priceFor("demo-model")).toMatchObject({ model: "claude-opus-5-5", known: false });
  });
  it("sums this month, per worksheet and per page", () => {
    const call = (purpose: string, sessionId: string, daysAgo: number, inT = 6000, outT = 3000) => ({ parentId: "p", ok: true, inputTokens: inT, outputTokens: outT, model: "claude-opus-5-5", purpose, sessionId, createdAt: ago(daysAgo) });
    const calls = [call("read_answers", "s1", 1), call("read_answers", "s1", 1), call("grade_answers", "s1", 1, 3000, 2000), call("read_answers", "s2", 40)];
    const s = costSummary(calls, new Set(["s1"]), NOW);
    const page = (6000 * 4 + 3000 * 20) / 1e6; // $0.084
    expect(s.perPage).toBeCloseTo(page);
    expect(s.perWorksheet).toBeCloseTo(2 * page + (3000 * 4 + 2000 * 20) / 1e6);
    expect(s.last30).toBeCloseTo(s.perWorksheet!);
    expect(s.daily).toHaveLength(30);
    expect(s.calls).toBe(4);
  });
});
