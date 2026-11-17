import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveChild, getParent } from "@/lib/server/context";
import { startFree } from "@/lib/server/startFree";
import { SignInCard } from "@/components/signin/SignInCard";
import { LogoMark } from "@/components/shell/Logo";
import { GoogleOneTap } from "@/components/signin/GoogleOneTap";

export const dynamic = "force-dynamic";

const TRUST = [
  ["Reviewed by a Kannada educator", "answer key and word meanings checked", "M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM9 12l2 2 4-4"],
  ["Follows the school syllabus", "chapters, grammar and paper format", "M4 5h16v12H4zM8 21h8M12 17v4"],
  ["Private by design", "only a nickname, never sold or shared", "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4"],
];

const STEPS = [
  ["Read and understand", "Every lesson from the textbook, with the sound and meaning of each Kannada word one tap away."],
  ["Practise and write by hand", "Quick grammar cards, then worksheets and tests on paper, just like the school exam."],
  ["Snap a photo, see the marks", "Answers are marked against the teacher's key, and you see progress by skill."],
];

function StartButton({ className = "" }: { className?: string }) {
  return (
    <form action={startFree}>
      <button className={`min-h-14 rounded-full bg-[var(--brand-yellow)] px-7 text-base font-semibold text-black transition hover:brightness-95 ${className}`}>
        Try free for 48 hours – no sign-up →
      </button>
    </form>
  );
}

// The public home page. Signed-in families (guests included) go straight to their practice.
export default async function Home({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; email?: string; mode?: string; from?: string }> }) {
  const parent = await getParent();
  if (parent) {
    const child = await getActiveChild(parent.id);
    redirect(child ? "/learn" : "/profiles");
  }
  const { sent, error, email, mode: m, from } = await searchParams;
  // Three ways in: try without an account, create one, or sign in. The last two open the same Google / email card.
  const mode = m === "signin" || m === "signup" ? m : sent || error ? "signup" : null;

  return (
    <div className="min-h-screen bg-bg text-ink">
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && <GoogleOneTap clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID} />}
      <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
        <LogoMark size={36} />
        <span className="flex flex-1 items-center gap-2 text-lg font-medium">Kali Kannada <Beta /></span>
        <a href="#how" className="hidden px-3 py-2 text-sm sm:block">How it works</a>
        <a href="#story" className="hidden px-3 py-2 text-sm sm:block">Our story</a>
        <Link href="/?mode=signin#signin" className="btn btn-ghost">Sign in</Link>
      </header>

      <section id="signin" className="bg-black text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-10 px-4 py-14 sm:py-20">
          <div className="flex min-w-0 flex-[999_1_460px] flex-col gap-5">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--brand-yellow)]">Aligned to the ICSE Kannada syllabus · Karnataka schools</p>
            <h1 className="text-4xl leading-tight font-extralight sm:text-5xl">
              Kannada practice for your child, with progress <span className="text-[var(--brand-yellow)]">you can follow.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-gray-300">
              Lessons with every word explained, worksheets in the school format, and handwritten answers marked from a photo. Even if you don&apos;t speak Kannada yourself.
            </p>
            <div className="mt-2">
              {mode ? (
                <div className="max-w-md">
                  <SignInCard mode={mode} sent={sent} error={error} email={email} fromGuest={from === "guest"} />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <StartButton />
                    <Link href="/?mode=signup#signin" className="flex min-h-14 items-center rounded-full border border-white/40 px-6 font-medium text-white hover:bg-white/10">Create a free account</Link>
                  </div>
                  <p className="text-sm text-gray-400">
                    Start in 10 seconds, no email needed · Free during the beta · Already have an account?{" "}
                    <Link href="/?mode=signin#signin" className="font-medium text-white underline">Sign in</Link>
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-[1_1_300px] justify-center">
            <Image src="/brand/kali-logo.webp" alt="Kali – Kannada, with confidence" width={700} height={642} priority className="w-full max-w-sm" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-7">
        <div className="grid gap-3 sm:grid-cols-3">
          {TRUST.map(([title, sub, d]) => (
            <div key={title} className="card flex items-center gap-3 p-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0"><path d={d} /></svg>
              <span className="text-sm leading-snug"><b className="font-semibold">{title}</b><br />{sub}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto flex max-w-6xl scroll-mt-6 flex-col gap-5 px-4 pt-14">
        <h2 className="text-3xl">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <div key={title} className="card flex flex-col gap-2 p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-black font-semibold text-[var(--brand-yellow)]">{i + 1}</span>
              <h3 className="text-lg font-medium">{title}</h3>
              <p className="text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="story" className="mx-auto max-w-6xl scroll-mt-6 px-4 pt-14">
        <div className="card flex flex-wrap items-center gap-8 p-6 sm:p-10">
          <Image src="/brand/hema.webp" alt="Hema, who built Kali Kannada" width={512} height={768} className="h-48 w-32 shrink-0 rounded-2xl sm:h-60 sm:w-40" />
          <div className="flex min-w-0 flex-[999_1_380px] flex-col gap-3">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted">Why I built Kali Kannada</p>
          <p className="text-xl leading-relaxed font-light sm:text-2xl">
            &ldquo;I&apos;m a working mum of two, and I don&apos;t know Kannada well enough to guide my kids myself. I spent hours making worksheets and still
            wondered: <b className="font-medium">am I teaching this right?</b> So I built the tool I needed.&rdquo;
          </p>
          <p className="text-sm">Hema, a parent who built Kali Kannada</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-wrap items-center gap-6 rounded-[24px] bg-black p-8 text-white sm:p-10">
          <div className="min-w-0 flex-[999_1_380px]">
            <h2 className="text-3xl">See it for yourself. <span className="text-[var(--brand-yellow)]">No sign-up.</span></h2>
            <p className="mt-2 text-gray-300">Add your child&apos;s nickname and start practising. Save your progress with your email whenever you like.</p>
          </div>
          <StartButton />
        </div>
        <p className="mt-7 text-center text-sm text-muted">
          <Link href="/privacy" className="underline">Privacy</Link> · <a href="mailto:hemlata.v.29@gmail.com" className="underline">Contact</a> · Kali Kannada · Kannada, with confidence
        </p>
      </section>
    </div>
  );
}

function Beta() {
  return <span className="rounded-full border border-black/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">Beta</span>;
}
