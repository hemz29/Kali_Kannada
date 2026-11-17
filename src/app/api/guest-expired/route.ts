import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getParent, isDemo, serviceClient, serviceStore, supabaseServer } from "@/lib/server/context";
import { GUEST_SINCE_COOKIE, guestExpired } from "@/lib/guestPass";

// A guest whose 48-hour pass has run out (sent here by the middleware): their unsaved practice is deleted (children,
// answers, photos, then the guest account itself), they're signed out, and /trial-ended explains what happened.
export async function GET(req: Request) {
  const jar = await cookies();
  const parent = await getParent();
  if (!isDemo && parent?.isGuest && guestExpired(jar.get(GUEST_SINCE_COOKIE)?.value)) {
    try {
      const store = serviceStore();
      for (const c of await store.listChildren(parent.id)) await store.deleteChild(parent.id, c.id); // also removes photos
      await serviceClient()?.auth.admin.deleteUser(parent.id);
    } catch (err) {
      console.warn("expired guest not fully deleted", err instanceof Error ? err.message : err);
    }
    await (await supabaseServer()).auth.signOut();
  }
  jar.delete(GUEST_SINCE_COOKIE);
  jar.delete("sb_child");
  return NextResponse.redirect(new URL("/trial-ended", req.url));
}
