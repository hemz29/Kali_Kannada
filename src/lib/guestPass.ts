// The 48-hour guest pass. A guest ("Start free") can use everything for 48 hours; the middleware notes when it first
// sees a guest in this browser. After that, parents register (email or Google) to keep going.
export const GUEST_HOURS = 48;
export const GUEST_SINCE_COOKIE = "kk_guest_since";
const HOUR = 36e5;

// What we keep about a registered family, said the same way everywhere we ask parents to register.
export const PRIVACY_PROMISE = "We only collect your email ID and the learning activity done on Kali Kannada.";

export function guestHoursLeft(since: string | undefined, now = Date.now()) {
  const start = since ? Date.parse(since) : NaN;
  if (Number.isNaN(start)) return GUEST_HOURS;
  return Math.max(0, Math.ceil((start + GUEST_HOURS * HOUR - now) / HOUR));
}

export const timeLeftText = (hours: number) => (hours > 24 ? `${Math.ceil(hours / 24)} days` : `${hours} hour${hours === 1 ? "" : "s"}`);

export function guestExpired(since: string | undefined, now = Date.now()) {
  const start = since ? Date.parse(since) : NaN;
  return !Number.isNaN(start) && now >= start + GUEST_HOURS * HOUR;
}
