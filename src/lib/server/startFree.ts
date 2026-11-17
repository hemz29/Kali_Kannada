"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GUEST_SINCE_COOKIE } from "@/lib/guestPass";
import { isDemo, supabaseServer } from "./context";

// "Start free": a guest account with no email, so a family can use everything straight away. Adding an email or
// Google later (on /save) keeps the same account and all its progress.
export async function startFree() {
  if (isDemo) redirect("/profiles");
  const { error } = await (await supabaseServer()).auth.signInAnonymously();
  if (error) {
    // Supabase's own reason (e.g. "Anonymous sign-ins are disabled") is kept, so the owner can see what to fix.
    console.error("start free failed", error.message);
    redirect(`/?mode=signup&error=${encodeURIComponent(`Starting without an account isn't available right now (${error.message}). Please sign in with Google or your email instead.`)}#signin`);
  }
  // A new guest gets a fresh 48-hour pass.
  (await cookies()).set(GUEST_SINCE_COOKIE, new Date().toISOString(), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect("/profiles");
}
