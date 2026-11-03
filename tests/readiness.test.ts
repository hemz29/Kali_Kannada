import { describe, expect, it } from "vitest";
import { getLesson, getWorksheet } from "@/content";
import type { QuestionType } from "@/content/schema";
import { EXAM_MARKS, examBlueprint, readiness } from "@/lib/readiness";
import type { PracticeSession, QuestionAttempt } from "@/lib/store/types";

const NOW = Date.parse("2026-11-20T10:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 864e5).toISOString();
const PN = { date: "2026-12-01", lessonIds: ["panchatantra", "nanna-desha"] };

let n = 0;
function session(worksheetId: string, kind: PracticeSession["kind"], ago: number, extra: Partial<PracticeSession> = {}): PracticeSession {
  return {
    id: `s${++n}`, parentId: "p", childId: "c", kind, worksheetId, retryOf: null, status: "graded", markingVersion: "v", help: {},
    awarded: 0, max: 0, startedAt: daysAgo(ago), writingDoneAt: null, completedAt: daysAgo(ago), ...extra,
  };
}
function attempt(s: PracticeSession, questionId: string, type: QuestionType, right: boolean, helpLevel = 0): QuestionAttempt {
  return {
    id: `a${++n}`, sessionId: s.id, parentId: "p", childId: "c", questionId, type, skill: "vocabulary", pageId: null, region: null, text: "x",
    confidence: "high", uncertainWords: [], readingConfirmed: true, misreadFlagged: false, helpLevel, awarded: right ? 1 : 0, max: 1,
    status: right ? "correct" : "incorrect", method: "key", feedback: null, markingVersion: "v", createdAt: s.completedAt!,
  };
}
// A finished worksheet where the first `right` questions are correct (with an optional hint level on every answer).
function sheet(worksheetId: string, ago: number, right: number, helpLevel = 0, minutes?: number, blanks = 0) {
  const w = getWorksheet(worksheetId)!;
  const qs = w.sections.flatMap((x) => x.questions);
  const s = session(worksheetId, "worksheet", ago, {
    awarded: Math.min(right, qs.length), max: qs.length,
    help: helpLevel ? Object.fromEntries(qs.map((q) => [q.id, helpLevel])) : {},
    startedAt: daysAgo(ago + (minutes ?? 50) / 1440), completedAt: daysAgo(ago), writingDoneAt: daysAgo(ago),
  });
  const a = qs.map((q, i) => attempt(s, q.id, q.type, i < right, helpLevel));
  // The last `blanks` answers were left empty.
  for (const x of a.slice(a.length - blanks)) Object.assign(x, { status: "blank", text: "", awarded: 0 });
  return { s, a };
}
// Every card question of one kind from a lesson, all answered right.
function cards(lessonId: string, type: QuestionType, ago: number) {
  const qs = getLesson(lessonId)!.exercises.filter((e) => e.type === type).flatMap((e) => e.questions);
  const s = session(`cards:${lessonId}`, "cards", ago, { awarded: qs.length, max: qs.length });
  return { s, a: qs.map((q) => attempt(s, q.id, type, true)) };
}
const run = (...parts: { s: PracticeSession; a: QuestionAttempt[] }[]) => readiness(parts.flatMap((p) => p.a), parts.map((p) => p.s), PN, NOW);

describe("exam readiness", () => {
  it("uses the real term paper for Panchatantra + Nanna Desha, and always totals 40 marks", () => {
    const test1 = getWorksheet("test-1")!;
    const paper: Record<string, number> = {};
    for (const q of test1.sections.flatMap((x) => x.questions)) paper[q.type] = (paper[q.type] ?? 0) + 1;
    expect(examBlueprint(PN.lessonIds)).toEqual(paper);
    for (const ids of [["kugutide-pakshi"], ["nanna-desha"], ["panchatantra"], []])
      expect(Object.values(examBlueprint(ids)).reduce((t, m) => t + m!, 0)).toBeCloseTo(EXAM_MARKS);
  });

  it("shows no number until the exam chapters are chosen", () => {
    const r = readiness(sheet("test-1", 1, 30).a, [sheet("test-1", 1, 30).s], { date: null, lessonIds: [] }, NOW);
    expect(r.missing).toBe("chapters");
    expect(r.enoughEvidence).toBe(false);
  });

  it("shows no number from tap cards alone, and counts down to the exam date", () => {
    const r = run(cards("panchatantra", "opposite", 1), cards("nanna-desha", "opposite", 2));
    expect(r.missing).toBe("practice");
    expect(r.daysToGo).toBe(11);
  });

  it("gives the paper's own mark from one paper, with a ±4 range", () => {
    const r = run(sheet("test-1", 1, 30));
    expect(r.enoughEvidence).toBe(true);
    expect(Math.round(r.predicted)).toBe(30);
    expect(r.high - r.low).toBe(8);
    expect(r.ticks.find((t) => t.id === "papers")!.detail).toBe("1 of 4 done");
  });

  it("uses the latest try of a paper and ignores papers older than two weeks", () => {
    const retry = run(sheet("test-1", 3, 20), sheet("test-1", 1, 36));
    expect(Math.round(retry.predicted)).toBe(36);
    expect(retry.papers).toBe(1);
    expect(run(sheet("test-1", 15, 36)).missing).toBe("practice");
  });

  it("counts answers written with Hint 1 as half", () => {
    expect(Math.round(run(sheet("test-1", 1, 30, 1)).predicted)).toBe(15);
  });

  it("gives Exam ready for 4 different strong papers with every check done", () => {
    const r = run(sheet("test-1", 1, 38), sheet("test-2", 3, 38), sheet("test-3", 5, 38), sheet("panchatantra-practice-a", 7, 25, 0, 35));
    expect(r.pct).toBeGreaterThanOrEqual(85);
    expect(r.ticks.filter((t) => !t.done).map((t) => `${t.id}: ${t.detail}`)).toEqual([]);
    expect(r.level).toBe("ready");
    expect(r.high - r.low).toBe(4);
  });

  it("holds strong scores at Nearly ready while a check is missing", () => {
    const late = run(sheet("test-1", 1, 38, 0, 75), sheet("test-2", 3, 38), sheet("test-3", 5, 38), sheet("panchatantra-practice-a", 7, 25, 0, 35));
    expect(late.level).toBe("nearly");
    expect(late.ticks.find((t) => t.id === "on_time")!.done).toBe(false);
    const blank = run(sheet("test-1", 1, 38, 0, 50, 1), sheet("test-2", 3, 38), sheet("test-3", 5, 38), sheet("panchatantra-practice-a", 7, 25, 0, 35));
    expect(blank.ticks.find((t) => t.id === "answered")!.detail).toBe("1 left blank");
    expect(blank.level).toBe("nearly");
  });

  it("never rewards attempting everything when the answers are wrong", () => {
    const r = run(sheet("test-1", 1, 0)); // every question attempted, all wrong
    expect(r.pct).toBe(0);
    expect(r.level).toBe("starting");
    expect(r.ticks[0]).toMatchObject({ id: "correct", done: false });
    for (const id of ["answered", "spelling", "complete", "on_time"]) expect(r.ticks.find((t) => t.id === id)).toMatchObject({ done: false, muted: true });
    expect(r.ticks.find((t) => t.id === "papers")!.muted).toBeFalsy();
  });

  it("puts correct answers first and says how many are needed", () => {
    const r = run(sheet("test-1", 1, 30));
    expect(r.ticks.map((t) => t.id)).toEqual(["correct", "answered", "spelling", "complete", "on_time", "papers"]);
    expect(r.ticks[0]).toMatchObject({ done: false, detail: "about 30 of 40 (34 needed)" });
    expect(r.ticks.find((t) => t.id === "answered")!.done).toBe(true);
  });

  it("doesn't count the same paper four times as four papers", () => {
    const r = run(sheet("test-1", 1, 38), sheet("test-1", 3, 38), sheet("test-1", 5, 38), sheet("test-1", 7, 38));
    expect(r.papers).toBe(1);
    expect(r.ticks.find((t) => t.id === "papers")!.done).toBe(false);
    expect(r.level).not.toBe("ready");
  });

  it("points to the parts of the paper with the most marks still to win", () => {
    const r = run(sheet("test-1", 2, 20));
    expect(r.gains.length).toBeGreaterThan(0);
    expect(r.gains[0].marks).toBeGreaterThanOrEqual(r.gains.at(-1)!.marks);
    for (const g of r.gains) expect(g.href).toMatch(/^\/learn\//);
  });
});

describe("demo family", () => {
  it("Arjun's seeded history lands at Nearly ready, with four different recent papers", async () => {
    const { arjun, buildFamily } = await import("@/lib/demoData");
    const now = Date.parse("2026-11-20T10:00:00Z");
    const spec = arjun(now);
    const f = buildFamily(spec, now);
    const r = readiness(f.attempts.map((a) => ({ ...a, sessionId: a.sessionKey })), f.sessions.map((s) => ({ ...s, id: s.key, parentId: "p", childId: "c" })), spec.exam, now);
    expect(r.level).toBe("nearly");
    expect(r.papers).toBeGreaterThanOrEqual(4);
    expect(buildFamily(spec, now)).toEqual(f); // the same seed always gives the same demo
  });
});

describe("worksheet timer", () => {
  it("stops counting extra time 15 minutes after the time is up", async () => {
    const { writingTime, writingEnd } = await import("@/lib/time");
    const start = "2026-11-03T10:00:00Z";
    const at = (min: number) => new Date(Date.parse(start) + min * 60_000).toISOString();
    expect(writingTime(start, at(52), 60)!.text).toBe("Took 52 min of 60");
    expect(writingTime(start, at(70), 60)!.text).toBe("Took 70 min (10 min over the 60)");
    expect(writingTime(start, at(3085), 60)).toMatchObject({ took: 75, text: "Timer stopped 15 min after the 60" });
    expect(writingEnd(start, null, 40, Date.parse(at(500)))).toBe(Date.parse(at(55)));
  });
});
