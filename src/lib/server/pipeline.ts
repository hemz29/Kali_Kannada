import "server-only";
import { MARKING, getQuestion, getWorksheet, worksheetQuestionNumber } from "@/content";
import { SCHOOL_WORKSHEET_ANSWERS } from "@/content/grade6/sampleAnswers";
import { aiConfigured, markAnswers, readAnswerPage, type Reading } from "@/lib/ai";
import { gradeAttempts, maxFor } from "@/lib/grading/grade";
import type { PageUpload, PracticeSession, QuestionAttempt, Store } from "@/lib/store/types";

type NewAttempt = Omit<QuestionAttempt, "id" | "createdAt">;
// Drops the stored id and timestamp so an attempt can be re-saved.
const strip = (a: QuestionAttempt): NewAttempt => {
  const rest: Partial<QuestionAttempt> = { ...a };
  delete rest.id;
  delete rest.createdAt;
  return rest as NewAttempt;
};

const QUALITY_MESSAGE: Record<string, string> = {
  blurry_or_dark: "This photo is too blurry or dark to read. Please take it again in good light, holding the phone steady.",
  not_a_worksheet: "This doesn't look like the worksheet page. Please take a photo of your answer sheet.",
};

// Demo mode without an AI key: the first photo "reads" as the real child's answers from the school worksheet
// (for the questions this worksheet shares with it), with one deliberately unsure word so checking can be tried.
function demoReading(session: PracticeSession, pageIndex: number): Reading | null {
  const ws = getWorksheet(session.worksheetId)!;
  const ids = new Set(ws.sections.flatMap((s) => s.questions.map((q) => q.id)));
  const known = Object.entries(SCHOOL_WORKSHEET_ANSWERS).filter(([qid]) => ids.has(qid));
  if (pageIndex > 0 || known.length === 0) return null;
  return {
    pageQuality: "ok",
    answers: known.map(([qid, text], i, all) => ({
      questionNumber: worksheetQuestionNumber(ws, qid),
      text,
      confidence: qid === "nanna-desha.q.1" ? "low" : "high",
      uncertainWords: qid === "nanna-desha.q.1" ? [{ word: "ಮಾನ,", alternatives: ["ಮೊನ,"], box: { left: 0.4, top: i / all.length, right: 0.55, bottom: (i + 1) / all.length } }] : [],
      top: i / all.length,
      bottom: (i + 1) / all.length,
      left: 0.05,
      right: 0.95,
    })),
  };
}

export async function readPage(store: Store, session: PracticeSession, page: PageUpload, image: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp") {
  const { parentId } = session;
  const ws = getWorksheet(session.worksheetId)!;
  await store.updatePage(parentId, page.id, { status: "reading" });
  await store.updateSession(parentId, session.id, { status: "reading" });

  let reading: Reading | null = null;
  try {
    const pages = await store.listPages(parentId, session.id);
    const pageIndex = pages.findIndex((p) => p.id === page.id);
    if (aiConfigured()) {
      const questions = ws.sections.flatMap((s) =>
        s.questions.map((q) => ({ number: worksheetQuestionNumber(ws, q.id), prompt: q.prompt, kind: s.en })),
      );
      reading = await readAnswerPage({ base64: image.toString("base64"), mediaType }, questions, session.id, (e) => store.logAi(parentId, e));
    } else {
      reading = demoReading(session, pageIndex);
      if (!reading) throw new Error("Handwriting reading isn't set up yet (no AI key). Ask a grown-up to check the setup.");
    }
  } catch (err) {
    await store.updatePage(parentId, page.id, { status: "failed", error: err instanceof Error ? err.message : "Reading failed" });
    await settleStatus(store, session);
    return;
  }

  if (reading.pageQuality !== "ok") {
    await store.updatePage(parentId, page.id, { status: "failed", error: QUALITY_MESSAGE[reading.pageQuality] });
    await settleStatus(store, session);
    return;
  }

  // Merge this page's answers into the session. A later photo of the same question replaces the earlier reading.
  const byNumber = new Map(ws.sections.flatMap((s) => s.questions.map((q) => [worksheetQuestionNumber(ws, q.id), q.id] as const)));
  const existing = new Map((await store.listSessionAttempts(parentId, session.id)).map((a) => [a.questionId, strip(a)]));
  for (const ans of reading.answers) {
    const qid = byNumber.get(ans.questionNumber.trim());
    if (!qid) continue;
    const q = getQuestion(qid)!;
    const prev = existing.get(qid);
    if (prev && prev.text && !ans.text) continue; // don't let a blank re-read wipe a real answer
    const words = ans.text.split(/\s+/);
    existing.set(qid, {
      sessionId: session.id,
      parentId,
      childId: session.childId,
      questionId: qid,
      type: q.type,
      skill: q.skill,
      pageId: page.id,
      region: { top: clamp(ans.top), bottom: clamp(Math.max(ans.bottom, ans.top + 0.02)), left: clamp(ans.left), right: clamp(Math.max(ans.right, ans.left + 0.05)) },
      text: ans.text,
      confidence: ans.confidence,
      uncertainWords: ans.uncertainWords.map((u) => ({
        index: Math.max(0, words.indexOf(u.word)),
        word: u.word,
        alternatives: u.alternatives.slice(0, 3),
        box: { left: clamp(u.box.left), top: clamp(u.box.top), right: clamp(Math.max(u.box.right, u.box.left + 0.02)), bottom: clamp(Math.max(u.box.bottom, u.box.top + 0.01)) },
      })),
      readingConfirmed: ans.confidence === "high",
      misreadFlagged: false,
      helpLevel: session.help[qid] ?? 0,
      awarded: null,
      max: maxFor(qid, session.worksheetId),
      status: null,
      method: null,
      feedback: null,
      markingVersion: MARKING.version,
    });
  }
  await store.replaceAttempts(parentId, session.id, [...existing.values()]);
  await store.updatePage(parentId, page.id, { status: "read" });
  await settleStatus(store, session);
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));

// After a page finishes: still reading → "reading"; anything unsure → "checking"; otherwise wait for more pages.
async function settleStatus(store: Store, session: PracticeSession) {
  const pages = await store.listPages(session.parentId, session.id);
  if (pages.some((p) => p.status === "received" || p.status === "reading")) return;
  const attempts = await store.listSessionAttempts(session.parentId, session.id);
  await store.updateSession(session.parentId, session.id, { status: attempts.length ? "checking" : "writing" });
}

// The child has confirmed the readings: fill in unanswered questions as blank, then mark everything.
export async function gradeSession(store: Store, session: PracticeSession) {
  const { parentId } = session;
  const ws = getWorksheet(session.worksheetId)!;
  const existing = new Map(
    (await store.listSessionAttempts(parentId, session.id)).map((a) => [a.questionId, { ...strip(a), helpLevel: session.help[a.questionId] ?? a.helpLevel }]),
  );
  for (const q of ws.sections.flatMap((s) => s.questions)) {
    if (existing.has(q.id)) continue;
    existing.set(q.id, {
      sessionId: session.id, parentId, childId: session.childId, questionId: q.id, type: q.type, skill: q.skill,
      pageId: null, region: null, text: "", confidence: "high", uncertainWords: [], readingConfirmed: true,
      misreadFlagged: false, helpLevel: session.help[q.id] ?? 0, awarded: null, max: maxFor(q.id, session.worksheetId),
      status: null, method: null, feedback: null, markingVersion: MARKING.version,
    });
  }
  const marker = aiConfigured() ? (items: Parameters<typeof markAnswers>[0]) => markAnswers(items, session.id, (e) => store.logAi(parentId, e)) : null;
  const graded = await gradeAttempts([...existing.values()], marker);
  await store.replaceAttempts(parentId, session.id, graded);
  await store.updateSession(parentId, session.id, { status: "graded", ...sessionTotals(graded), completedAt: new Date().toISOString() });
}

// Answers waiting for a reviewer are left out of the score until they are marked.
export function sessionTotals(attempts: Pick<QuestionAttempt, "awarded" | "max">[]) {
  const scored = attempts.filter((a) => a.awarded !== null);
  return { awarded: scored.reduce((t, a) => t + (a.awarded ?? 0), 0), max: scored.reduce((t, a) => t + a.max, 0) };
}
