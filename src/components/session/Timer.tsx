"use client";
import { useEffect, useState } from "react";
import type { PracticeSession } from "@/lib/store/types";
import { LineIcon } from "@/components/LineIcon";
import { EXTRA_MINUTES, writingEnd } from "@/lib/time";

const mmss = (ms: number) => {
  const s = Math.floor(Math.abs(ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Counts down from the worksheet's time (started at "I'm ready"). When time is up it says so gently and counts the
// extra time (parents see it in the report) for up to 15 minutes, then stops; the pages can still be sent any time.
export function Timer({ session, minutes }: { session: PracticeSession; minutes: number }) {
  const [now, setNow] = useState(() => Date.now());

  const start = new Date(session.startedAt).getTime();
  const end = writingEnd(session.startedAt, session.writingDoneAt, minutes, now);
  const left = start + minutes * 60_000 - end;
  const over = left < 0;
  const done = Boolean(session.writingDoneAt);
  const stopped = !done && -left >= EXTRA_MINUTES * 60_000;
  // Nothing left to count: stop ticking.
  useEffect(() => {
    if (done || stopped) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [done, stopped]);

  return (
    <div
      role="timer"
      aria-live="off"
      className={`flex items-center gap-3 rounded-2xl px-4 py-2 ${over ? "bg-peach" : "bg-accent-soft"}`}
    >
      <LineIcon name={done ? "check" : over ? "bell" : "clock"} size={30} />
      <span className="text-3xl font-extrabold tabular-nums">{over ? `+${mmss(left)}` : mmss(left)}</span>
      <span className="max-w-48 text-sm leading-tight text-muted">
        {done
          ? over
            ? `Finished writing ${mmss(left)} after the ${minutes} minutes.`
            : "Finished writing in time. Well done!"
          : stopped
            ? "Timer stopped. Upload your pages whenever you're ready."
            : over
            ? "Time's up! Finish calmly – the extra time is noted for your parent."
            : `left of ${minutes} minutes`}
      </span>
    </div>
  );
}
