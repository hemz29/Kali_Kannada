import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getParent, isDemo } from "./context";
import { readToken, signToken, UNLOCK_MINUTES } from "@/lib/parentPin";
import { SUPABASE_SERVICE_KEY } from "@/lib/supabaseEnv";

// Marking answers is behind a PIN, because a child shares the family login. For the first demos the PIN is the same
// for everyone (PARENT_PIN, default 1111); a per-family PIN comes when the app scales. One PIN opens marking for an
// hour, long enough to check a whole paper without being asked again. The rest of Parent view stays open.

const COOKIE = "kk_parent";
const SECRET = SUPABASE_SERVICE_KEY ?? "local-demo-secret";
const PIN = process.env.PARENT_PIN ?? "1111";

export async function isUnlocked(uid: string) {
  return readToken((await cookies()).get(COOKIE)?.value, "unlock", uid, SECRET);
}

// For the answer-marking page and its actions: signed in, and the PIN entered within the last hour.
export async function requireUnlockedParent(next: string) {
  const parent = await getParent();
  if (!parent) redirect("/#signin");
  if (!(await isUnlocked(parent.id))) redirect(`/parent/lock?next=${encodeURIComponent(next)}`);
  return parent;
}

export async function enterPin(uid: string, pin: string) {
  if (pin.trim() !== PIN) return false;
  (await cookies()).set(COOKIE, signToken({ uid, kind: "unlock" }, UNLOCK_MINUTES, SECRET), { httpOnly: true, secure: !isDemo, sameSite: "lax", path: "/", maxAge: UNLOCK_MINUTES * 60 });
  return true;
}

export async function lockNow() {
  (await cookies()).delete(COOKIE);
}
