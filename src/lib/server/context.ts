import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { localStore } from "@/lib/store/local";
import { supabaseStore } from "@/lib/store/supabase";
import type { Child, Store } from "@/lib/store/types";
import { SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL } from "@/lib/supabaseEnv";

const URL = SUPABASE_URL;
const ANON = SUPABASE_ANON_KEY;
const SERVICE = SUPABASE_SERVICE_KEY;

// Without Supabase settings the app runs in demo mode: one built-in parent, data in a local file.
export const isDemo = !URL || !ANON;

// Demo mode can't work on Vercel (no writable disk), so say exactly what's missing instead of failing later.
function checkSetup() {
  if (!process.env.VERCEL) return;
  const missing = [
    !URL && "NEXT_PUBLIC_SUPABASE_URL",
    !ANON && "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    !SERVICE && "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)",
  ].filter(Boolean);
  if (missing.length)
    throw new Error(`Supabase isn't set up on Vercel. Missing environment variable(s): ${missing.join(", ")}. Add them in Vercel → Settings → Environment Variables, then redeploy.`);
}

const DEMO_PARENT = { id: "00000000-0000-4000-8000-000000000001", email: "demo@studybuddy.local", isGuest: false };

export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(URL!, ANON!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Called from a Server Component: the middleware refreshes the session instead.
        }
      },
    },
  });
}

// A guest started with "Start free": a real but anonymous Supabase user, until they add an email or Google.
// Speed: getClaims() checks the sign-in token on this server (no round trip to Supabase when the project uses signing
// keys), and cache() means a page, its layout and its helpers share one check per request.
export const getParent = cache(async (): Promise<{ id: string; email: string; isGuest: boolean } | null> => {
  checkSetup();
  if (isDemo) return DEMO_PARENT;
  const { data } = await (await supabaseServer()).auth.getClaims();
  const c = data?.claims;
  return c?.sub ? { id: c.sub, email: (c.email as string | undefined) ?? "", isGuest: Boolean(c.is_anonymous) } : null;
});

export async function requireParent() {
  const parent = await getParent();
  if (!parent) redirect("/#signin");
  return parent;
}

// Store acting as the signed-in parent (RLS applies).
export async function userStore(): Promise<Store> {
  return isDemo ? localStore : supabaseStore(await supabaseServer());
}

// Supabase with the service key: reads every family's rows. Only for the phone token routes and the admin page.
export function serviceClient() {
  checkSetup();
  return isDemo ? null : createClient(URL!, SERVICE!, { auth: { persistSession: false } });
}

// Store for the phone upload page, which is authorised by a single-use token instead of a login.
export function serviceStore(): Store {
  checkSetup();
  if (isDemo) return localStore;
  return supabaseStore(createClient(URL!, SERVICE!, { auth: { persistSession: false } }));
}

const CHILD_COOKIE = "sb_child";

// Cached per request, so the learn layout and the page share one lookup.
export const getActiveChild = cache(async (parentId: string): Promise<Child | null> => {
  const id = (await cookies()).get(CHILD_COOKIE)?.value;
  if (!id) return null;
  const { withExam } = await import("./examPlan"); // imported lazily: examPlan itself uses this file
  return withExam(parentId, await (await userStore()).getChild(parentId, id));
});

export async function requireChild() {
  const parent = await requireParent();
  const child = await getActiveChild(parent.id);
  if (!child) redirect("/profiles");
  return { parent, child };
}

export async function setActiveChild(childId: string) {
  (await cookies()).set(CHILD_COOKIE, childId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
}
