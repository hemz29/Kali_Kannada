import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireParent, supabaseServer, userStore } from "@/lib/server/context";
import { googleEnabled } from "@/lib/server/google";
import { GoogleLogo } from "@/components/GoogleLogo";
import { LogoMark } from "@/components/shell/Logo";
import { GUEST_HOURS, PRIVACY_PROMISE } from "@/lib/guestPass";

export const dynamic = "force-dynamic";

// Turns a guest into a full account. Supabase keeps the same user, so every child and all their progress stay.
async function saveWithEmail(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/save?error=Please+enter+your+email");
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { error } = await (await supabaseServer()).auth.updateUser({ email }, { emailRedirectTo: `${origin}/auth/callback?next=/parent` });
  redirect(error ? `/save?error=${encodeURIComponent(error.message)}` : `/save?sent=${encodeURIComponent(email)}`);
}

async function saveWithGoogle() {
  "use server";
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { data, error } = await (await supabaseServer()).auth.linkIdentity({ provider: "google", options: { redirectTo: `${origin}/auth/callback?next=/parent` } });
  if (error || !data.url) redirect(`/save?error=${encodeURIComponent(error?.message ?? "Google isn't available right now.")}`);
  redirect(data.url);
}

export default async function Save({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const parent = await requireParent();
  if (!parent.isGuest) redirect("/parent");
  const { sent, error } = await searchParams;
  const google = await googleEnabled();
  const names = (await (await userStore()).listChildren(parent.id)).map((c) => c.nickname);
  const who = names.length ? `${names.join(" and ")}'s` : "your";

  return (
    <main className="app-bg grid min-h-screen place-items-center px-4 py-10">
      <div className="card flex w-full max-w-md flex-col gap-4 p-6 sm:p-8">
        <LogoMark size={44} />
        <h1 className="text-2xl">Save your child&apos;s progress</h1>
        <p className="text-muted">
          Guest access lasts {GUEST_HOURS} hours. Register with your email or Google account to keep {who} progress, see the detailed parent reports and exam readiness, and come back on any device. Everything practised so far stays.
        </p>
        <p className="rounded-xl bg-good-soft p-3 text-sm">
          🔒 {PRIVACY_PROMISE} Nothing else, and it&apos;s never shared.
        </p>
        {sent ? (
          <p className="rounded-xl bg-accent-soft p-4">
            We sent a link to <b>{sent}</b>. Open it to finish saving. Until then you can keep practising as before.
          </p>
        ) : (
          <>
            {google && (
              <form action={saveWithGoogle}>
                <button className="btn w-full border border-[#747775] bg-white text-ink"><GoogleLogo /> Continue with Google</button>
              </form>
            )}
            <form action={saveWithEmail} className="flex flex-col gap-3">
              <label htmlFor="email" className="font-bold">Parent email</label>
              <input id="email" name="email" type="email" required autoComplete="email" className="h-12 rounded-xl border border-line bg-white px-4 text-lg" placeholder="you@example.com" />
              <button className="btn btn-primary">Save with email</button>
            </form>
            {error && <p className="text-bad">{error}</p>}
          </>
        )}
        <Link href="/learn" className="text-center text-sm text-muted underline">Not now, keep practising</Link>
      </div>
    </main>
  );
}
