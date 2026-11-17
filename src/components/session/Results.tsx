"use client";
import Image from "next/image";
import Link from "next/link";
import { getQuestion, getWorksheet, MARKING } from "@/content";
import type { QuestionAttempt } from "@/lib/store/types";
import { writingTime } from "@/lib/time";
import { HandwritingStrip } from "./HandwritingStrip";
import type { SessionState } from "./SessionView";
import { KnText } from "@/components/Word";
import { HINT2_WRONG } from "@/lib/help";
import { LineIcon } from "@/components/LineIcon";

const ICON: Record<string, string> = { correct: "✓", partial: "½", incorrect: "✗", blank: "–", review: "…" };
const TONE: Record<string, string> = { correct: "bg-good-soft text-good", partial: "bg-warn-soft text-warn", incorrect: "bg-bad-soft text-bad", blank: "bg-gray-100 text-gray-500", review: "bg-accent-soft" };
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function Results({ state, worksheetId }: { state: SessionState; worksheetId: string }) {
  const ws = getWorksheet(worksheetId)!;
  const { session, attempts } = state;
  const byQ = new Map(attempts.map((a) => [a.questionId, a]));
  const awarded = session.awarded ?? 0;
  const max = session.max ?? 0;
  const pct = max ? Math.round((awarded / max) * 100) : 0;
  const answered = attempts.filter((a) => a.text.trim());
  const onOwn = answered.filter((a) => (a.helpLevel ?? 0) === 0).length;
  const review = attempts.filter((a) => a.status === "review").length;
  const hint2 = attempts.filter((a) => (a.helpLevel ?? 0) >= 2).length;
  const time = writingTime(session.startedAt, session.writingDoneAt, ws.minutes);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="card overflow-hidden bg-white text-center">
        <div className="relative h-48 sm:h-60">
          <Image src="/art/celebration.webp" alt="" fill sizes="768px" className="object-cover" />
        </div>
        <div className="p-6 pt-4">
        <p className="text-lg font-bold text-muted">{pct >= 80 ? "Brilliant work!" : pct >= 50 ? "Well done!" : "Good effort – keep practising!"}</p>
        <h1 className="mt-1 text-5xl">{fmt(awarded)} / {fmt(max)}</h1>
        <p className="text-lg text-muted">{pct}% · {ws.title.en}</p>
        {ws.oralMarks ? <p className="text-sm text-muted">Written marks · the oral test ({ws.oralMarks} marks) is given in class</p> : null}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="chip bg-accent-soft">Answered without hints: {onOwn} of {answered.length}</span>
          {hint2 > 0 && <span className="chip bg-peach text-peach-ink">Hint 2 used: {hint2} (half marks if picked right, 0 if wrong)</span>}
          {time && <span className={`chip ${time.over ? "bg-peach text-peach-ink" : "bg-good-soft text-good"}`}><LineIcon name="clock" size={16} className="mr-1 inline align-[-3px]" />{time.text}</span>}
          {review > 0 && <span className="chip bg-warn-soft text-warn">{review} answer(s) waiting for a grown-up to check</span>}
        </div>
        <p className="mt-3 text-xs text-muted">{MARKING.label}</p>
        </div>
      </div>

      {ws.sections.map((s, si) => {
        const got = s.questions.reduce((t, q) => t + (byQ.get(q.id)?.awarded ?? 0), 0);
        return (
          <section key={s.type} className="paper p-5">
            <div className="flex items-start justify-between">
              <h2 className="font-bold">{si + 1}. {s.en}</h2>
              <span className="chip bg-gray-100">{fmt(got)} / {fmt(s.marksEach * s.questions.length)}</span>
            </div>
            <ul className="mt-2 divide-y divide-gray-100">
              {s.questions.map((q, qi) => (
                <Row key={q.id} n={`${si + 1}.${qi + 1}`} a={byQ.get(q.id)} qid={q.id} sessionId={session.id} />
              ))}
            </ul>
          </section>
        );
      })}

      <div className="flex flex-wrap justify-center gap-3">
        <Link href={`/learn/worksheet/${ws.id}?retry=${session.retryOf ?? session.id}`} className="btn btn-primary">Try this worksheet again</Link>
        <Link href="/learn" className="btn btn-ghost">Back home</Link>
      </div>
    </div>
  );
}

function Row({ n, a, qid, sessionId }: { n: string; a?: QuestionAttempt; qid: string; sessionId: string }) {
  const q = getQuestion(qid)!;
  const status = a?.status ?? "blank";
  const fb = a?.feedback;
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <span className={`chip mt-1 w-12 justify-center ${TONE[status]}`}>{ICON[status]} {a?.awarded != null ? fmt(a.awarded) : ""}</span>
        <div className="flex-1">
          <p className="text-sm text-gray-500">{n} · <KnText text={q.prompt} /></p>
          <p className="kn text-xl">{a?.text ? <KnText text={a.text} /> : <span className="text-base text-gray-400">(no answer)</span>}</p>
          {fb?.en && status !== "correct" && <p className="mt-1 text-gray-700">{fb.en}</p>}
          {fb?.points && (
            <ul className="mt-1 text-sm">
              {fb.points.map((p) => (
                <li key={p.point} className={p.met ? "text-good" : "text-bad"}>{p.met ? "✓" : "✗"} {p.point}</li>
              ))}
            </ul>
          )}
          {fb?.nearMiss && (
            <div className="mt-2 rounded-xl bg-yellow-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-yellow-800">Your writing vs. correct writing</p>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                <div>
                  <HandwritingStrip sessionId={sessionId} pageId={a?.pageId ?? null} region={a?.region ?? null} />
                  <p className="mt-1 text-lg">You wrote: <KnText text={fb.nearMiss.wrote} /></p>
                </div>
                <p className="self-center text-2xl font-bold text-good">✓ <KnText text={fb.nearMiss.correct} /></p>
              </div>
            </div>
          )}
          {fb?.model && status !== "correct" && (
            <details className="mt-1 text-sm">
              <summary className="cursor-pointer font-bold text-accent">See the model answer</summary>
              <p className="mt-1 text-lg"><KnText text={fb.model.kn} /></p>
              <p className="text-gray-500">{fb.model.en}</p>
            </details>
          )}
        </div>
        {(a?.helpLevel ?? 0) === 1 && <span className="chip bg-warn-soft text-warn">Hint 1</span>}
        {(a?.helpLevel ?? 0) >= 2 && <span className="chip bg-peach text-peach-ink">{a?.helpLevel === HINT2_WRONG ? "Hint 2 · wrong pick · 0" : "Hint 2 · ½ marks"}</span>}
      </div>
    </li>
  );
}

