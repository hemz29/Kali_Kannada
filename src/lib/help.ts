import { LESSONS, getLesson, getQuestion } from "@/content";
import { NUMBER_NAMES } from "@/content/grade6/numbers";
import { nannaDeshaStanzas } from "@/content/grade6/nannaDesha";
import type { Question, QuestionType } from "@/content/schema";
import { aksharas, meaningOf, stripPunct } from "@/content/words";
import { lookalikes } from "./lookalikes";
import { transliterate } from "./transliterate";

// Two hints per question.
// Hint 1 is free: it explains the word or points to the right place in the lesson, without giving the answer.
// Hint 2 shows choices; an answer written after Hint 2 gets half marks if it is right (see HINT2_FACTOR).
export const HINT2_FACTOR = 0.5;

// Help levels kept per question in session.help: 1 = Hint 1, 2 = Hint 2 opened, 3 = Hint 2 picked right,
// 4 = Hint 2 picked wrong. The child gets one pick; a wrong pick means no marks for that question.
export const HINT2_RIGHT = 3;
export const HINT2_WRONG = 4;
// A pick also counts as opening Hint 2 (the "opened" save can lose a race with Hint 1's); only a second pick is refused.
export const levelAfterPick = (current: number, correct: boolean) => (current < HINT2_RIGHT ? (correct ? HINT2_RIGHT : HINT2_WRONG) : null);

export type Hint1 = { lines: string[]; kn?: string; knEn?: string };
export type Hint2 = { question: string; options: string[]; correct: string; latin: boolean };

const say = (w: string) => `“${w}” (${transliterate(w)})`;
const enOf = (w: string) => meaningOf(w)?.en;
const starts = (w: string, n = 1) => aksharas(w).slice(0, n).join("") + "…";

const lessonOf = (q: Question) => getLesson(q.id.split(".")[0]);
const lessonSentences = (q: Question) => {
  const l = lessonOf(q);
  return l ? [...l.intro, ...l.parts.flatMap((p) => p.sentences)] : [];
};
// The first lesson sentence that uses the word, with its English translation.
const sentenceWith = (q: Question, word: string) =>
  lessonSentences(q).find((s) => s.kn.split(/\s+/).some((w) => stripPunct(w).startsWith(word)));

function hideWord(sentence: string, word: string) {
  return sentence
    .split(/\s+/)
    .map((w) => (stripPunct(w).startsWith(word) ? starts(word) + "____" : w))
    .join(" ");
}

const HINT1: Record<QuestionType, (q: Question) => Hint1> = {
  meaning_kn: (q) => ({
    lines: [`${say(q.prompt)} means “${enOf(q.prompt) ?? q.model?.en ?? "?"}” in English.`, "Now write another Kannada word with the same meaning."],
  }),
  meaning_en: (q) => {
    const s = sentenceWith(q, q.prompt);
    return s
      ? { lines: [`${say(q.prompt)} is used in this line of the lesson. Read the English to work out what it means.`], kn: s.kn, knEn: s.en }
      : { lines: [`Say ${say(q.prompt)} aloud and think where it came in the lesson.`] };
  },
  en_to_kn: (q) => {
    const word = q.answers[0];
    const s = sentenceWith(q, word);
    return {
      lines: [`The Kannada word starts with “${starts(word)}”.`, ...(s ? ["It is hidden in this line of the lesson:"] : [])],
      kn: s ? hideWord(s.kn, word) : undefined,
      knEn: s?.en,
    };
  },
  opposite: (q) => {
    const answer = q.answers[0];
    // ಮಾನ → ಅಪಮಾನ (letters added), ಅಸ್ಪಷ್ಟ → ಸ್ಪಷ್ಟ (letters taken off), or a different word.
    const tip = answer.includes(q.prompt)
      ? `Tip: this opposite is made by adding letters to the front of “${q.prompt}”.`
      : q.prompt.includes(answer)
        ? `Tip: this opposite is made by taking letters off the front of “${q.prompt}”.`
        : `It starts with “${starts(answer)}”.`;
    return { lines: [`${say(q.prompt)} means “${enOf(q.prompt) ?? "?"}”.`, "Think of the word that means the opposite.", tip] };
  },
  synonym: (q) => ({
    lines: [`${say(q.prompt)} means “${q.model?.en ?? enOf(q.prompt) ?? "?"}”.`, "Write another Kannada word that means the same.", `One answer starts with “${starts(q.answers[0])}”.`],
  }),
  gender: (q) => ({
    lines: [`${say(q.prompt)} means “${enOf(q.prompt) ?? "?"}”.`, "Write the word for the other gender (male ↔ female).", `It starts with “${starts(q.answers[0], aksharas(q.answers[0]).length > 2 ? 2 : 1)}”.`],
  }),
  plural: (q) => ({
    lines: [`${say(q.prompt)} means “${enOf(q.prompt) ?? "?"}” (one).`, "Write the word for many.", "Tip: Kannada plurals usually end in ಗಳು (-gaLu) or ರು (-ru)."],
  }),
  split: (q) => {
    const [a, b] = q.answers[0].split("+").map((x) => x.trim());
    return { lines: [`${say(q.prompt)} is two words joined together.`, `The first word starts with “${starts(a)}” and the second with “${starts(b ?? "")}”.`, "Write them with a + between."] };
  },
  rhyme: (q) => {
    const stanza = nannaDeshaStanzas.find((st) => st.some(([l]) => l.includes(q.prompt)));
    return stanza
      ? { lines: ["The rhyming word ends the same way and is in the same verse:"], kn: stanza.map(([l]) => hideWord(l, q.answers[0])).join("\n") }
      : { lines: [`Find the word in the poem that sounds like ${say(q.prompt)} at the end.`] };
  },
  number_name: (q) => {
    const n = Number(q.promptEn);
    const tens = Math.floor(n / 10) * 10;
    return {
      lines: [
        `${q.prompt} is ${n} = ${tens} + ${n % 10}.`,
        n % 10 && tens ? `${tens} is “${NUMBER_NAMES[tens].at(-1)}” and ${n % 10} is “${NUMBER_NAMES[n % 10][0]}”. Join them into one word.` : "Write it as one word.",
      ],
    };
  },
  fill_blank: (q) => {
    const before = q.prompt.split("______")[0].trim().split(/\s+/).slice(-2).join(" ");
    const s = lessonSentences(q).find((x) => before && x.kn.includes(before));
    return { lines: ["This sentence is from the lesson. The English says:", s?.en ?? q.promptEn ?? ""], kn: undefined };
  },
  who_said: (q) => ({
    lines: [`In English: ${q.promptEn ?? ""}`, `The speaker's name starts with “${starts(q.speaker?.[0] ?? "")}”. Write who said it and to whom.`],
  }),
  one_sentence: (q) => {
    const asked = new Set(q.prompt.split(/\s+/).map(stripPunct));
    const words = (q.model?.kn ?? "")
      .split(/\s+/)
      .map(stripPunct)
      .filter((w) => w && !asked.has(w))
      .map((w) => [w, meaningOf(w)] as const)
      .filter(([, m]) => m && m.source !== "ai")
      .slice(0, 3);
    return {
      lines: [
        `The question asks: ${q.promptEn ?? ""}`,
        ...(words.length ? ["Words that will help:", ...words.map(([w, m]) => `${w} (${transliterate(w)}) = ${m!.en}`)] : []),
        "Start your answer with words from the question.",
      ],
    };
  },
  own_sentence: (q) => ({
    lines: [`${say(q.prompt)} means “${q.promptEn ?? enOf(q.prompt) ?? "?"}”.`, "Think of something from your own day where you could use it, and write one full sentence."],
  }),
  poem_line: (q) => {
    const line = q.answers[0];
    const en = nannaDeshaStanzas.flat().find(([l]) => l === line)?.[1];
    return { lines: [`This line starts with “${line.split(" ")[0]}”.`, ...(en ? [`In English it says: “${en}”.`] : [])] };
  },
  poet_name: (q) => ({ lines: [`The poet's name starts with “${starts(q.answers[0], 2)}”.`] }),
};

// Deterministic shuffle so a child sees the same choices each time.
function shuffle<T>(xs: T[], seedText: string) {
  let seed = [...seedText].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 233280, 7);
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sameType = (q: Question) => {
  const own = lessonOf(q)?.exercises.filter((e) => e.type === q.type).flatMap((e) => e.questions) ?? [];
  const others = LESSONS.filter((l) => l !== lessonOf(q)).flatMap((l) => l.exercises.filter((e) => e.type === q.type).flatMap((e) => e.questions));
  return [...own, ...others].filter((x) => x.id !== q.id);
};

// Look-alikes of the question word come first, so the right answer isn't the only one that resembles it.
function choices(q: Question, correct: string, pool: string[], like: string[] = []) {
  const wrong = [...new Set(pool.filter((p) => p && p !== correct && !q.answers.includes(p)))];
  return shuffle([correct, ...[...like, ...shuffle(wrong, q.id)].slice(0, 3)], q.id + "!");
}

export function hint2(q: Question): Hint2 {
  const ask = "Which one is right? Choose, then write it on your paper.";
  switch (q.type) {
    case "meaning_en":
      return { question: ask, correct: q.answers[0], options: choices(q, q.answers[0], sameType(q).map((x) => x.answers[0])), latin: true };
    case "one_sentence":
    case "who_said": {
      const correct = q.model?.kn ?? q.answers[0];
      return { question: "Which answer is right? Write it in your own handwriting.", correct, options: choices(q, correct, sameType(q).map((x) => x.model?.kn ?? "")), latin: false };
    }
    case "own_sentence": {
      const correct = q.promptEn ?? "";
      return { question: `What does “${q.prompt}” mean? Then write your own sentence with it.`, correct, options: choices(q, correct, sameType(q).map((x) => x.promptEn ?? "")), latin: true };
    }
    case "number_name": {
      const n = Number(q.promptEn);
      const pool = [n - 1, n + 1, n + 10, n - 10].filter((x) => NUMBER_NAMES[x]).map((x) => NUMBER_NAMES[x][0]);
      return { question: ask, correct: q.answers[0], options: choices(q, q.answers[0], pool), latin: false };
    }
    case "poem_line": {
      const all = nannaDeshaStanzas.flat().map(([l]) => l);
      return { question: "Which is the right line?", correct: q.answers[0], options: choices(q, q.answers[0], all), latin: false };
    }
    case "poet_name":
      return { question: ask, correct: q.answers[0], options: choices(q, q.answers[0], ["ಕುವೆಂಪು", "ದ. ರಾ. ಬೇಂದ್ರೆ", "ಜಿ. ಎಸ್. ಶಿವರುದ್ರಪ್ಪ"]), latin: false };
    default:
      return { question: ask, correct: q.answers[0], options: choices(q, q.answers[0], sameType(q).map((x) => x.answers[0]), lookalikes(q)), latin: false };
  }
}

export function hint1(q: Question): Hint1 {
  return HINT1[q.type](q);
}

export function hintsFor(questionId: string) {
  const q = getQuestion(questionId);
  return q ? { hint1: hint1(q), hint2: hint2(q) } : null;
}
