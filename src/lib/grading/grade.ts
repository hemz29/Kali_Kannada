import { getQuestion, getWorksheet, marksFor } from "@/content";
import { KEY_GRADED } from "@/content/schema";
import type { MarkItem } from "@/lib/ai";
import type { AttemptFeedback, QuestionAttempt } from "@/lib/store/types";
import { HINT2_FACTOR, HINT2_WRONG } from "@/lib/help";
import { gradeByKey } from "./answerKey";

type MarkResult = { id: string; pointsMet: boolean[]; feedbackEn: string; spellingNotes: { wrote: string; correct: string }[] };
export type Marker = (items: MarkItem[]) => Promise<{ results: MarkResult[] }>;

// Marks are always computed here, in code: the AI only says which rubric points an answer shows.
const roundHalf = (x: number) => Math.round(x * 2) / 2;

export async function gradeAttempts<A extends Pick<QuestionAttempt, "questionId" | "text" | "max"> & { helpLevel?: number; misreadFlagged?: boolean }>(
  attempts: A[],
  marker: Marker | null,
): Promise<(A & Pick<QuestionAttempt, "awarded" | "status" | "method" | "feedback">)[]> {
  const out = new Map<string, Pick<QuestionAttempt, "awarded" | "status" | "method" | "feedback">>();
  const aiItems: MarkItem[] = [];

  for (const a of attempts) {
    const q = getQuestion(a.questionId)!;
    const model = q.model;
    // The child said none of the readings matched their writing: a grown-up marks it from the photo.
    if (a.misreadFlagged) {
      out.set(a.questionId, { awarded: null, status: "review", method: null, feedback: { en: "A grown-up will check this one against your photo.", model } });
      continue;
    }
    if (!a.text.trim()) {
      out.set(a.questionId, { awarded: 0, status: "blank", method: "key", feedback: { en: "Not answered.", model } });
      continue;
    }
    if (KEY_GRADED.includes(q.type)) {
      const r = gradeByKey(q, a.text);
      if (r.status !== "unsure") {
        out.set(a.questionId, {
          awarded: roundHalf(r.fraction * a.max),
          status: r.status,
          method: "key",
          feedback: { en: r.feedbackEn, nearMiss: r.nearMiss, model },
        });
        continue;
      }
      aiItems.push({ id: q.id, kind: "synonym_check", prompt: q.prompt, promptEn: q.promptEn, modelKn: q.answers.join(" / "), points: ["The answer is an acceptable meaning/word for the prompt"], answer: a.text });
    } else {
      aiItems.push({ id: q.id, kind: q.type as "one_sentence" | "own_sentence", prompt: q.prompt, promptEn: q.promptEn, modelKn: model?.kn, modelEn: model?.en, points: q.points ?? [], answer: a.text });
    }
  }

  let results: MarkResult[] = [];
  if (aiItems.length && marker) {
    try {
      results = (await marker(aiItems)).results;
    } catch {
      results = [];
    }
  }

  for (const item of aiItems) {
    const a = attempts.find((x) => x.questionId === item.id)!;
    const q = getQuestion(item.id)!;
    const r = results.find((x) => x.id === item.id);
    if (!r || r.pointsMet.length !== item.points.length) {
      // No usable AI result: never invent a mark; a reviewer marks it instead.
      out.set(item.id, { awarded: null, status: "review", method: null, feedback: { en: "Your teacher-helper will check this one.", model: q.model } });
      continue;
    }
    const met = r.pointsMet.filter(Boolean).length;
    const fraction = met / item.points.length;
    const feedback: AttemptFeedback = {
      en: r.feedbackEn,
      points: item.kind === "synonym_check" ? undefined : item.points.map((p, i) => ({ point: p, met: r.pointsMet[i] })),
      nearMiss: r.spellingNotes[0],
      model: q.model,
    };
    out.set(item.id, {
      awarded: Math.min(a.max, roundHalf(fraction * a.max)),
      status: fraction === 1 ? "correct" : fraction === 0 ? "incorrect" : "partial",
      method: "ai",
      feedback,
    });
  }

  return attempts.map((a) => ({ ...a, ...withHintPenalty(a.helpLevel ?? 0, out.get(a.questionId)!) }));
}

// An answer written after seeing Hint 2's choices gets half marks (rounded down to the half mark), and none at
// all if the one pick among the choices was wrong.
export function withHintPenalty<R extends Pick<QuestionAttempt, "awarded" | "feedback">>(helpLevel: number, r: R): R {
  if (helpLevel === HINT2_WRONG && r.awarded !== null)
    return { ...r, awarded: 0, feedback: r.feedback && { ...r.feedback, en: `${r.feedback.en} Hint 2's choice was not right, so this answer gets no marks.` } };
  if (helpLevel < 2 || !r.awarded) return r;
  return {
    ...r,
    awarded: Math.floor(r.awarded * HINT2_FACTOR * 2) / 2,
    feedback: r.feedback && { ...r.feedback, en: `${r.feedback.en} Half marks, because Hint 2 (the choices) was used.` },
  };
}

// True when the mark hung on the child's own check of an unsure reading: another possible reading of the
// same handwriting would have scored differently. Parents see these so they can compare with the photo.
export function markDependsOnCheck(a: Pick<QuestionAttempt, "questionId" | "text" | "uncertainWords" | "misreadFlagged">) {
  const q = getQuestion(a.questionId);
  if (!q || a.misreadFlagged || !a.uncertainWords.length || !KEY_GRADED.includes(q.type)) return false;
  const words = a.text.split(/\s+/);
  const fractions = new Set<number>();
  for (const u of a.uncertainWords) {
    const options = [u.word, ...u.alternatives];
    const at = words.findIndex((w) => options.includes(w));
    if (at < 0) continue;
    for (const o of options) fractions.add(gradeByKey(q, words.map((w, i) => (i === at ? o : w)).join(" ")).fraction);
  }
  return fractions.size > 1;
}

export function worksheetQuestionIds(worksheetId: string) {
  const ws = getWorksheet(worksheetId);
  return ws ? ws.sections.flatMap((s) => s.questions.map((q) => q.id)) : [];
}

// A question's marks: the paper's own marks for its section (unit tests give ½), else the usual marks for its type.
export function maxFor(questionId: string, worksheetId?: string) {
  const section = worksheetId ? getWorksheet(worksheetId)?.sections.find((s) => s.questions.some((q) => q.id === questionId)) : undefined;
  return section?.marksEach ?? marksFor(getQuestion(questionId)!.type);
}
