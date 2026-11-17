import { z } from "zod";

// Skills shown on the parent dashboard. Every question is tagged with exactly
// the skill it measures, so skill scores never borrow from other activity.
export const SKILLS = {
  vocabulary: { en: "Vocabulary & meanings" },
  grammar: { en: "Grammar" },
  comprehension: { en: "Reading & comprehension" },
  writing: { en: "Writing sentences" },
  poem: { en: "Poem by heart" },
} as const;
export type Skill = keyof typeof SKILLS;

const Bilingual = z.object({ kn: z.string(), en: z.string() });

export const SentenceSchema = z.object({
  id: z.string(),
  kn: z.string(),
  en: z.string(),
});

export const PartSchema = z.object({
  heading: Bilingual.optional(),
  // Poems are shown line by line; prose sentence by sentence.
  sentences: z.array(SentenceSchema),
});

export const GlossarySchema = z.object({
  word: z.string(),
  meaningKn: z.string(),
  meaningEn: z.string(),
  // The English word printed for "English word → Kannada" questions, when it isn't the first meaning.
  enPrompt: z.string().optional(),
});

// Question types used in the teacher's notes and the school worksheet.
export const QUESTION_TYPES = [
  "meaning_kn", // write the Kannada meaning of a Kannada word
  "meaning_en", // write the English meaning of a Kannada word
  "en_to_kn", // write the Kannada word for an English word
  "opposite",
  "synonym", // write a word with the same meaning (ಸಮಾನಾರ್ಥಕ ಪದ)
  "gender",
  "plural",
  "split",
  "rhyme",
  "number_name",
  "fill_blank",
  "who_said",
  "one_sentence",
  "own_sentence",
  "poem_line",
  "poet_name",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// Types graded by matching the answer key in code (no AI call).
export const KEY_GRADED: QuestionType[] = [
  "meaning_kn",
  "meaning_en",
  "en_to_kn",
  "opposite",
  "synonym",
  "gender",
  "plural",
  "split",
  "rhyme",
  "number_name",
  "fill_blank",
  "who_said",
  "poem_line",
  "poet_name",
];

export const QuestionSchema = z.object({
  id: z.string(),
  type: z.enum(QUESTION_TYPES),
  skill: z.enum(Object.keys(SKILLS) as [Skill, ...Skill[]]),
  // What is printed on the worksheet, e.g. the word "ಗುಹೆ" or a full question.
  prompt: z.string(),
  promptEn: z.string().optional(),
  // Accepted answers for key-graded types. For "split", parts are joined with " + ".
  answers: z.array(z.string()).default([]),
  // who_said: both people must be named. Stems are matched inside the child's sentence.
  speaker: z.array(z.string()).optional(),
  listener: z.array(z.string()).optional(),
  // Model answer from the teacher's notes (shown after grading, and in "I'm stuck").
  model: Bilingual.optional(),
  // Rubric points for AI-graded types, in English so parents can read them.
  points: z.array(z.string()).optional(),
  hint: z.string().optional(),
  // Set when a reviewer should double-check the key.
  reviewNote: z.string().optional(),
});
export type Question = z.infer<typeof QuestionSchema>;

export const ExerciseSchema = z.object({
  id: z.string(),
  type: z.enum(QUESTION_TYPES),
  instructionKn: z.string(),
  instructionEn: z.string(),
  questions: z.array(QuestionSchema),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const LessonSchema = z.object({
  id: z.string(),
  number: z.number(),
  kind: z.enum(["prose", "poem"]),
  title: Bilingual,
  author: Bilingual,
  // Where the content came from, shown to parents.
  source: z.literal("teacher-notes"),
  intro: z.array(SentenceSchema).default([]),
  parts: z.array(PartSchema),
  summaryEn: z.array(z.string()).default([]),
  glossary: z.array(GlossarySchema),
  exercises: z.array(ExerciseSchema),
});
export type Lesson = z.infer<typeof LessonSchema>;
export type LessonInput = z.input<typeof LessonSchema>;
