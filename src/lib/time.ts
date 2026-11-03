// After the worksheet's time is up, the timer counts extra time for at most 15 minutes, then stops: a paper uploaded
// later (or never) doesn't show days of "extra time".
export const EXTRA_MINUTES = 15;

// When writing counts as finished: the moment it was finished, but never later than 15 minutes after the time was up.
export function writingEnd(startedAt: string, doneAt: string | null | undefined, minutes: number, now = Date.now()) {
  const cap = new Date(startedAt).getTime() + (minutes + EXTRA_MINUTES) * 60_000;
  return Math.min(doneAt ? new Date(doneAt).getTime() : now, cap);
}

// "Took 47 min (7 min over the 40)", from "I'm ready" to "I've finished writing" (or the first photo).
export function writingTime(startedAt: string, doneAt: string | null | undefined, minutes: number) {
  if (!doneAt) return null;
  const took = Math.max(1, Math.round((writingEnd(startedAt, doneAt, minutes) - new Date(startedAt).getTime()) / 60000));
  const over = took - minutes;
  const text =
    over >= EXTRA_MINUTES ? `Timer stopped ${EXTRA_MINUTES} min after the ${minutes}` : over > 0 ? `Took ${took} min (${over} min over the ${minutes})` : `Took ${took} min of ${minutes}`;
  return { took, over: over > 0, text };
}
