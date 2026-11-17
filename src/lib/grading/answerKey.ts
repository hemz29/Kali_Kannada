import type { Question } from "@/content/schema";
import { compactKn, editDistance, graphemes, normalizeEn } from "./normalize";

export type KeyResult = {
  // "unsure" means the key didn't match but a valid alternative is possible; the AI step decides.
  status: "correct" | "partial" | "incorrect" | "blank" | "unsure";
  fraction: number;
  feedbackEn: string;
  // Closest key answer when the child was one or two letters away, for "your writing vs correct writing".
  nearMiss?: { wrote: string; correct: string };
};

// Types where a different but valid synonym is common, so a non-match goes to the AI check.
const SYNONYM_TYPES = new Set(["meaning_kn", "meaning_en", "en_to_kn", "synonym"]);

function closest(answer: string, keys: string[]) {
  const a = graphemes(compactKn(answer));
  let best = { key: keys[0], d: Infinity };
  for (const k of keys) {
    const d = editDistance(a, graphemes(compactKn(k)));
    if (d < best.d) best = { key: k, d };
  }
  return best;
}

function matchEnglish(answer: string, keys: string[]) {
  const a = normalizeEn(answer);
  if (!a) return false;
  return keys.some((k) => {
    const key = normalizeEn(k);
    if (key === a) return true;
    // "shout" for "shouting loudly": same word stem counts.
    const stems = (s: string) => s.split(" ").filter((w) => w.length > 2).map((w) => w.slice(0, 5));
    const ks = stems(key);
    return stems(a).some((s) => ks.includes(s));
  });
}

export function gradeByKey(q: Question, raw: string): KeyResult {
  const answer = raw.trim();
  if (!answer) return { status: "blank", fraction: 0, feedbackEn: "Not answered." };

  if (q.type === "who_said") {
    const text = compactKn(answer);
    const has = (stems: string[] = []) => stems.some((s) => text.includes(compactKn(s)));
    const sp = has(q.speaker);
    const li = has(q.listener);
    if (sp && li) return { status: "correct", fraction: 1, feedbackEn: "Both the speaker and the listener are correct." };
    if (sp || li)
      return {
        status: "partial",
        fraction: 0.5,
        feedbackEn: sp ? "The speaker is right, but the listener is missing or wrong." : "The listener is right, but the speaker is missing or wrong.",
      };
    return { status: "incorrect", fraction: 0, feedbackEn: "Neither the speaker nor the listener matches the lesson." };
  }

  if (q.type === "meaning_en") {
    if (matchEnglish(answer, q.answers)) return { status: "correct", fraction: 1, feedbackEn: "Correct meaning." };
    return { status: "unsure", fraction: 0, feedbackEn: `The notes give: ${q.answers.join(" / ")}.` };
  }

  if (q.type === "split") {
    const parts = (s: string) => s.split("+").map(compactKn).filter(Boolean).join("+");
    if (q.answers.some((k) => parts(k) === parts(answer)))
      return { status: "correct", fraction: 1, feedbackEn: "Correctly split." };
  } else if (q.answers.some((k) => compactKn(k) === compactKn(answer))) {
    return { status: "correct", fraction: 1, feedbackEn: "Correct." };
  }

  const best = closest(answer, q.answers);
  const nearMiss = best.d > 0 && best.d <= 2 ? { wrote: answer, correct: best.key } : undefined;
  if (SYNONYM_TYPES.has(q.type) && !nearMiss)
    return { status: "unsure", fraction: 0, feedbackEn: `The notes give: ${q.answers.join(" / ")}.` };
  return {
    status: "incorrect",
    fraction: 0,
    feedbackEn: nearMiss
      ? `Very close! Check the spelling: the correct answer is ${best.key}.`
      : `The correct answer is ${q.answers[0]}.`,
    nearMiss,
  };
}
