import { getLesson, getWorksheet, MARKING } from "@/content";
import type { QuestionType } from "@/content/schema";
import type { ExamPlan, PracticeSession, QuestionAttempt } from "@/lib/store/types";

// Dummy families for investor demos: Arjun (the demo parent's child) plus about 20 others, with believable practice.
// Everything is built from a seed, so every reset gives exactly the same demo. Nothing here touches a database:
// lib/server/demo.ts writes these records, and only ever for accounts tagged as demo.

export const DEMO_DOMAIN = "kali-kannada.app";
export const DEMO_PARENT_EMAIL = `demo-parent@${DEMO_DOMAIN}`;
export const isDemoEmail = (email: string) => email.toLowerCase().endsWith(`@${DEMO_DOMAIN}`) && email.toLowerCase().startsWith("demo-");

const DAY = 864e5;
const CARD_TYPES: QuestionType[] = ["opposite", "gender", "plural", "split", "meaning_kn", "rhyme"];
const PAGES = ["/learn", "/learn/lessons", "/learn/lesson/panchatantra", "/learn/lesson/nanna-desha", "/learn/grammar", "/learn/letters", "/learn/numbers", "/learn/scores", "/learn/tests", "/parent"];
const DEVICES = ["phone", "phone", "tablet", "computer"];

// A tiny seeded random number generator (mulberry32), so the same seed always gives the same family.
export function rng(seed: string) {
  let h = 1779033703;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One practice event in a family's history.
export type Step =
  | { day: number; kind: "cards"; lessonId: string; p: number }
  | { day: number; kind: "worksheet"; worksheetId: string; p: number; hints?: number; minutes?: number };

export type FamilySpec = { email: string; nickname: string; theme: string; joinedDaysAgo: number; exam?: ExamPlan; steps: Step[] };

export type FamilyRecords = {
  child: { nickname: string; theme: string; createdAt: string; exam?: ExamPlan };
  sessions: (Omit<PracticeSession, "id" | "parentId" | "childId"> & { key: string })[];
  attempts: (Omit<QuestionAttempt, "id" | "parentId" | "childId" | "sessionId"> & { sessionKey: string })[];
  activity: { kind: string; path: string; detail: Record<string, unknown>; createdAt: string }[];
  ai: { purpose: "read_answers" | "grade_answers"; model: string; inputTokens: number; outputTokens: number; ms: number; ok: boolean; sessionKey: string; createdAt: string }[];
};

const at = (now: number, daysAgo: number, hour: number) => {
  const d = new Date(now - daysAgo * DAY);
  d.setHours(hour, Math.floor((hour % 1) * 60), 0, 0);
  return d;
};
const iso = (d: Date) => d.toISOString();
const plusMin = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

// Turns a family's plan into the rows the app saves: sessions, marked answers, page visits and a few AI log entries.
export function buildFamily(spec: FamilySpec, now = Date.now()): FamilyRecords {
  const r = rng(spec.email);
  const device = DEVICES[Math.floor(r() * DEVICES.length)];
  const out: FamilyRecords = {
    child: { nickname: spec.nickname, theme: spec.theme, createdAt: iso(at(now, spec.joinedDaysAgo, 17)), exam: spec.exam },
    sessions: [],
    attempts: [],
    activity: [],
    ai: [],
  };
  spec.steps.forEach((step, i) => {
    const start = at(now, step.day, 16 + r() * 4);
    const key = `s${i}`;
    // A few page visits around each practice.
    for (let v = 0; v < 2 + Math.floor(r() * 3); v++)
      out.activity.push({ kind: "page_view", path: PAGES[Math.floor(r() * PAGES.length)], detail: { device }, createdAt: iso(plusMin(start, -5 + v * 4)) });

    if (step.kind === "cards") {
      const pool = getLesson(step.lessonId)!.exercises.filter((e) => CARD_TYPES.includes(e.type)).flatMap((e) => e.questions);
      const picked = [...pool].sort(() => r() - 0.5).slice(0, 15);
      const marks = picked.map(() => (r() < step.p ? 1 : 0));
      const done = plusMin(start, 6 + r() * 6);
      out.sessions.push({ key, kind: "cards", worksheetId: `cards:${step.lessonId}`, retryOf: null, status: "graded", markingVersion: MARKING.version, help: {}, awarded: marks.reduce((t: number, m) => t + m, 0), max: picked.length, startedAt: iso(start), writingDoneAt: null, completedAt: iso(done) });
      picked.forEach((q, k) =>
        out.attempts.push({ sessionKey: key, questionId: q.id, type: q.type, skill: q.skill, pageId: null, region: null, text: "", confidence: "high", uncertainWords: [], readingConfirmed: true, misreadFlagged: false, helpLevel: 0, awarded: marks[k], max: 1, status: marks[k] ? "correct" : "incorrect", method: "key", feedback: null, markingVersion: MARKING.version, createdAt: iso(done) }),
      );
      return;
    }

    const w = getWorksheet(step.worksheetId)!;
    const qs = w.sections.flatMap((s) => s.questions);
    const minutes = step.minutes ?? Math.round(w.minutes * (0.75 + r() * 0.2));
    const done = plusMin(start, minutes);
    const help: Record<string, number> = {};
    let awarded = 0;
    qs.forEach((q) => {
      const hint = step.hints && r() < step.hints ? (r() < 0.7 ? 1 : 2) : 0;
      if (hint) help[q.id] = hint;
      const right = r() < step.p + (hint ? 0.15 : 0);
      const mark = right ? (hint >= 2 ? 0.5 : 1) : 0;
      awarded += mark;
      out.attempts.push({ sessionKey: key, questionId: q.id, type: q.type, skill: q.skill, pageId: null, region: null, text: right ? "✓" : "…", confidence: "high", uncertainWords: [], readingConfirmed: true, misreadFlagged: false, helpLevel: hint, awarded: mark, max: 1, status: right ? "correct" : "incorrect", method: "key", feedback: null, markingVersion: MARKING.version, createdAt: iso(plusMin(done, 3)) });
    });
    out.sessions.push({ key, kind: "worksheet", worksheetId: w.id, retryOf: null, status: "graded", markingVersion: MARKING.version, help, awarded, max: qs.length, startedAt: iso(start), writingDoneAt: iso(done), completedAt: iso(plusMin(done, 3)) });
    // Reading the photo and marking sentence answers are the two AI calls a real worksheet makes.
    out.ai.push({ purpose: "read_answers", model: "demo-model", inputTokens: 2400 + Math.floor(r() * 800), outputTokens: 700 + Math.floor(r() * 300), ms: 9000 + Math.floor(r() * 4000), ok: true, sessionKey: key, createdAt: iso(plusMin(done, 1)) });
    out.ai.push({ purpose: "grade_answers", model: "demo-model", inputTokens: 1500 + Math.floor(r() * 500), outputTokens: 400 + Math.floor(r() * 200), ms: 5000 + Math.floor(r() * 3000), ok: true, sessionKey: key, createdAt: iso(plusMin(done, 2)) });
  });
  return out;
}

const dateIn = (now: number, days: number) => new Date(now + days * DAY).toLocaleDateString("en-CA");

// Arjun: three weeks of steady practice on the first two chapters, four different papers in the last two weeks.
// Lands at "Nearly ready" with clear gains to point at.
export function arjun(now = Date.now()): FamilySpec {
  return {
    email: DEMO_PARENT_EMAIL,
    nickname: "Arjun",
    theme: "astronaut",
    joinedDaysAgo: 23,
    exam: { date: dateIn(now, 18), lessonIds: ["panchatantra", "nanna-desha"], acknowledged: true, actualMark: null },
    steps: [
      { day: 22, kind: "cards", lessonId: "panchatantra", p: 0.55 },
      { day: 20, kind: "cards", lessonId: "nanna-desha", p: 0.6 },
      { day: 18, kind: "worksheet", worksheetId: "panchatantra-practice-a", p: 0.6, hints: 0.25 },
      { day: 15, kind: "worksheet", worksheetId: "test-2", p: 0.6, hints: 0.2 },
      { day: 13, kind: "cards", lessonId: "panchatantra", p: 0.72 },
      { day: 11, kind: "worksheet", worksheetId: "nanna-desha-practice-a", p: 0.74, hints: 0.1 },
      { day: 9, kind: "worksheet", worksheetId: "nanna-desha-practice-b", p: 0.78 },
      { day: 8, kind: "cards", lessonId: "nanna-desha", p: 0.8 },
      { day: 6, kind: "worksheet", worksheetId: "panchatantra-practice-b", p: 0.8 },
      { day: 3, kind: "worksheet", worksheetId: "test-3", p: 0.82, minutes: 52 },
      { day: 1, kind: "cards", lessonId: "panchatantra", p: 0.88 },
    ],
  };
}

const NAMES = ["Aarav", "Diya", "Kavya", "Rohan", "Ananya", "Vihaan", "Ishita", "Advik", "Meera", "Siddharth", "Tanvi", "Nikhil", "Saanvi", "Pranav", "Riya", "Aditya", "Nandini", "Karthik", "Shreya", "Varun"];
const THEMES = ["cricket", "astronaut", "gamer", "football", "cat"];
const WORKSHEETS = ["panchatantra-practice-a", "nanna-desha-practice-a", "kugutide-pakshi-practice-a", "panchatantra-practice-b", "test-1", "test-2", "test-3"];
const LESSONS_ = ["panchatantra", "nanna-desha", "kugutide-pakshi"];

// About 20 other families over the last 6 weeks: some practise a lot and improve, some try it once and stop.
export function dummyFamilies(now = Date.now()): FamilySpec[] {
  return NAMES.map((nickname, n) => {
    const r = rng(`family-${n}`);
    const joined = 3 + Math.floor(r() * 40);
    const keen = r(); // how much this family practises
    const count = keen < 0.25 ? 1 + Math.floor(r() * 2) : keen < 0.7 ? 3 + Math.floor(r() * 5) : 8 + Math.floor(r() * 8);
    const base = 0.35 + r() * 0.35;
    const gain = 0.01 + r() * 0.025; // per practice
    const steps: Step[] = [];
    let day = joined;
    for (let k = 0; k < count && day >= 0; k++) {
      const p = Math.min(0.95, base + gain * k);
      if (r() < 0.6) steps.push({ day, kind: "cards", lessonId: LESSONS_[Math.floor(r() * 3)], p });
      else steps.push({ day, kind: "worksheet", worksheetId: WORKSHEETS[Math.floor(r() * WORKSHEETS.length)], p, hints: r() * 0.3 });
      day -= 1 + Math.floor(r() * 4);
    }
    const hasExam = r() < 0.5;
    return {
      email: `demo-family-${String(n + 1).padStart(2, "0")}@${DEMO_DOMAIN}`,
      nickname,
      theme: THEMES[Math.floor(r() * THEMES.length)],
      joinedDaysAgo: joined,
      exam: hasExam ? { date: dateIn(now, 5 + Math.floor(r() * 40)), lessonIds: ["panchatantra", "nanna-desha"], acknowledged: true, actualMark: null } : undefined,
      steps,
    };
  });
}
