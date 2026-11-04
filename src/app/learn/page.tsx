import { cache, Suspense } from "react";
import Link from "next/link";
import { getWorksheet } from "@/content";
import { requireChild, userStore } from "@/lib/server/context";
import type { ExamPlan, PracticeSession } from "@/lib/store/types";
import { AvatarImage } from "@/components/AvatarImage";
import { ChoiceCard } from "@/components/shell/PageHeader";
import { KnText } from "@/components/Word";
import { LineIcon } from "@/components/LineIcon";
import { EXAM_MARKS, levelLabel, readiness } from "@/lib/readiness";
import { LEVEL_COLORS, ReadinessDial } from "@/components/readiness/ReadinessDial";
import { countdown } from "@/components/readiness/ReadinessMeter";
import { ReadinessNext, ReadinessSetupLine } from "@/components/readiness/ReadinessSetup";

export default async function LearnHome() {
  const { parent, child } = await requireChild();
  const store = await userStore();
  const sessions = await store.listSessions(parent.id, child.id);
  const open = sessions
    .filter((s) => s.kind === "worksheet" && s.status !== "graded" && !getWorksheet(s.worksheetId)?.retired)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const graded = sessions
    .filter((s) => s.kind === "worksheet" && s.status === "graded")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const done = graded.length;
  const latestPct = graded[0]?.max ? Math.round(((graded[0].awarded ?? 0) / graded[0].max) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Black and yellow, like the home page's hero. */}
      <section className="flex items-center gap-4 rounded-[var(--radius)] bg-black px-5 py-4 text-white">
        <AvatarImage avatar={child.theme} size={48} className="shrink-0 rounded-full bg-white" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl leading-tight font-extralight">Hello, <span className="text-[var(--brand-yellow)]">{child.nickname}</span></h1>
          <p className="truncate text-sm text-gray-300">
            {open[0] ? `Continue: ${getWorksheet(open[0].worksheetId)?.title.en}` : done ? `${done} worksheet${done === 1 ? "" : "s"} finished. Keep going!` : "Small steps, big progress."}
          </p>
        </div>
        {open[0] ? (
          <Link href={`/learn/session/${open[0].id}`} className="flex min-h-12 shrink-0 items-center rounded-full bg-[var(--brand-yellow)] px-5 font-semibold text-black">Continue →</Link>
        ) : (
          <span className="hidden rounded-full bg-[var(--brand-yellow)] px-3 py-1 text-sm text-black sm:block"><KnText text="ಕಲಿಯೋಣ!" /></span>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[3fr_1fr]">
        <div className="flex flex-col gap-4">
          <Group title="Learn" cols={4}>
            <ChoiceCard href="/learn/lessons" tone="sage" icon={<LineIcon name="book" size={20} />} title="Read & Understand" sub="Stories and poems, every word explained" />
            <ChoiceCard href="/learn/grammar" tone="peach" icon={<LineIcon name="pen" size={20} />} title="Grammar" sub="Opposites, plurals, gender, meanings" />
            <ChoiceCard href="/learn/letters" tone="lavender" icon={<span className="kn text-lg" aria-hidden>ಅ</span>} title="Alphabets" sub="Letters, vowel signs, double letters" />
            <ChoiceCard href="/learn/numbers" tone="sky" icon={<span className="kn text-lg" aria-hidden>೧</span>} title="Numbers" sub="Numerals and number names" />
          </Group>
          <Group title="Practise">
            <ChoiceCard href="/learn/writing" tone="lavender" icon={<LineIcon name="page" size={20} />} title="Writing practice" sub="One chapter · 25 marks · 40 min" />
            <ChoiceCard href="/learn/tests" tone="sky" icon={<LineIcon name="star" size={20} />} title="Practice tests" sub="School paper · 40 marks · 1 hour" />
            <ChoiceCard tone="peach" icon={<LineIcon name="sound" size={20} />} title="Practise speaking" sub="Say words and sentences aloud" />
          </Group>
        </div>
        <Group title="My progress" single>
          {/* Built like a ChoiceCard, but with the setup steps as their own links below the main one. */}
          <div className="card flex flex-col gap-3 p-4 sm:p-5">
            <Link href="/learn/scores" className="group flex flex-col gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f2f2f2] text-xl text-black"><LineIcon name="trophy" size={20} /></span>
              <span className="serif text-lg font-semibold text-ink">Exam readiness</span>
              {countdown(readiness([], [], child.exam)) ? (
                <span className="self-start rounded-full bg-black px-3 py-1 text-sm font-medium text-[var(--brand-yellow)]">{countdown(readiness([], [], child.exam))}</span>
              ) : (
                <span className="text-sm text-muted">How ready you are, and your scores</span>
              )}
              {/* The rest of the page doesn't wait for the answers the meter needs: the dial fills in when they arrive. */}
              <Suspense fallback={<TileDial />}>
                <ReadinessTile parentId={parent.id} childId={child.id} sessions={sessions} exam={child.exam} />
              </Suspense>
            </Link>
            <Suspense fallback={null}>
              <ReadinessTileSetup parentId={parent.id} childId={child.id} sessions={sessions} exam={child.exam} />
            </Suspense>
            <Link href="/learn/scores" className="group mt-auto flex items-center justify-between gap-2 border-t border-black/10 pt-3 text-xs text-muted hover:text-black">
              <span>{done} worksheet{done === 1 ? "" : "s"} finished{latestPct === null ? "" : ` · latest ${latestPct}%`}</span>
              <span aria-label="Open My scores" className="text-lg font-bold text-black transition group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </Group>
      </div>
    </div>
  );
}

// One answers query per page, shared by the dial and the setup steps.
const attemptScores = cache(async (parentId: string, childId: string) => (await userStore()).listAttemptScores(parentId, childId));
type TileProps = { parentId: string; childId: string; sessions: PracticeSession[]; exam?: ExamPlan | null };

async function ReadinessTileSetup({ parentId, childId, sessions, exam }: TileProps) {
  const r = readiness(await attemptScores(parentId, childId), sessions, exam);
  return r.enoughEvidence ? <ReadinessNext r={r} /> : <ReadinessSetupLine r={r} />;
}

async function ReadinessTile({ parentId, childId, sessions, exam }: TileProps) {
  const attempts = await attemptScores(parentId, childId);
  const ready = readiness(attempts, sessions, exam);
  return (
    <span className="my-2 flex flex-col items-center gap-1">
      <ReadinessDial pct={ready.pct} level={ready.level} active={ready.enoughEvidence} size="sm" />
      <span className="text-sm font-bold" style={ready.enoughEvidence ? { color: LEVEL_COLORS[ready.level].text } : undefined}>{ready.enoughEvidence ? levelLabel(ready.level) : ready.missing === "chapters" ? "Exam chapters needed" : "No recent practice paper"}</span>
      {ready.enoughEvidence && <span className="rounded-full bg-[#f2f2f2] px-2.5 py-0.5 text-xs text-ink">Likely {ready.low}–{ready.high} out of {EXAM_MARKS}</span>}
    </span>
  );
}

// Same size as the filled tile, so nothing jumps when the dial arrives.
function TileDial() {
  return (
    <span className="my-2 flex flex-col items-center gap-1" aria-busy>
      <ReadinessDial pct={0} active={false} size="sm" />
      <span className="text-sm text-muted">Working out…</span>
      <span className="text-xs">&nbsp;</span>
    </span>
  );
}

function Group({ title, single, cols = 3, children }: { title: string; single?: boolean; cols?: 3 | 4; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
      <div className={single ? "grid flex-1" : `grid grid-cols-2 gap-3 ${cols === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>{children}</div>
    </section>
  );
}
