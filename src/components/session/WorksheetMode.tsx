"use client";
import { useEffect, useRef, useState } from "react";
import { getWorksheet, sectionPart } from "@/content";
import type { Question } from "@/content/schema";
import { HINT2_RIGHT, HINT2_WRONG, hint1, hint2 } from "@/lib/help";
import { transliterate } from "@/lib/transliterate";
import type { PracticeSession } from "@/lib/store/types";
import { KnText } from "@/components/Word";
import { LineIcon } from "@/components/LineIcon";

// The worksheet questions in large type while the child writes on paper, each with a Hint button.
export function WorksheetMode({ session, worksheetId, controls }: { session: PracticeSession; worksheetId: string; controls: React.ReactNode }) {
  const ws = getWorksheet(worksheetId)!;
  const [help, setHelp] = useState<Record<string, number>>(session.help);

  // Hint saves go to the server one at a time, in order: overlapping saves could overwrite each other.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const saveHelp = (body: object) => {
    const next = queue.current.then(() => fetch(`/api/sessions/${session.id}/help`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
    queue.current = next.catch(() => undefined);
    return next;
  };

  // Hint 2 allows one pick; the server records whether it was right, so a refresh can't reset it.
  async function pickHint(q: Question, option: string) {
    const res = await saveHelp({ questionId: q.id, pick: option });
    if (!res.ok) return;
    const { correct } = await res.json();
    setHelp((h) => ({ ...h, [q.id]: correct ? HINT2_RIGHT : HINT2_WRONG }));
  }

  async function openHint(q: Question, level: 1 | 2) {
    setHelp((h) => ({ ...h, [q.id]: Math.max(level, h[q.id] ?? 0) }));
    await saveHelp({ questionId: q.id, level });
  }

  let lastPart = "";
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <header className="card flex flex-wrap items-center gap-4 bg-white p-5">
        <div className="mr-auto min-w-0">
          <h1 className="text-2xl"><KnText text={ws.title.kn} /></h1>
          <p className="text-muted">{ws.title.en}</p>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            <li className="chip bg-accent-soft text-ink"><LineIcon name="pen" size={16} /> Write your answers on paper, with the same numbers as below</li>
            <li className="chip bg-accent-soft text-ink">{ws.oralMarks ? `${ws.totalMarks + ws.oralMarks} marks (${ws.totalMarks} written + ${ws.oralMarks} oral)` : `${ws.totalMarks} marks`}</li>
            <li className="chip bg-accent-soft text-ink">{ws.minutes} minutes</li>
          </ul>
        </div>
        <a href={`/api/download/${ws.id}`} target="_blank" rel="noreferrer" className="btn btn-ghost">Worksheet PDF</a>
      </header>

      {controls}

      <section aria-labelledby="questions" className="mt-2 flex flex-col gap-4">
        <div className="flex flex-col gap-2 border-b border-line pb-3">
          <h2 id="questions" className="text-2xl">Questions</h2>
          <HintRules />
        </div>
        {ws.sections.map((s, si) => {
          const part = sectionPart(s.type);
          const heading = part !== lastPart && ws.retired !== true ? part : null;
          lastPart = part;
          return (
            <div key={s.type} className="flex flex-col gap-4">
              {heading && <h2 className="serif mt-2 text-center text-xl">Section {heading}</h2>}
              <section className="paper p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold">
                    {si + 1}. <KnText text={s.kn} />
                    <span className="block text-sm font-normal text-gray-500">{s.en}</span>
                  </h3>
                  <span className="chip bg-gray-100 text-gray-700">{s.questions.length * s.marksEach} marks</span>
                </div>
                <ol className="mt-3 flex flex-col divide-y divide-gray-100">
                  {s.questions.map((q, qi) => (
                    <QuestionRow key={q.id} number={`${si + 1}.${qi + 1}`} q={q} level={help[q.id] ?? 0} hidePrompt={q.type === "poem_line" && qi % 4 !== 0} open={(l) => openHint(q, l)} pick={(o) => pickHint(q, o)} />
                  ))}
                </ol>
              </section>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function HintRules() {
  return (
    <p className="text-sm text-muted">
      <LineIcon name="bulb" size={18} className="mr-1 inline align-[-3px]" />Stuck? Press <b className="text-ink">Hint</b> next to a question. <b className="text-ink">Hint 1</b> is free.{" "}
      <b className="text-ink">Hint 2</b> shows four choices and you get <b className="text-ink">one try</b>: right gives <b className="text-ink">half marks</b>, wrong gives no marks.
    </p>
  );
}

// Questions that are sentences: hovering their words helps the child understand what is asked without giving
// the answer away. Single-word questions (meanings, opposites, plurals…) test that very word, so it stays plain.
const SENTENCE_PROMPTS: Question["type"][] = ["one_sentence", "who_said"];

function QuestionRow({ number, q, level, hidePrompt, open, pick }: { number: string; q: Question; level: number; hidePrompt: boolean; open: (l: 1 | 2) => void; pick: (option: string) => Promise<void> }) {
  const prompt = q.type === "poet_name" ? "ಕವಿಯ ಹೆಸರು" : q.prompt.replace(" …", "");
  const latin = q.type === "en_to_kn";
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <span className="w-10 shrink-0 font-bold text-gray-500">{number}</span>
        <div className="flex-1">
          {hidePrompt ? (
            <p className="text-2xl text-gray-400">…</p>
          ) : latin ? (
            <p className="text-2xl">{prompt}</p>
          ) : (
            <>
              <p className="kn text-2xl">{SENTENCE_PROMPTS.includes(q.type) ? <KnText text={prompt} /> : prompt}</p>
              {q.type !== "number_name" && <p className="text-sm italic text-gray-500">{transliterate(prompt)}</p>}
            </>
          )}
        </div>
        {level === 0 ? (
          <button onClick={() => open(1)} className="chip h-9 shrink-0 bg-warn-soft px-4 text-warn"><LineIcon name="bulb" size={16} /> Hint</button>
        ) : level === 1 ? (
          <button onClick={() => open(2)} className="chip h-9 shrink-0 border border-warn/40 bg-white px-3 text-warn">Hint 2 · one try</button>
        ) : (
          <span className="chip h-9 shrink-0 bg-gray-100 px-3 text-gray-500">Hint 2 used</span>
        )}
      </div>
      {level >= 1 && <Hint1Box q={q} />}
      {level >= 2 && <Hint2Box q={q} level={level} pick={pick} />}
    </li>
  );
}

function Hint1Box({ q }: { q: Question }) {
  const h = hint1(q);
  return (
    <div className="ml-13 mt-3 rounded-2xl bg-yellow-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-yellow-800">Hint 1 · free</p>
      {h.lines.map((l, i) => <p key={i} className="text-gray-800"><KnText text={l} /></p>)}
      {h.kn && <p className="mt-1 whitespace-pre-line text-xl"><KnText text={h.kn} /></p>}
      {h.knEn && <p className="text-sm italic text-gray-600">{h.knEn}</p>}
    </div>
  );
}

function Hint2Box({ q, level, pick }: { q: Question; level: number; pick: (option: string) => Promise<void> }) {
  const h = hint2(q);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setPicked(null), [q.id]);
  const done = level === HINT2_RIGHT || level === HINT2_WRONG;
  const right = level === HINT2_RIGHT;

  async function choose(o: string) {
    if (done || busy) return;
    setBusy(true);
    setPicked(o);
    await pick(o);
    setBusy(false);
  }

  return (
    <div className="ml-13 mt-2 rounded-2xl bg-peach/70 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-peach-ink">Hint 2 · one try · half marks if right</p>
      <p className="text-gray-800">{done ? "You've used your one try." : "Pick carefully: you get one try. Right gives half marks; wrong gives no marks for this question."}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {h.options.map((o) => {
          const state = !done ? null : o === h.correct ? "right" : o === picked ? "wrong" : "off";
          return (
            <button
              key={o}
              onClick={() => choose(o)}
              disabled={done || busy}
              className={`rounded-xl border-2 bg-white px-3 py-2 text-left disabled:cursor-default ${h.latin ? "" : "kn text-lg"} ${
                state === "right" ? "border-good bg-good-soft" : state === "wrong" ? "border-bad/60 bg-bad-soft" : state === "off" ? "border-transparent opacity-50" : "border-transparent"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
      {done && (
        <p className={`mt-2 text-sm font-bold ${right ? "text-good" : "text-bad"}`}>
          {right ? "✓ Right. Write it on your paper: it will get half marks." : <>✗ Not this one. The answer is <span className={h.latin ? "" : "kn"}>{h.correct}</span>. This question will get 0 marks.</>}
        </p>
      )}
    </div>
  );
}
