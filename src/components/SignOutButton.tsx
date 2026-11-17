import Link from "next/link";
import { cookies } from "next/headers";
import { guestSignIn, signOut } from "@/lib/server/signOut";
import { LineIcon } from "@/components/LineIcon";
import { GUEST_HOURS, GUEST_SINCE_COOKIE, guestHoursLeft, timeLeftText } from "@/lib/guestPass";

// Signed-up parents get Sign out. Guests get a quiet "Guest" pill whose soft fill shows how much of the 48-hour pass is
// left (tap to save), and a plain Sign in for anyone who already has an account.
export async function SignOutButton({ isGuest }: { isGuest: boolean }) {
  if (isGuest) {
    const left = guestHoursLeft((await cookies()).get(GUEST_SINCE_COOKIE)?.value);
    const hint = `Guest · ${timeLeftText(left)} left. Tap to register and keep your progress.`;
    return (
      <>
        <Link href="/save" title={hint} aria-label={hint} className="top-btn">
          <span aria-hidden className={`guest-fill ${left <= 12 ? "low" : ""}`} style={{ "--fill": `${Math.round((left / GUEST_HOURS) * 100)}%` } as React.CSSProperties} />
          <span className="relative flex items-center gap-1.5"><LineIcon name="lock" size={16} />Guest</span>
        </Link>
        <form action={guestSignIn}>
          <button className="top-btn">Sign in</button>
        </form>
      </>
    );
  }
  return (
    <form action={signOut}>
      <button className="top-btn"><LineIcon name="swap" size={16} />Sign out</button>
    </form>
  );
}
