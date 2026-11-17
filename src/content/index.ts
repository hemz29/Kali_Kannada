import { LessonSchema, type Lesson, type Question, type QuestionType } from "./schema";
import { panchatantra } from "./grade6/panchatantra";
import { nannaDesha, nannaDeshaStanzas } from "./grade6/nannaDesha";
import { kugutidePakshi } from "./grade6/kugutidePakshi";
import { ninnalluAdbhutaShakti } from "./grade6/ninnalluAdbhutaShakti";
import { numberQuestion, toKannadaDigits } from "./grade6/numbers";
import marking from "./grade6/marking.json";

export const LESSONS: Lesson[] = [panchatantra, nannaDesha, kugutidePakshi, ninnalluAdbhutaShakti].map((l) => LessonSchema.parse(l));

export const MARKING = marking as { version: string; label: string; perType: Record<QuestionType, number> };
export const marksFor = (type: QuestionType) => MARKING.perType[type] ?? 1;

export function getLesson(id: string) {
  return LESSONS.find((l) => l.id === id);
}

// Section order and instructions follow the school's Grade VI worksheet.
export const SECTION_ORDER: QuestionType[] = [
  "meaning_kn", "meaning_en", "en_to_kn", "synonym", "opposite", "gender", "plural", "split", "rhyme",
  "one_sentence", "who_said", "fill_blank", "own_sentence", "number_name", "poem_line", "poet_name",
];

export const SECTION_TEXT: Record<QuestionType, { kn: string; en: string }> = {
  meaning_kn: { kn: "ಕೆಳಗಿನ ಪದಗಳಿಗೆ ಕನ್ನಡದಲ್ಲಿ ಅರ್ಥ ಬರೆಯಿರಿ.", en: "Write Kannada meaning for the following words." },
  meaning_en: { kn: "ಕೆಳಗಿನ ಪದಗಳಿಗೆ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಅರ್ಥ ಬರೆಯಿರಿ.", en: "Write English meaning for the following words." },
  en_to_kn: { kn: "ಕೆಳಗಿನ ಪದಗಳಿಗೆ ಕನ್ನಡದಲ್ಲಿ ಅರ್ಥ ಬರೆಯಿರಿ.", en: "Write Kannada meaning for the following words." },
  opposite: { kn: "ಕೆಳಗಿನ ಪದಗಳಿಗೆ ವಿರುದ್ಧ ಪದ ಬರೆಯಿರಿ.", en: "Write opposite words for the following words." },
  synonym: { kn: "ಕೆಳಗಿನ ಪದಗಳಿಗೆ ಸಮಾನಾರ್ಥಕ ಪದ ಬರೆಯಿರಿ.", en: "Write the synonyms for the following words." },
  gender: { kn: "ಕೆಳಗಿನ ಪದಗಳಿಗೆ ಲಿಂಗ ಬದಲಿಸಿ ಬರೆಯಿರಿ.", en: "Change gender for the following words." },
  plural: { kn: "ಕೆಳಗಿನ ಪದಗಳನ್ನು ಬಹುವಚನದಲ್ಲಿ ಬರೆಯಿರಿ.", en: "Write plural form for the following words." },
  split: { kn: "ಕೆಳಗಿನ ಪದಗಳನ್ನು ಬಿಡಿಸಿ ಬರೆಯಿರಿ.", en: "Split and write." },
  one_sentence: { kn: "ಒಂದು ವಾಕ್ಯದಲ್ಲಿ ಉತ್ತರ ಬರೆಯಿರಿ.", en: "Answer the following questions in one sentence." },
  who_said: { kn: "ಯಾರು, ಯಾರಿಗೆ ಹೇಳಿದರು?", en: "Who said to whom?" },
  fill_blank: { kn: "ಬಿಟ್ಟ ಸ್ಥಳ ತುಂಬಿರಿ.", en: "Fill in the blanks." },
  own_sentence: { kn: "ಕೆಳಗಿನ ಪದಗಳಿಗೆ ಕನ್ನಡದಲ್ಲಿ ವಾಕ್ಯ ರಚನೆ ಮಾಡಿ.", en: "Make sentences for the following words in Kannada." },
  rhyme: { kn: "ಪ್ರಾಸ ಪದಗಳನ್ನು ಬರೆಯಿರಿ.", en: "Write the rhyming words from the poem." },
  number_name: { kn: "ಕೆಳಗಿನ ಅಂಕಿಗಳಿಗೆ ಸಂಖ್ಯಾ ಪದ ಬರೆಯಿರಿ.", en: "Write number names in Kannada." },
  poem_line: { kn: "ಪದ್ಯವನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ.", en: "Complete the following poem." },
  poet_name: { kn: "ಕವಿಯ ಹೆಸರನ್ನು ಬರೆಯಿರಿ.", en: "Write the name of the poet." },
};

// Every question by id, including number names, which belong to no lesson.
const QUESTIONS = new Map<string, Question & { lessonId?: string }>();
for (const l of LESSONS)
  for (const ex of l.exercises) for (const q of ex.questions) QUESTIONS.set(q.id, { ...q, lessonId: l.id });
for (let n = 1; n <= 70; n++) {
  const q = numberQuestion(n);
  QUESTIONS.set(q.id, { ...q, answers: [...q.answers] });
}

export function getQuestion(id: string) {
  return QUESTIONS.get(id);
}

export type WorksheetSection = { type: QuestionType; kn: string; en: string; marksEach: number; questions: Question[] };
export type Worksheet = {
  id: string;
  kind: "test" | "practice";
  title: { kn: string; en: string };
  lessonIds: string[];
  sections: WorksheetSection[];
  totalMarks: number;
  // Writing time, as on the school paper: 40 marks = 1 hour, 25 marks = 40 minutes.
  minutes: number;
  // Old worksheets stay readable for past attempts but are no longer offered.
  retired?: boolean;
  // For poem completion: the line printed before the blanks, per stanza (retired worksheets only).
  poemCues?: string[];
  // Marks for an oral test given in class (unit tests): printed on the paper, not marked in the app.
  oralMarks?: number;
};

// Section A (words and grammar) comes before Section B (answers, sentences, numbers, poem), as on the school paper.
export const SECTION_A: QuestionType[] = ["meaning_kn", "meaning_en", "en_to_kn", "synonym", "opposite", "gender", "plural", "split", "rhyme"];
export const sectionPart = (type: QuestionType) => (SECTION_A.includes(type) ? "A" : "B");

const minutesFor = (marks: number) => (marks >= 40 ? 60 : 40);

function find(lessonId: string, type: QuestionType, prompt: string) {
  const lesson = getLesson(lessonId)!;
  for (const ex of lesson.exercises)
    if (ex.type === type) {
      const q = ex.questions.find((x) => x.prompt === prompt);
      if (q) return q;
    }
  throw new Error(`Worksheet question not found: ${lessonId} ${type} ${prompt}`);
}

// The poet's name is written under the poem, so it shares the poem's section and number, as on the school paper.
function build(
  id: string,
  kind: Worksheet["kind"],
  title: Worksheet["title"],
  lessonIds: string[],
  picks: Question[],
  extra: Partial<Worksheet> = {},
  // Marks per item where this paper differs from the usual 1 mark (the unit test gives ½ for word questions).
  marks: Partial<Record<QuestionType, number>> = {},
): Worksheet {
  const each = (type: QuestionType) => marks[type] ?? marksFor(type);
  const sections = SECTION_ORDER.filter((t) => t !== "poet_name")
    .map((type) => ({
      type,
      ...SECTION_TEXT[type],
      ...(type === "poem_line" && picks.some((q) => q.type === "poet_name")
        ? { kn: "ಪದ್ಯವನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ, ಕವಿಯ ಹೆಸರನ್ನು ಬರೆಯಿರಿ.", en: "Complete the following poem and write the name of the poet." }
        : {}),
      marksEach: each(type),
      questions: picks.filter((q) => q.type === type || (type === "poem_line" && q.type === "poet_name")),
    }))
    .filter((s) => s.questions.length);
  const totalMarks = sections.reduce((t, s) => t + s.questions.length * s.marksEach, 0);
  return { id, kind, title, lessonIds, sections, totalMarks, minutes: minutesFor(totalMarks), ...extra };
}

const P = "panchatantra";
const N = "nanna-desha";
const K = "kugutide-pakshi";
const H = "ninnallu-adbhuta-shakti";

const poemStanza = (n: number) => {
  const lines = nannaDeshaStanzas[n].map(([l]) => l);
  return getLesson(N)!.exercises.find((e) => e.type === "poem_line")!.questions.filter((q) => lines.includes(q.answers[0]));
};
const poet = () => getLesson(N)!.exercises.find((e) => e.type === "poet_name")!.questions;
const numbers = (...ns: number[]) => ns.map((n) => getQuestion(`numbers.${n}`)!);

// Picks questions for a paper: for each type, the ones used least so far (so later papers bring new questions),
// never testing the same word twice in one paper (e.g. its Kannada meaning and its English meaning).
const used = new Map<string, number>();
const wordOf = (q: Question) => (q.type === "en_to_kn" ? q.answers[0] : q.prompt);
function pick(lessonIds: string[], quota: Partial<Record<QuestionType, number>>, fixed: Question[] = []) {
  const chosen: Question[] = [...fixed];
  const words = new Set(fixed.map(wordOf));
  for (const [type, n] of Object.entries(quota) as [QuestionType, number][]) {
    const pool = lessonIds.flatMap((id) => getLesson(id)!.exercises.filter((e) => e.type === type).flatMap((e) => e.questions));
    const ranked = pool
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => !words.has(wordOf(q)))
      .sort((a, b) => (used.get(a.q.id) ?? 0) - (used.get(b.q.id) ?? 0) || a.i - b.i)
      .slice(0, n)
      .map(({ q }) => q);
    if (ranked.length < n) throw new Error(`Not enough ${type} questions for ${lessonIds.join("+")}`);
    for (const q of ranked) words.add(wordOf(q));
    chosen.push(...ranked);
  }
  for (const q of chosen) used.set(q.id, (used.get(q.id) ?? 0) + 1);
  return chosen;
}

// Term test pattern (Grade VI Term 1, 40 marks, 1 hour). Section A 20 + Section B 20, every item 1 mark.
const TEST_A = { meaning_kn: 3, meaning_en: 3, en_to_kn: 3, opposite: 3, gender: 3, plural: 2, split: 3 };
const TEST_B = { one_sentence: 6, who_said: 2, own_sentence: 3 };
// The whole term paper, marks per question type (each item is 1 mark): Section A, Section B, 4 number names,
// one poem stanza (4 lines) and the poet's name. The exam readiness meter weighs skills by this.
export const TERM_PAPER: Partial<Record<QuestionType, number>> = { ...TEST_A, ...TEST_B, number_name: 4, poem_line: 4, poet_name: 1 };

// Test 1 is the school's Term 1 paper (9 Oct 2026), question for question.
const test1Picks = [
  find(N, "meaning_kn", "ಕಳೆ"), find(N, "meaning_kn", "ಭವಿಷ್ಯ"), find(P, "meaning_kn", "ಛಾವಣಿ"),
  find(P, "meaning_en", "ಸಂದೇಹ"), find(P, "meaning_en", "ವ್ಯರ್ಥ"), find(N, "meaning_en", "ನೆಲೆ"),
  find(N, "en_to_kn", "Family"), find(N, "en_to_kn", "Breath"), find(P, "en_to_kn", "Noble"),
  find(N, "opposite", "ಹಿರಿಯ"), find(N, "opposite", "ಏರು"), find(P, "opposite", "ದುಃಖ"),
  find(P, "gender", "ರಾಕ್ಷಸ"), find(P, "gender", "ನಾಯಕ"), find(P, "gender", "ಕವಿ"),
  find(P, "plural", "ಸ್ನೇಹಿತ"), find(P, "plural", "ಯಂತ್ರ"),
  find(N, "split", "ಎದ್ದೇಳಿ"), find(N, "split", "ಉಕ್ಕೇರಲಿ"), find(P, "split", "ಅವರಲ್ಲೊಬ್ಬ"),
  find(N, "one_sentence", "ಕಣವಿಯವರು ಈ ನೆಲದ ಮಣ್ಣು ಮತ್ತು ಬೆಳೆ ಯಾವ ಬಣ್ಣದಲ್ಲಿವೆ ಎಂದು ಹೇಳಿದ್ದಾರೆ?"),
  find(P, "one_sentence", "ನರಿಯು ತನ್ನ ಗುಹೆಯನ್ನು ಏಕೆ ತ್ಯಜಿಸಿತು?"),
  find(N, "one_sentence", "ಕಣವಿಯವರು ತನ್ನ ದೇಶ ಮತ್ತು ಜನರನ್ನು ಏನೆಂದು ಭಾವಿಸಿದ್ದಾರೆ?"),
  find(P, "one_sentence", "‘ಮಾತನಾಡುವ ಗುಹೆ’ ಕಥೆಯ ನೀತಿ ಏನು?"),
  find(N, "one_sentence", "ನಮ್ಮ ಹಿರಿಯ ಒಕ್ಕಲು ಯಾವುದೆಂದು ಕಣವಿಯವರು ಹೇಳಿದ್ದಾರೆ?"),
  find(P, "one_sentence", "ರಾಜನು ವಿದ್ವಾಂಸರ ಸಭೆಯನ್ನು ಏಕೆ ಕರೆದನು?"),
  find(P, "who_said", "“ಎಲೈ ಮಾತನಾಡುವ ಗುಹೆಯೇ, ನಿನಗೇನಾಗಿದೆ?”"),
  find(P, "who_said", "“ನರಿರಾಯರೇ, ಬರಬೇಕು, ಬರಬೇಕು.”"),
  find(N, "own_sentence", "ಜೀವಕಳೆ"), find(P, "own_sentence", "ಪರಿಹಾರ"), find(P, "own_sentence", "ವಿದ್ಯಾಭ್ಯಾಸ"),
  ...numbers(45, 33, 42, 34),
  ...poemStanza(1),
  ...poet(),
];
for (const q of test1Picks) used.set(q.id, 1);

const testTitle = (n: number) => ({ kn: `ಮಾದರಿ ಪರೀಕ್ಷೆ ${toKannadaDigits(n)} (ಪಂಚತಂತ್ರ, ನನ್ನ ದೇಶ ನನ್ನ ಜನ)`, en: `Practice test ${n} (Panchatantra + Nanna Desha Nanna Jana)` });

const tests: Worksheet[] = [
  build("test-1", "test", testTitle(1), [P, N], test1Picks),
  build("test-2", "test", testTitle(2), [P, N], [...pick([P, N], TEST_A), ...pick([P, N], TEST_B), ...numbers(27, 38, 49, 31), ...poemStanza(2), ...poet()]),
  build("test-3", "test", testTitle(3), [P, N], [...pick([P, N], TEST_A), ...pick([P, N], TEST_B), ...numbers(36, 24, 47, 50), ...poemStanza(3), ...poet()]),
];

// Chapter practice: 25 marks, 40 minutes, the same question types as the term test for one chapter.
const CHAPTER: Record<string, { quota: Partial<Record<QuestionType, number>>; extra: (set: 0 | 1) => Question[] }> = {
  [P]: {
    quota: { meaning_kn: 2, meaning_en: 2, en_to_kn: 2, opposite: 2, gender: 2, plural: 2, split: 2, one_sentence: 4, who_said: 2, own_sentence: 3 },
    extra: (set) => numbers(...(set ? [29, 46] : [21, 37])),
  },
  [N]: {
    quota: { meaning_kn: 2, meaning_en: 2, en_to_kn: 2, opposite: 2, split: 2, rhyme: 2, one_sentence: 4, own_sentence: 2 },
    extra: (set) => [...numbers(...(set ? [32, 48] : [25, 39])), ...poemStanza(set ? 4 : 0), ...poet()],
  },
  [K]: {
    quota: { meaning_kn: 2, meaning_en: 2, en_to_kn: 2, opposite: 3, plural: 3, fill_blank: 2, one_sentence: 4, who_said: 2, own_sentence: 3 },
    extra: (set) => numbers(...(set ? [44, 28] : [23, 41])),
  },
  [H]: {
    quota: { meaning_kn: 2, meaning_en: 2, en_to_kn: 2, synonym: 2, opposite: 2, gender: 2, plural: 2, split: 2, one_sentence: 3, who_said: 2, own_sentence: 2 },
    extra: (set) => numbers(...(set ? [58, 66] : [53, 61])),
  },
};

function chapterPractice(lesson: Lesson, set: 0 | 1): Worksheet {
  const c = CHAPTER[lesson.id];
  const label = set === 0 ? "A" : "B";
  return build(
    `${lesson.id}-practice-${label.toLowerCase()}`,
    "practice",
    { kn: `${lesson.title.kn} – ಅಭ್ಯಾಸ ${label}`, en: `${lesson.title.en} – Practice ${label}` },
    [lesson.id],
    pick([lesson.id], c.quota, c.extra(set)),
  );
}

// Worksheets from before the Grade 6 marking scheme arrived. Kept so earlier attempts still open; not offered any more.
const RETIRED_PER_TYPE: Partial<Record<QuestionType, number>> = {
  meaning_kn: 3, meaning_en: 3, en_to_kn: 2, opposite: 3, gender: 3, plural: 3, split: 3,
  one_sentence: 4, who_said: 2, fill_blank: 2, own_sentence: 2, rhyme: 3, poem_line: 4, poet_name: 1,
};
function retiredChapter(lesson: Lesson, set: 0 | 1): Worksheet {
  const picks: Question[] = [];
  for (const ex of lesson.exercises) {
    const n = RETIRED_PER_TYPE[ex.type] ?? 0;
    let chosen = ex.questions.slice(set * n, set * n + n);
    if (chosen.length === 0) chosen = ex.questions.slice(0, n);
    if (ex.type === "poem_line") chosen = ex.questions.slice(set * 4, set * 4 + 4);
    picks.push(...chosen);
  }
  const label = set === 0 ? "A" : "B";
  return build(`${lesson.id}-${label.toLowerCase()}`, "practice", { kn: `${lesson.title.kn} – ಅಭ್ಯಾಸ ${label}`, en: `${lesson.title.en} – Practice ${label} (old)` }, [lesson.id], picks, { retired: true });
}

// Unit Test 2 (Grade VI, 25 marks, 40 minutes): Lesson 17, grammar, number names 51–70, as on the school's UT2 paper.
// Word questions are ½ mark each (the Kannada meaning is 1); 20 written marks plus 5 for an oral test in class.
const UT_QUOTA = { meaning_kn: 2, meaning_en: 2, en_to_kn: 2, synonym: 2, opposite: 2, gender: 2, plural: 2, split: 2, own_sentence: 3, one_sentence: 4, who_said: 2 };
const UT_MARKS: Partial<Record<QuestionType, number>> = { meaning_en: 0.5, en_to_kn: 0.5, synonym: 0.5, opposite: 0.5, gender: 0.5, plural: 0.5, split: 0.5 };
const unitTest = (label: "A" | "B", nums: number[]) =>
  build(
    `ut2-${label.toLowerCase()}`,
    "test",
    { kn: `ಘಟಕ ಪರೀಕ್ಷೆ ೨ – ಅಭ್ಯಾಸ ${label} (ನಿನ್ನಲ್ಲೂ ಅದ್ಭುತ ಶಕ್ತಿಯಿದೆ)`, en: `Unit test 2 practice ${label} (Ninnallu Adbhuta Shaktiyide)` },
    [H],
    pick([H], UT_QUOTA, numbers(...nums)),
    { minutes: 40, oralMarks: 5 },
    UT_MARKS,
  );
const unitTests = [unitTest("A", [57, 64]), unitTest("B", [52, 69])];

export const WORKSHEETS: Worksheet[] = [...unitTests, ...tests, ...LESSONS.flatMap((l) => [chapterPractice(l, 0), chapterPractice(l, 1)])];
export const TESTS = WORKSHEETS.filter((w) => w.kind === "test");
export const PRACTICE = WORKSHEETS.filter((w) => w.kind === "practice");

const RETIRED: Worksheet[] = LESSONS.flatMap((l) => [retiredChapter(l, 0), retiredChapter(l, 1)]);

export function getWorksheet(id: string) {
  return WORKSHEETS.find((w) => w.id === id) ?? RETIRED.find((w) => w.id === id) ?? (id === "term-practice-1" ? TERM_PRACTICE_1 : undefined);
}

// Questions are numbered within their section, as on a school paper.
export function worksheetQuestionNumber(ws: Worksheet, qid: string) {
  for (const [si, s] of ws.sections.entries()) {
    const qi = s.questions.findIndex((q) => q.id === qid);
    if (qi >= 0) return `${si + 1}.${qi + 1}`;
  }
  return "?";
}

// The first practice paper, built from the school's Grade VI worksheet. Retired; kept for earlier attempts.
const TERM_PRACTICE_1 = build(
  "term-practice-1",
  "test",
  { kn: "ಅಭ್ಯಾಸ ಪತ್ರಿಕೆ ೧ (ಪಂಚತಂತ್ರ, ನನ್ನ ದೇಶ ನನ್ನ ಜನ)", en: "Term practice 1 (Panchatantra + Nanna Desha Nanna Jana)" },
  [P, N],
  [
    find(N, "meaning_kn", "ಪ್ರಾಚೀನ"), find(P, "meaning_kn", "ಕೊಂಚ"), find(P, "meaning_kn", "ಗುಹೆ"), find(N, "meaning_kn", "ಒಕ್ಕಲು"),
    find(P, "meaning_en", "ಸಂದೇಹ"), find(P, "meaning_en", "ಪುರಾತನ"), find(P, "meaning_en", "ಊಳಿ"), find(P, "meaning_en", "ಮಂದಿ"),
    find(P, "en_to_kn", "Attention"), find(N, "en_to_kn", "Debt"), find(P, "en_to_kn", "Noble"), find(N, "en_to_kn", "The present"),
    find(P, "opposite", "ಧೈರ್ಯ"), find(N, "opposite", "ಮಾನ"), find(P, "opposite", "ದುಃಖ"), find(P, "opposite", "ಲಕ್ಷ್ಯ"),
    find(P, "gender", "ಸಿಂಹ"), find(P, "gender", "ನಾಯಕ"), find(P, "gender", "ಗಂಡು"), find(P, "gender", "ತಂದೆ"),
    find(P, "plural", "ಸ್ನೇಹಿತ"), find(P, "plural", "ದೇಶ"), find(P, "plural", "ಕಲೆ"), find(P, "plural", "ಜನ"),
    find(N, "split", "ಎದ್ದೇಳಿ"), find(P, "split", "ಗುಹೆಯನ್ನು"), find(P, "split", "ವಿದ್ಯಾಭ್ಯಾಸ"), find(P, "split", "ದುಃಖವಾಯಿತು"),
    find(N, "one_sentence", "ಕವಿ ಕಣವಿಯವರು ಸ್ವಚ್ಛಂದದ ಹಕ್ಕಿಗಳು ಎಂದು ಯಾರನ್ನು ಕರೆದಿದ್ದಾರೆ?"),
    find(P, "one_sentence", "ರಾಜನಿಗೆ ತನ್ನ ಮಕ್ಕಳ ಬಗ್ಗೆ ಏಕೆ ದುಃಖವಾಯಿತು?"),
    find(N, "one_sentence", "ಕಣವಿಯವರು ತನ್ನ ದೇಶ ಮತ್ತು ಜನರನ್ನು ಏನೆಂದು ಭಾವಿಸಿದ್ದಾರೆ?"),
    find(P, "one_sentence", "ವಿಷ್ಣುಶರ್ಮನು ರಾಜನಿಗೆ ಏನೆಂದು ಹೇಳಿದನು?"),
    find(N, "one_sentence", "'ನನ್ನ ದೇಶ ನನ್ನ ಜನ' ಪದ್ಯವನ್ನು ಬರೆದ ಕವಿ ಯಾರು?"),
    find(P, "one_sentence", "ನರಿಯು ತನ್ನ ಗುಹೆಯನ್ನು ಏಕೆ ತ್ಯಜಿಸಿತು?"),
    find(P, "who_said", "“ನಿಮ್ಮಲ್ಲಿ ಯಾರಾದರೂ ನನಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲಿರಾ?”"),
    find(P, "who_said", "“ನರಿರಾಯರೇ, ಬರಬೇಕು, ಬರಬೇಕು.”"),
    find(N, "own_sentence", "ಜೀವಕಳೆ"), find(P, "own_sentence", "ಅಪೂರ್ವ"), find(P, "own_sentence", "ವಿದ್ಯಾಭ್ಯಾಸ"), find(N, "own_sentence", "ಋಣ"),
    ...numbers(44, 33, 43, 35),
    ...getLesson(N)!.exercises.find((e) => e.type === "poem_line")!.questions.slice(0, 8),
    ...poet(),
  ],
  { retired: true, poemCues: [nannaDeshaStanzas[1][0][0], nannaDeshaStanzas[2][0][0]] },
);
