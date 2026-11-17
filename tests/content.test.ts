import { describe, expect, it } from "vitest";
import { LESSONS, WORKSHEETS, getQuestion, getWorksheet, sectionPart } from "@/content";
import { KEY_GRADED } from "@/content/schema";
import { gradeByKey } from "@/lib/grading/answerKey";
import { transliterate } from "@/lib/transliterate";
import { SCHOOL_WORKSHEET_ANSWERS } from "@/content/grade6/sampleAnswers";

describe("content", () => {
  it("loads four lessons with unique question ids", () => {
    expect(LESSONS.map((l) => l.id)).toEqual(["panchatantra", "nanna-desha", "kugutide-pakshi", "ninnallu-adbhuta-shakti"]);
    const ids = LESSONS.flatMap((l) => l.exercises.flatMap((e) => e.questions.map((q) => q.id)));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every key-graded question at least one answer and every AI-graded one rubric points", () => {
    for (const l of LESSONS)
      for (const ex of l.exercises)
        for (const q of ex.questions) {
          if (q.type === "who_said") expect(q.speaker?.length && q.listener?.length, q.id).toBeTruthy();
          else if (KEY_GRADED.includes(q.type)) expect(q.answers.length, q.id).toBeGreaterThan(0);
          else expect(q.points?.length, q.id).toBeGreaterThan(0);
        }
  });

  it("builds the practice tests on the school's Term 1 pattern: 40 marks, Section A 20 + Section B 20", () => {
    const tests = WORKSHEETS.filter((w) => w.kind === "test" && w.id.startsWith("test-"));
    expect(tests.map((t) => t.id)).toEqual(["test-1", "test-2", "test-3"]);
    for (const t of tests) {
      expect(t.totalMarks, t.id).toBe(40);
      expect(t.minutes).toBe(60);
      const marks = (part: "A" | "B") => t.sections.filter((s) => sectionPart(s.type) === part).reduce((n, s) => n + s.questions.length, 0);
      expect([marks("A"), marks("B")], t.id).toEqual([20, 20]);
      expect(t.sections.map((s) => [s.type, s.questions.length])).toEqual([
        ["meaning_kn", 3], ["meaning_en", 3], ["en_to_kn", 3], ["opposite", 3], ["gender", 3], ["plural", 2], ["split", 3],
        ["one_sentence", 6], ["who_said", 2], ["own_sentence", 3], ["number_name", 4], ["poem_line", 5],
      ]);
      // No word is tested twice in one paper (e.g. its Kannada meaning and its English meaning).
      const vocab = t.sections.filter((s) => ["meaning_kn", "meaning_en", "en_to_kn"].includes(s.type)).flatMap((s) => s.questions.map((q) => (q.type === "en_to_kn" ? q.answers[0] : q.prompt)));
      expect(new Set(vocab).size, t.id).toBe(vocab.length);
    }
  });

  it("reproduces the school's Term 1 paper as Test 1", () => {
    const t = getWorksheet("test-1")!;
    const prompts = t.sections.map((s) => s.questions.map((q) => q.prompt).join(" | "));
    expect(prompts[0]).toBe("ಕಳೆ | ಭವಿಷ್ಯ | ಛಾವಣಿ");
    expect(prompts[2]).toBe("Family | Breath | Noble");
    expect(prompts[10]).toBe("೪೫ | ೩೩ | ೪೨ | ೩೪");
    expect(t.sections[11].questions[0].prompt).toBe("ಕೆಂಪು …");
  });

  it("makes every chapter practice 25 marks in 40 minutes, and keeps old worksheets for past attempts", () => {
    const practice = WORKSHEETS.filter((w) => w.kind === "practice");
    expect(practice.length).toBe(8);
    for (const w of practice) {
      expect(w.totalMarks, w.id).toBe(25);
      expect(w.minutes).toBe(40);
    }
    expect(getWorksheet("term-practice-1")?.retired).toBe(true);
    expect(getWorksheet("panchatantra-a")?.retired).toBe(true);
  });
});

describe("answer key grading on the real school worksheet", () => {
  it("covers every term-practice question", () => {
    const ws = getWorksheet("term-practice-1")!;
    const qids = ws.sections.flatMap((s) => s.questions.map((q) => q.id));
    expect(Object.keys(SCHOOL_WORKSHEET_ANSWERS).sort()).toEqual([...qids].sort());
  });

  it("marks the child's key-graded answers as the teacher's key would", () => {
    const results = Object.entries(SCHOOL_WORKSHEET_ANSWERS)
      .map(([id, a]) => [id, getQuestion(id)!, a] as const)
      .filter(([, q]) => KEY_GRADED.includes(q.type))
      .map(([id, q, a]) => [id, gradeByKey(q, a).status] as const);
    const notCorrect = results.filter(([, s]) => s !== "correct");
    // "ಲಕ್ಷ್ಯ/ಗಮನ" (two alternatives written together) needs the AI check. ಒಕ್ಕಲು was answered ಬೇಸಾಯ, the old key;
    // the Kannada teacher's review (26 Oct 2026) changed its meaning to ಮನೆತನ, so that answer is no longer an automatic match and goes to the AI check.
    expect(notCorrect).toEqual([["nanna-desha.mkn.1", "unsure"], ["panchatantra.ekn.6", "unsure"]]);
  });

  it("gives near-miss spelling feedback and half marks for a half-right who-said", () => {
    const opp = getQuestion("panchatantra.opp.5")!;
    const r = gradeByKey(opp, "ಅದೈರ್ಯ");
    expect(r.status).toBe("incorrect");
    expect(r.nearMiss?.correct).toBe("ಅಧೈರ್ಯ");
    const who = getQuestion("panchatantra.who.3")!;
    expect(gradeByKey(who, "ಈ ಮಾತನ್ನು ಸಿಂಹ ರಾಜನಿಗೆ ಹೇಳಿತು").fraction).toBe(0.5);
    expect(gradeByKey(who, "").status).toBe("blank");
  });
});

describe("transliteration", () => {
  it("uses the documented scheme", () => {
    expect(transliterate("ಪಂಚತಂತ್ರ")).toBe("panchatantra");
    expect(transliterate("ನನ್ನ ದೇಶ ನನ್ನ ಜನ")).toBe("nanna dēsha nanna jana");
    expect(transliterate("ಗುಹೆ")).toBe("guhe");
    expect(transliterate("ಸಿಂಹ")).toBe("sinha");
    expect(transliterate("ದುಃಖ")).toBe("duhkha");
  });
});

describe("unit test 2", () => {
  it("covers every UT2 portion in the school's 25-mark format: 20 written (with ½ marks) + 5 oral, 40 minutes", async () => {
    const { getWorksheet } = await import("@/content");
    for (const id of ["ut2-a", "ut2-b"]) {
      const w = getWorksheet(id)!;
      expect(w.totalMarks, id).toBe(20);
      expect(w.oralMarks).toBe(5);
      expect(w.minutes).toBe(40);
      expect(w.sections.map((s) => s.type)).toEqual([
        "meaning_kn", "meaning_en", "en_to_kn", "synonym", "opposite", "gender", "plural", "split", "one_sentence", "who_said", "own_sentence", "number_name",
      ]);
      expect(w.sections.find((s) => s.type === "opposite")!.marksEach).toBe(0.5);
      for (const q of w.sections.find((s) => s.type === "number_name")!.questions) expect(Number(q.promptEn)).toBeGreaterThan(50);
    }
  });

  it("gives ½ mark per word question on the unit test and 1 elsewhere", async () => {
    const { maxFor } = await import("@/lib/grading/grade");
    const { getWorksheet } = await import("@/content");
    const q = getWorksheet("ut2-a")!.sections.find((s) => s.type === "gender")!.questions[0];
    expect(maxFor(q.id, "ut2-a")).toBe(0.5);
    expect(maxFor(q.id)).toBe(1);
  });

  it("accepts any listed synonym, and knows number names up to 70", async () => {
    const { getLesson, getQuestion } = await import("@/content");
    const { gradeByKey } = await import("@/lib/grading/answerKey");
    const q = getLesson("ninnallu-adbhuta-shakti")!.exercises.find((e) => e.type === "synonym")!.questions.find((x) => x.prompt === "ಸಮುದ್ರ")!;
    expect(gradeByKey(q, "ಸಾಗರ").status).toBe("correct");
    expect(gradeByKey(q, "ಕಡಲು").status).toBe("correct");
    expect(getQuestion("numbers.70")!.answers[0]).toBe("ಎಪ್ಪತ್ತು");
    expect(getQuestion("numbers.63")!.answers).toContain("ಅರವತ್ಮೂರು");
  });
});
