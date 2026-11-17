"use client";
import { useState } from "react";
import Link from "next/link";
import type { QuestionType, Skill } from "@/content/schema";
import { transliterate } from "@/lib/transliterate";
import { KnText } from "@/components/Word";
import { LineIcon, type IconName } from "@/components/LineIcon";
import { stats } from "@/lib/localStats";

export type Card = {
  questionId: string;
  skill: Skill;
  type: QuestionType;
  label: string;
  labelKn: string;
  prompt: string;
  correct: string;
  correctLatin: string;
  correctEn?: string;
  options: string[];
};

// Each kind of question has its own colour and symbol, so a change of kind is noticed at a glance.
const TYPE_STYLE: Partial<Record<QuestionType, { icon: IconName; className: string }>> = {
  split: { icon: "scissors", className: "bg-peach text-peach-ink" },
  plural: { icon: "people", className: "bg-sky text-sky-ink" },
  gender: { icon: "family", className: "bg-lavender text-lavender-ink" },
  opposite: { icon: "swap", className: "bg-accent-soft text-accent" },
  synonym: { icon: "book", className: "bg-good-soft text-good" },
  meaning_kn: { icon: "book", className: "bg-warn-soft text-warn" },
  rhyme: { icon: "music", className: "bg-good-soft text-good" },
};

export function PracticeCards({ lessonId, title, cards }: { lessonId: string; title: { kn: string; en: string }; cards: Card[] }) {
  const [i, setI] = useState(0);
  // The choice made on each card; going back shows it again, and it can't be changed.
  const [picks, setPicks] = useState<(string | null)[]>(() => cards.map(() => null));
  const [saved, setSaved] = useState(false);
  const card = cards[i];
  const done = i >= cards.length;
  const chosen = done ? null : picks[i];
  const results = cards.map((c, k) => ({ questionId: c.questionId, correct: picks[k] === c.correct }));

  async function finish() {
    stats.cards(lessonId, results.filter((r) => r.correct).length, results.length);
    await fetch("/api/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId, results }) });
    setSaved(true);
  }

  function choose(opt: string) {
    if (chosen) return;
    setPicks((p) => p.map((x, k) => (k === i ? opt : x)));
  }

  function next() {
    const nextI = i + 1;
    setI(nextI);
    if (nextI >= cards.length && !saved) finish();
  }

  if (done) {
    const right = results.filter((r) => r.correct).length;
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <LineIcon name={right >= cards.length * 0.8 ? "trophy" : "sparkle"} size={56} className="mx-auto" />
        <h1 className="mt-3 text-3xl font-extrabold">{right} of {cards.length} correct</h1>
        <p className="mt-2 text-muted">{saved ? "Saved to your progress." : "Saving…"}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button className="btn btn-soft" onClick={() => { setI(0); setPicks(cards.map(() => null)); setSaved(false); }}>Play again</button>
          <Link href="/learn" className="btn btn-primary">Back home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-end justify-between gap-3" style={{ color: "var(--header-ink)" }}>
        <KnText text={title.kn} className="text-sm font-bold" />
        <span className="text-2xl font-semibold tabular-nums">
          {i + 1} <span className="text-base font-normal text-muted">of {cards.length}</span>
        </span>
      </div>
      {/* Fills as cards are answered, in the logo's black. */}
      <div className="h-3.5 overflow-hidden rounded-full border border-black/15 bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={i + (chosen ? 1 : 0)} aria-label="Cards done">
        <div className="h-full rounded-full bg-black transition-all" style={{ width: `${((i + (chosen ? 1 : 0)) / cards.length) * 100}%` }} />
      </div>
      <div className="paper p-8 text-center">
        <TypeBadge key={i} card={card} changed={i > 0 && cards[i - 1].type !== card.type} />
        {/* The word being tested shows no meaning until the child has answered. */}
        <p className="kn mt-3 text-5xl font-bold">{chosen ? <KnText text={card.prompt} /> : card.prompt}</p>
        <p className="mt-1 italic text-gray-500">{transliterate(card.prompt)}</p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          {card.options.map((o) => {
            const state = !chosen ? "" : o === card.correct ? "border-good bg-good-soft" : o === chosen ? "border-bad bg-bad-soft" : "opacity-50";
            return (
              <button key={o} onClick={() => choose(o)} className={`kn rounded-2xl border-2 border-gray-200 p-4 text-2xl font-bold transition hover:border-accent ${state}`}>
                {chosen ? <KnText text={o} mode="hover" /> : o}
              </button>
            );
          })}
        </div>
        {chosen && (
          <div className="mt-6 flex flex-col items-center gap-1">
            <p className={`text-lg font-bold ${chosen === card.correct ? "text-good" : "text-bad"}`}>{chosen === card.correct ? "Correct!" : "Not quite."}</p>
            <p className="text-lg">
              <KnText text={card.correct} className="font-bold" /> is the right answer.
            </p>
            <p className="text-muted">
              <span className="italic">{card.correctLatin}</span>
              {card.correctEn && <> · “{card.correctEn}”</>}
            </p>
          </div>
        )}
        {(i > 0 || chosen) && (
          <div className="mt-6 flex gap-3">
            {i > 0 && <button onClick={() => setI(i - 1)} className="btn btn-soft">← Back</button>}
            {chosen && <button onClick={next} className="btn btn-primary flex-1">Next</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function TypeBadge({ card, changed }: { card: Card; changed: boolean }) {
  const style: { icon: IconName; className: string } = TYPE_STYLE[card.type] ?? { icon: "question", className: "bg-gray-100 text-gray-700" };
  return (
    <div className={`mx-auto inline-flex items-center gap-3 rounded-2xl px-5 py-2.5 text-left ${style.className} ${changed ? "badge-pop" : ""}`}>
      <LineIcon name={style.icon} size={28} />
      <span className="flex flex-col leading-tight">
        <span className="text-lg font-extrabold">{card.label}</span>
        <KnText text={card.labelKn} className="text-sm opacity-80" />
      </span>
    </div>
  );
}
