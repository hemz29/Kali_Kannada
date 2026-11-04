import Link from "next/link";
import { getLesson } from "@/content";
import { EXAM_MARKS, levelLabel, type LevelId, type Readiness } from "@/lib/readiness";
import { LEVEL_COLORS, ReadinessDial } from "./ReadinessDial";
import { ReadinessInfo } from "./ReadinessInfo";
import { ReadinessNext, ReadinessSetup } from "./ReadinessSetup";

const CHEER: Record<LevelId, string> = {
  starting: "Every bit of practice helps. Keep going!",
  getting: "You're getting there!",
  nearly: "You're nearly ready!",
  ready: "You're exam ready! Keep practising so it stays fresh.",
};

export function countdown(r: Readiness) {
  if (r.daysToGo === null) return null;
  if (r.daysToGo > 1) return `Exam in ${r.daysToGo} days`;
  if (r.daysToGo === 1) return "Exam tomorrow";
  if (r.daysToGo === 0) return "Exam today. Good luck!";
  return `Exam was on ${new Date(`${r.exam.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

// The full meter, for My scores (the child) and Parent view (the parent).
export function ReadinessMeter({ r, audience, nickname }: { r: Readiness; audience: "child" | "parent"; nickname: string }) {
  const child = audience === "child";
  const chapters = r.exam.lessonIds.map((id) => getLesson(id)?.title.en).filter(Boolean).join(", ");
  const when = countdown(r);
  return (
    <section className="card bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-bold">Exam readiness</h2>
        {when && <span className="rounded-full bg-black px-3 py-1 text-sm font-medium text-[var(--brand-yellow)]">{when}</span>}
      </div>
      <p className="text-sm text-muted">{chapters || "Exam chapters not chosen yet"}{child || !chapters ? "" : r.exam.date ? "" : " · no exam date set yet"}</p>

      <div className="mt-4 grid items-center gap-6 md:grid-cols-[18rem_1fr]">
        <div className="flex flex-col items-center">
          <ReadinessDial pct={r.pct} level={r.level} active={r.enoughEvidence} />
          <p className="-mt-1 text-lg font-bold" style={r.enoughEvidence ? { color: LEVEL_COLORS[r.level].text } : undefined}>{r.enoughEvidence ? levelLabel(r.level) : r.missing === "chapters" ? "Exam chapters needed" : "No recent practice paper"}</p>
          {r.enoughEvidence && <p className="text-sm text-muted">Likely {r.low}–{r.high} out of {EXAM_MARKS}</p>}
          <ReadinessNext r={r} className="mt-1 text-center" />
        </div>

        <div className="flex flex-col gap-3">
          {!r.enoughEvidence ? (
            child ? (
              <ReadinessSetup r={r} />
            ) : (
              <p className="rounded-2xl bg-accent-soft p-4">
                {r.missing === "chapters" ? (
                  <>Choose the chapters in {nickname}&apos;s exam below to see readiness.</>
                ) : (
                  <>
                    Readiness shows once {nickname} writes a practice paper on these chapters (it counts papers from the last 2 weeks).{" "}
                    <Link href="/learn/tests" className="font-bold underline">Practice tests →</Link>
                  </>
                )}
              </p>
            )
          ) : (
            <>
              <p className="text-base">{child ? CHEER[r.level] : `${nickname} is likely to score about ${Math.round(r.predicted)} out of ${EXAM_MARKS} today.`}</p>
              {/* The five checks a parent would make at home, each a tick or a gap. */}
              <ul className="flex flex-col gap-1 text-sm">
                {r.ticks.map((t) => (
                  <li key={t.id} className="flex items-baseline gap-2">
                    <span aria-hidden className={`grid h-5 w-5 shrink-0 translate-y-0.5 place-items-center rounded-full text-[11px] ${t.done ? "bg-black text-[var(--brand-yellow)]" : t.muted ? "border border-dashed border-black/25 text-muted" : "border border-black/40"}`}>{t.done ? "✓" : t.muted ? "–" : ""}</span>
                    <span className={`flex-1 ${t.muted ? "text-muted" : ""}`}>
                      {t.label} <span className="text-muted">· {t.detail}</span>
                    </span>
                    <span className="sr-only">{t.done ? "done" : "not yet"}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {r.enoughEvidence && r.gains.length > 0 && (
            <div>
              <h3 className="text-sm font-bold">{child ? "Practise these to win the most marks" : "Where the most marks are to win"}</h3>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {r.gains.map((g) => (
                  <li key={g.type}>
                    <Link href={g.href} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 hover:bg-accent-soft">
                      <span>{g.label}</span>
                      <span className="shrink-0 font-bold">up to +{g.marks} →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!child && (
            <p className="text-xs text-muted">
              Based on {r.papers} different paper{r.papers === 1 ? "" : "s"} written in the last 2 weeks (the latest try of each)
              {r.exam.actualMark != null ? ` · actual exam mark ${r.exam.actualMark}/${EXAM_MARKS}` : ""}
            </p>
          )}
          {child && <p className="text-sm text-muted">Write clearly so your teacher can read every answer ✍️</p>}
          <ReadinessInfo className="self-start" />
        </div>
      </div>
    </section>
  );
}
