import { redirect } from "next/navigation";
import { requireParent } from "@/lib/server/context";
import { enterPin } from "@/lib/server/parentLock";
import { LogoMark } from "@/components/shell/Logo";

export const metadata = { title: "Parent PIN · Kali Kannada" };

const safeNext = (next: unknown) => (typeof next === "string" && /^\/(parent|admin)/.test(next) ? next : "/parent");

async function unlock(formData: FormData) {
  "use server";
  const parent = await requireParent();
  const next = safeNext(formData.get("next"));
  if (!(await enterPin(parent.id, String(formData.get("pin") ?? "")))) redirect(`/parent/lock?next=${encodeURIComponent(next)}&wrong=1`);
  redirect(next);
}

// The grown-ups' door: Parent view (marks, exam settings, reports) opens with the parent PIN.
export default async function ParentLock({ searchParams }: { searchParams: Promise<{ next?: string; wrong?: string }> }) {
  const parent = await requireParent();
  const { next, wrong } = await searchParams;
  return (
    <main className="app-bg grid min-h-screen place-items-center px-4 py-10">
      <form action={unlock} className="card flex w-full max-w-sm flex-col gap-4 p-6 text-center sm:p-8">
        <span className="mx-auto"><LogoMark size={44} /></span>
        <h1 className="text-2xl">Parent PIN</h1>
        <p className="text-sm text-muted">
          Parent view is for grown-ups: it&apos;s where marks are checked and the exam is set.
          {parent.email ? <> This account&apos;s parent email is <b className="text-ink">{parent.email}</b>.</> : null}
        </p>
        <input type="hidden" name="next" value={safeNext(next)} />
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          pattern="[0-9]{4}"
          required
          autoFocus
          aria-label="Parent PIN"
          className="mx-auto h-14 w-40 rounded-xl border border-line bg-white text-center text-3xl tracking-[0.5em]"
        />
        {wrong && <p className="text-sm text-bad">That PIN isn&apos;t right. Please try again.</p>}
        <button className="btn btn-primary">Open Parent view</button>
        <p className="text-xs text-muted">You&apos;ll stay in for an hour, long enough to check a whole paper.</p>
        <a href="/learn" className="text-sm text-muted underline">Back to learning</a>
      </form>
    </main>
  );
}
