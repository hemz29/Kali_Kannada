import { getLesson, getQuestion, getWorksheet, LESSONS, SECTION_TEXT, TERM_PAPER } from "@/content";
import type { QuestionType } from "@/content/schema";
import type { AttemptScore, ExamPlan, PracticeSession } from "@/lib/store/types";

// Exam readiness, the way a parent checks it at home: from the papers written in the last two weeks, how many answers
// were right (added up the way the school paper is marked), plus five checks shown as ticks. No AI, no statistics.
// The plain-language version is in components/readiness/ReadinessInfo.tsx; keep the two in step.

export const EXAM_MARKS = 40;
const DAY = 864e5;
export const RECENT_DAYS = 14; // papers written in the last two weeks count
export const PAPERS_NEEDED = 4; // different papers in those two weeks, for "Exam ready"
const READY_PCT = 85; // about 34 out of 40
const MAX_SLIPS = 2; // spelling slips per paper, on average
const COMPLETE_SHARE = 0.8; // sentence answers that got full marks for their points
const SENTENCE_TYPES: QuestionType[] = ["one_sentence", "who_said", "own_sentence"];

export const LEVELS = [
  { id: "starting", label: "Just starting", from: 0 },
  { id: "getting", label: "Getting there", from: 50 },
  { id: "nearly", label: "Nearly ready", from: 70 },
  { id: "ready", label: "Exam ready", from: READY_PCT },
] as const;
export type LevelId = (typeof LEVELS)[number]["id"];

// Short names for each kind of question, for the "most marks to win" list.
const SHORT: Record<QuestionType, string> = {
  meaning_kn: "Kannada meanings", meaning_en: "English meanings", en_to_kn: "English words in Kannada", opposite: "Opposites",
  gender: "Changing gender", plural: "Plurals", split: "Splitting words", one_sentence: "One-sentence answers",
  who_said: "Who said to whom", own_sentence: "Making your own sentences", number_name: "Number names",
  poem_line: "Poem lines by heart", poet_name: "The poet's name", fill_blank: "Fill in the blanks", rhyme: "Rhyming words",
};

export type Tick = { id: "answered" | "spelling" | "complete" | "on_time" | "papers"; label: string; done: boolean; detail: string };

export type Readiness = {
  exam: ExamPlan;
  chaptersChosen: boolean; // the parent picked the exam chapters
  daysToGo: number | null;
  // Why there's no number yet: chapters not chosen, or no paper written in the last two weeks.
  missing: "chapters" | "practice" | null;
  enoughEvidence: boolean; // a number can be shown (missing is null)
  predicted: number; // likely mark out of 40
  low: number;
  high: number;
  pct: number; // predicted ÷ 40, as a whole %
  level: LevelId;
  ticks: Tick[];
  papers: number; // different papers counted (latest try of each, last two weeks)
  gains: { type: QuestionType; label: string; marks: number; href: string }[];
};

const allLessonIds = () => LESSONS.map((l) => l.id);

// The exam paper for the chosen chapters: the term paper's marks per kind of question, keeping only the kinds those
// chapters can ask. If some kinds are missing (e.g. no poem), chapter-only kinds (fill in the blanks, rhyming words)
// fill the gap at 2 marks each, and everything is scaled back to 40. Panchatantra + Nanna Desha is the real paper.
export function examBlueprint(lessonIds: string[]): Partial<Record<QuestionType, number>> {
  const ids = lessonIds.length ? lessonIds : allLessonIds();
  const available = new Set<QuestionType>(["number_name"]);
  for (const id of ids) for (const ex of getLesson(id)?.exercises ?? []) if (ex.questions.length) available.add(ex.type);
  const raw: Partial<Record<QuestionType, number>> = {};
  for (const [type, marks] of Object.entries(TERM_PAPER) as [QuestionType, number][]) if (available.has(type)) raw[type] = marks;
  const missing = Object.keys(TERM_PAPER).some((t) => !raw[t as QuestionType]);
  if (missing) for (const type of ["fill_blank", "rhyme"] as QuestionType[]) if (available.has(type) && !raw[type]) raw[type] = 2;
  const total = Object.values(raw).reduce((t, m) => t + m, 0);
  return Object.fromEntries(Object.entries(raw).map(([t, m]) => [t, (m * EXAM_MARKS) / total]));
}

const finishedAt = (s: PracticeSession) => Date.parse(s.completedAt ?? s.startedAt);
const onTime = (s: PracticeSession) => {
  const minutes = getWorksheet(s.worksheetId)?.minutes ?? 60;
  return !s.writingDoneAt || Date.parse(s.writingDoneAt) - Date.parse(s.startedAt) <= minutes * 60_000;
};

// Where to practise a kind of question.
function practiceHref(type: QuestionType, lessonIds: string[]) {
  if (type === "number_name") return "/learn/numbers";
  if (type === "poem_line" || type === "poet_name" || type === "rhyme") return "/learn/lesson/nanna-desha";
  if (["meaning_kn", "opposite", "gender", "plural", "split"].includes(type)) return `/learn/cards/${lessonIds[0] ?? "panchatantra"}`;
  return "/learn/writing";
}

export function readiness(attempts: AttemptScore[], sessions: PracticeSession[], plan: ExamPlan | null | undefined, now = Date.now()): Readiness {
  const chaptersChosen = Boolean(plan?.lessonIds?.length);
  const exam: ExamPlan = { date: plan?.date ?? null, lessonIds: plan?.lessonIds ?? [], actualMark: plan?.actualMark ?? null, acknowledged: plan?.acknowledged };
  const today = new Date(now);
  const daysToGo = exam.date ? Math.round((new Date(`${exam.date}T00:00:00`).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / DAY) : null;
  const inExam = new Set(exam.lessonIds);

  // The papers that count: written and marked in the last two weeks, on the exam's chapters, latest try of each.
  const latest = new Map<string, PracticeSession>();
  for (const s of sessions) {
    if (s.kind !== "worksheet" || s.status !== "graded" || !s.max || now - finishedAt(s) > RECENT_DAYS * DAY) continue;
    if (!(getWorksheet(s.worksheetId)?.lessonIds ?? []).some((id) => inExam.has(id))) continue;
    const prev = latest.get(s.worksheetId);
    if (!prev || finishedAt(s) > finishedAt(prev)) latest.set(s.worksheetId, s);
  }
  const papers = [...latest.values()];
  const counted = new Set(papers.map((s) => s.id));
  const answers = attempts.filter((a) => counted.has(a.sessionId) && a.awarded !== null && a.status !== "review" && a.max);

  // The likely mark: % right in each part of the paper (Hint 1 answers count half; marking already halves Hint 2),
  // added up by the paper's marks. A part not seen in any recent paper counts as 0.
  const blueprint = examBlueprint(exam.lessonIds);
  const parts = (Object.entries(blueprint) as [QuestionType, number][]).map(([type, marks]) => {
    const mine = answers.filter((a) => a.type === type && (type === "number_name" || inExam.has(getQuestion(a.questionId)?.lessonId ?? "")));
    const right = mine.reduce((t, a) => t + ((a.awarded ?? 0) / a.max) * (a.helpLevel === 1 ? 0.5 : 1), 0);
    const share = mine.length ? right / mine.length : 0;
    return { type, marks, share, seen: mine.length > 0 };
  });
  const predicted = parts.reduce((t, p) => t + p.marks * p.share, 0);
  const pct = Math.round((predicted / EXAM_MARKS) * 100);
  const spread = papers.length >= PAPERS_NEEDED ? 2 : 4;

  // The five checks.
  const blanks = answers.filter((a) => a.status === "blank").length;
  const slips = answers.filter((a) => a.nearMiss && a.readingConfirmed).length;
  const sentences = answers.filter((a) => SENTENCE_TYPES.includes(a.type));
  const complete = sentences.filter((a) => (a.awarded ?? 0) >= a.max).length;
  const late = papers.filter((s) => !onTime(s)).length;
  const n = papers.length;
  const ticks: Tick[] = [
    { id: "answered", label: "Answers every question", done: n > 0 && blanks === 0, detail: blanks ? `${blanks} left blank` : "None left blank" },
    { id: "spelling", label: "Careful spelling", done: n > 0 && slips / n <= MAX_SLIPS, detail: `${slips} spelling slip${slips === 1 ? "" : "s"} in ${n} paper${n === 1 ? "" : "s"}` },
    {
      id: "complete",
      label: "Answers complete for the marks",
      done: sentences.length > 0 && complete / sentences.length >= COMPLETE_SHARE,
      detail: sentences.length ? `${complete} of ${sentences.length} sentence answers got full marks` : "No sentence answers yet",
    },
    { id: "on_time", label: "Finishes in time", done: n > 0 && late === 0, detail: late ? `${late} paper${late === 1 ? "" : "s"} took too long` : "Every paper on time" },
    { id: "papers", label: `${PAPERS_NEEDED} different papers in 2 weeks`, done: n >= PAPERS_NEEDED, detail: `${Math.min(n, PAPERS_NEEDED)} of ${PAPERS_NEEDED} done` },
  ];

  let level: LevelId = [...LEVELS].reverse().find((l) => pct >= l.from)!.id;
  if (level === "ready" && !ticks.every((t) => t.done)) level = "nearly";

  const missing = !chaptersChosen ? "chapters" : n === 0 ? "practice" : null;
  const gains = parts
    .map((p) => ({ type: p.type, label: SHORT[p.type] ?? SECTION_TEXT[p.type].en, marks: Math.round(p.marks * (1 - p.share)), href: practiceHref(p.type, exam.lessonIds) }))
    .filter((g) => g.marks >= 1)
    .sort((a, b) => b.marks - a.marks)
    .slice(0, 3);

  return {
    exam,
    chaptersChosen,
    daysToGo,
    missing,
    enoughEvidence: missing === null,
    predicted,
    low: Math.max(0, Math.round(predicted - spread)),
    high: Math.min(EXAM_MARKS, Math.round(predicted + spread)),
    pct,
    level,
    ticks,
    papers: n,
    gains,
  };
}

export const levelLabel = (id: LevelId) => LEVELS.find((l) => l.id === id)!.label;
