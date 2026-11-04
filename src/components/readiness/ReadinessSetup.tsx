import Link from "next/link";
import { PAPERS_NEEDED, type Readiness } from "@/lib/readiness";

// The two steps before the meter shows: a parent chooses the exam chapters, then the child writes one practice paper.
// The exam date is optional (it only adds the countdown), so it isn't a step.
function setupSteps(r: Readiness) {
  return [
    { done: r.chaptersChosen, text: "Choose the exam chapters", who: "Parent view", href: "/parent#exam" },
    { done: r.chaptersChosen && r.papers >= 1, text: "Write 1 practice paper", href: "/learn/tests" },
  ];
}

// Under the dial once it shows: how to raise readiness, and the exam date (or a nudge to add it).
export function ReadinessNext({ r, className = "" }: { r: Readiness; className?: string }) {
  if (!r.enoughEvidence) return null;
  const left = Math.max(0, PAPERS_NEEDED - r.papers);
  return (
    <p className={`text-xs text-muted ${className}`}>
      {left ? <>To raise readiness: <b>{left} more different paper{left === 1 ? "" : "s"}</b> in 2 weeks</> : <>All papers done, keep practising</>}
      {r.daysToGo !== null && r.daysToGo >= 0 ? <> · exam in {r.daysToGo} day{r.daysToGo === 1 ? "" : "s"}</> : null}
      {r.exam.date === null && <> · <Link href="/parent#exam" className="underline">Add the exam date to see days left →</Link></>}
    </p>
  );
}

// The short version for the home card: one line, "●○ 1 of 2 steps to see readiness →", going to the next step.
export function ReadinessSetupLine({ r }: { r: Readiness }) {
  const steps = setupSteps(r);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (!next) return null;
  return (
    <Link href={next.href} title={`Next: ${next.text}${next.who ? ` (${next.who})` : ""}`} className="flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-xs hover:bg-[var(--brand-yellow)]">
      <span aria-hidden className="flex gap-0.5">
        {steps.map((s) => <span key={s.text} className={`h-2 w-2 rounded-full ${s.done ? "bg-black" : "border border-black/40"}`} />)}
      </span>
      <span className="flex-1">{done} of {steps.length} steps to see readiness</span>
      <span aria-hidden>→</span>
    </Link>
  );
}

export function ReadinessSetup({ r, className = "" }: { r: Readiness; className?: string }) {
  const steps = setupSteps(r);
  if (steps.every((s) => s.done)) return null;
  return (
    <div className={`rounded-2xl bg-accent-soft p-3 text-sm ${className}`}>
      <p className="font-bold">To see readiness:</p>
      <ol className="mt-1.5 flex flex-col gap-1">
        {steps.map((s) => (
          <li key={s.text}>
            <Link href={s.href} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/70">
              <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${s.done ? "bg-black text-[var(--brand-yellow)]" : "border border-black/40"}`}>
                {s.done ? "✓" : ""}
              </span>
              <span className={`flex-1 ${s.done ? "text-muted line-through" : ""}`}>
                {s.text}
                {s.who && !s.done && <span className="text-muted"> ({s.who})</span>}
              </span>
              {!s.done && <span aria-hidden>→</span>}
              <span className="sr-only">{s.done ? "done" : "not done yet"}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-1.5 text-xs text-muted">The meter shows after the first paper and gets surer with each one. The exam date is optional: it adds a countdown.</p>
    </div>
  );
}
