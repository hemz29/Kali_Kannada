import { notFound } from "next/navigation";
import { getLesson, SECTION_TEXT } from "@/content";
import type { QuestionType } from "@/content/schema";
import { meaningOf } from "@/content/words";
import { lookalikes } from "@/lib/lookalikes";
import { transliterate } from "@/lib/transliterate";
import { PracticeCards, type Card } from "@/components/PracticeCards";

const CARD_TYPES: Partial<Record<QuestionType, string>> = {
  opposite: "Choose the opposite word",
  synonym: "Choose the word with the same meaning",
  plural: "Choose the plural",
  gender: "Change the gender",
  meaning_kn: "Choose the meaning",
  split: "How does this word split?",
  rhyme: "Which word rhymes in the poem?",
};

function shuffle<T>(xs: T[], seed: number) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The right answer's English meaning, for the feedback after a choice: "ಸ್ಪಷ್ಟ = clear".
function meaningEn(type: QuestionType, prompt: string, answer: string) {
  const en = (w: string) => meaningOf(w)?.en;
  if (type === "split") {
    const parts = answer.split("+").map((p) => p.trim());
    const ens = parts.map(en);
    return ens.every(Boolean) ? parts.map((p, i) => `${p} = ${ens[i]}`).join(", ") : en(prompt);
  }
  return type === "meaning_kn" ? (en(prompt) ?? en(answer)) : (en(answer) ?? undefined);
}

export default async function CardsPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const lesson = getLesson((await params).lessonId);
  if (!lesson) notFound();

  // Tap-to-answer drills built from the teacher's key. Wrong options look like the question word where the
  // answer is formed from it (splits, plurals, ...); otherwise they are other answers from the same exercise.
  const cards: Card[] = [];
  for (const ex of lesson.exercises) {
    const label = CARD_TYPES[ex.type];
    if (!label) continue;
    const pool = [...new Set(ex.questions.map((q) => q.answers[0]))];
    ex.questions.forEach((q, i) => {
      const others = shuffle(pool.filter((a) => !q.answers.includes(a)), i + 7);
      const like = lookalikes(q);
      const wrong = (like.length >= 3 ? like : [...like, ...others]).slice(0, 3);
      cards.push({
        questionId: q.id,
        skill: q.skill,
        type: q.type,
        label,
        // The school's instruction, without "the following words" since a card shows one word.
        labelKn: SECTION_TEXT[q.type].kn.replace(/^ಕೆಳಗಿನ ಪದಗಳ(?:ಿಗೆ|ನ್ನು) /, ""),
        prompt: q.prompt,
        correct: q.answers[0],
        correctLatin: transliterate(q.answers[0]),
        correctEn: meaningEn(q.type, q.prompt, q.answers[0]),
        options: shuffle([q.answers[0], ...wrong], i + 3),
      });
    });
  }

  return <PracticeCards lessonId={lesson.id} title={lesson.title} cards={shuffle(cards, 11).slice(0, 15)} />;
}
