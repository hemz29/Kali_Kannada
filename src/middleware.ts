import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseEnv";
import { GUEST_SINCE_COOKIE, guestExpired } from "@/lib/guestPass";

// Keeps the Supabase login session fresh. Does nothing in demo mode.
export async function middleware(request: NextRequest) {
  const url = SUPABASE_URL;
  const anon = SUPABASE_ANON_KEY;
  // A sign-in code that lands on any other page (Supabase falls back to the site address when the callback
  // isn't in its allowed list) is passed on to the callback, which finishes signing in.
  const code = request.nextUrl.searchParams.get("code");
  if (code && request.nextUrl.pathname !== "/auth/callback" && !request.nextUrl.pathname.startsWith("/api/")) {
    const to = new URL("/auth/callback", request.url);
    to.searchParams.set("code", code);
    return NextResponse.redirect(to);
  }
  let response = NextResponse.next({ request });
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Refreshes the sign-in when needed; getClaims() verifies the token locally where it can, which is faster than getUser().
  const { data } = await supabase.auth.getClaims();

  // The 48-hour guest pass: the clock starts the first time a guest is seen in this browser; once it has run out,
  // the guest goes to the route that clears their unsaved data, signs them out and shows /trial-ended.
  const path = request.nextUrl.pathname;
  if (data?.claims?.is_anonymous) {
    const since = request.cookies.get(GUEST_SINCE_COOKIE)?.value;
    if (!since) response.cookies.set(GUEST_SINCE_COOKIE, new Date().toISOString(), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    else if (guestExpired(since) && path !== "/api/guest-expired" && path !== "/trial-ended" && !path.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/api/guest-expired", request.url));
    }
  }
  return response;
}

export const config = {
  // Public files (images, icons, audio, the word list) never need a sign-in, so they skip this and come straight from the CDN.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|worksheets/|snap/|api/snap/|art/|brand/|icons/|audio/|.*\\.(?:png|webp|jpg|jpeg|svg|ico|mp3|json|txt)$).*)"],
};
