import Link from "next/link";
import { PAPERS_NEEDED, type Readiness } from "@/lib/readiness";

// What the meter still needs before it can say something useful: the exam date and chapters (set by a parent),
// and some practice. Each step links to where it's done; the list disappears once all three are done.
function setupSteps(r: Readiness) {
  return [
    { done: r.chaptersChosen, text: "Choose the exam chapters", who: "Parent view", href: "/parent#exam" },
    { done: r.exam.date !== null, text: "Set the exam date (for the countdown)", who: "Parent view", href: "/parent#exam" },
    { done: r.papers >= PAPERS_NEEDED, text: `Write ${PAPERS_NEEDED} different practice papers in 2 weeks`, href: "/learn/tests" },
  ];
}

// The short version for the home card: one line, "●●○ 2 of 3 steps done to see your readiness →", going to the next step.
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
      <span className="flex-1">{done} of {steps.length} readiness steps done</span>
      <span aria-hidden>→</span>
    </Link>
  );
}

export function ReadinessSetup({ r, className = "" }: { r: Readiness; className?: string }) {
  const steps = setupSteps(r);
  if (steps.every((s) => s.done)) return null;
  return (
    <div className={`rounded-2xl bg-accent-soft p-3 text-sm ${className}`}>
      <p className="font-bold">To fill this in:</p>
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
      <p className="mt-1.5 text-xs text-muted">The meter shows after the first paper and gets surer with each one.</p>
    </div>
  );
}
