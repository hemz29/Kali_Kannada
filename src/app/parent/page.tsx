import Link from "next/link";
import { markDependsOnCheck } from "@/lib/grading/grade";
import { redirect } from "next/navigation";
import { getWorksheet, LESSONS, MARKING } from "@/content";
import { isDemo, requireParent, userStore } from "@/lib/server/context";
import { saveExamPlan, withExam } from "@/lib/server/examPlan";
import { recommendation, scoreTrend, skillRows } from "@/lib/dashboard";
import { ScoreChart } from "@/components/parent/ScoreChart";
import { DeviceStats } from "@/components/parent/DeviceStats";
import { EXAM_MARKS, readiness } from "@/lib/readiness";
import { ReadinessMeter } from "@/components/readiness/ReadinessMeter";
import { HandwritingNote } from "@/components/readiness/ReadinessInfo";
import { DemoBanner } from "@/components/DemoBanner";
import { AvatarImage } from "@/components/AvatarImage";
import { Logo } from "@/components/shell/Logo";
import { logActivity } from "@/lib/server/activity";
import { isAdmin } from "@/lib/server/admin";
import { writingTime } from "@/lib/time";
import { ActivityPing } from "@/components/ActivityPing";
import { SignOutButton } from "@/components/SignOutButton";
import { DemoMenu } from "@/components/DemoMenu";
import { LineIcon } from "@/components/LineIcon";
import { SaveProgressStrip } from "@/components/SaveProgressStrip";

async function deleteChild(formData: FormData) {
  "use server";
  const parent = await requireParent();
  await (await userStore()).deleteChild(parent.id, String(formData.get("childId")));
  redirect("/parent");
}

async function renameChild(formData: FormData) {
  "use server";
  const parent = await requireParent();
  const id = String(formData.get("childId"));
  const nickname = String(formData.get("nickname") ?? "").trim().slice(0, 40);
  if (nickname) await (await userStore()).updateChild(parent.id, id, { nickname });
  redirect(`/parent?child=${id}`);
}

// The next exam for the readiness meter. The parent confirms the readiness note once, the first time.
async function saveExam(formData: FormData) {
  "use server";
  const parent = await requireParent();
  const store = await userStore();
  const id = String(formData.get("childId"));
  const child = await withExam(parent.id, await store.getChild(parent.id, id));
  if (!child) redirect("/parent");
  const back = (msg: string) => redirect(`/parent?child=${id}&exam=${msg}#exam`);
  const date = String(formData.get("date") ?? "");
  const lessonIds = formData.getAll("lessonIds").map(String).filter((l) => LESSONS.some((x) => x.id === l));
  const mark = String(formData.get("actualMark") ?? "").trim();
  const actualMark = mark === "" ? null : Math.max(0, Math.min(EXAM_MARKS, Number(mark)));
  const acknowledged = Boolean(child.exam?.acknowledged || formData.get("acknowledged"));
  if (!acknowledged) back("ack");
  if (!lessonIds.length) back("chapters");
  try {
    await saveExamPlan(store, parent.id, child, { date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, lessonIds, actualMark: Number.isFinite(actualMark) ? actualMark : null, acknowledged });
  } catch (err) {
    console.warn("exam not saved", err instanceof Error ? err.message : err);
    back("db");
  }
  back("saved");
}

const EXAM_MSG: Record<string, { text: string; good?: boolean }> = {
  saved: { text: "Exam saved. The meter now uses these chapters.", good: true },
  ack: { text: "Please tick that you've read the note about the meter and handwriting." },
  chapters: { text: "Choose at least one chapter." },
  db: { text: "Couldn't save the exam just now. Please try again in a moment." },
};

const STATUS = { not_started: "Not practised yet", in_progress: "Practised before", recent: "Practised this week" };
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default async function ParentDashboard({ searchParams }: { searchParams: Promise<{ child?: string; exam?: string }> }) {
  const parent = await requireParent();
  const store = await userStore();
  const children = await store.listChildren(parent.id);
  if (!children.length) redirect("/profiles");
  const { child: childParam, exam: examMsg } = await searchParams;
  const child = await withExam(parent.id, children.find((c) => c.id === childParam) ?? children[0]);

  const [sessions, attempts] = await Promise.all([store.listSessions(parent.id, child.id), store.listChildAttempts(parent.id, child.id)]);
  const worksheets = sessions.filter((s) => s.kind === "worksheet").sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const graded = worksheets.filter((s) => s.status === "graded");
  const latest = graded[0];
  const week = sessions.filter((s) => Date.now() - Date.parse(s.startedAt) < 7 * 864e5 && s.status === "graded").length;
  const answered = attempts.filter((a) => a.text.trim() || a.method === "key");
  const fullMarks = attempts.filter((a) => a.awarded !== null && a.awarded === a.max).length;
  const written = attempts.filter((a) => a.pageId && a.text.trim());
  const own = written.filter((a) => a.helpLevel === 0).length;
  const review = attempts.filter((a) => a.status === "review");
  const childChecked = attempts.filter((a) => a.sessionId === latest?.id && markDependsOnCheck(a));
  const skills = skillRows(attempts);
  const trend = scoreTrend(sessions, attempts);
  const rec = recommendation(attempts);
  const ready = readiness(attempts, sessions, child.exam);
  const plan = child.exam;
  await logActivity(store, parent.id, { kind: "parent_dashboard", path: "/parent", childId: child.id });

  return (
    <div className="app-bg min-h-screen">
      <ActivityPing />
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      {isDemo && <DemoBanner />}
      {/* The parent page is a natural exit, so guests are reminded here even if they closed the prompt elsewhere. */}
      {parent.isGuest && <SaveProgressStrip name={child.nickname} dismissible={false} />}
      <div className="flex flex-wrap items-center gap-3">
        <span className="mr-auto"><Logo /></span>
        <span className="flex flex-wrap items-center gap-2">
          {children.length > 1 &&
            children.map((c) => (
              <Link key={c.id} href={`/parent?child=${c.id}`} className={`top-btn ${c.id === child.id ? "!border-black !bg-black !text-white" : ""}`}>{c.nickname}</Link>
            ))}
          {isAdmin(parent.email) && <Link href="/admin" className="top-btn">Admin</Link>}
          <SignOutButton isGuest={parent.isGuest} />
        </span>
      </div>
      <header className="flex flex-wrap items-center gap-5 rounded-[var(--radius)] bg-black p-6 text-white sm:p-8">
        <AvatarImage avatar={child.theme} size={72} className="shrink-0 rounded-full bg-white" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand-yellow)]">Parent view</p>
          <h1 className="text-3xl font-extralight sm:text-4xl">{child.nickname}&apos;s progress <span className="text-[var(--brand-yellow)]">you can follow.</span></h1>
          <p className="text-sm text-gray-300">{MARKING.label}</p>
        </div>
      </header>

      {review.length > 0 && (
        <Link href={`/parent/session/${review[0].sessionId}`} className="rounded-2xl bg-warn-soft p-4 font-bold text-warn">
          {review.length} answer{review.length === 1 ? " is" : "s are"} waiting for you to mark → open
        </Link>
      )}

      {childChecked.length > 0 && (
        <Link href={`/parent/session/${latest!.id}#${childChecked[0].id}`} className="rounded-2xl bg-sky p-4 font-bold text-sky-ink">
          {childChecked.length} mark(s) in the latest worksheet depended on {child.nickname}&apos;s own check of the handwriting → compare with the photos
        </Link>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Latest worksheet" value={latest ? `${fmt(latest.awarded ?? 0)}/${fmt(latest.max ?? 0)}` : "–"} note={latest ? `${Math.round(((latest.awarded ?? 0) / (latest.max || 1)) * 100)}% · ${new Date(latest.completedAt!).toLocaleDateString("en-IN")}` : "No worksheet marked yet"} />
        <Stat label="Practice this week" value={String(week)} note="worksheets and card sets finished" />
        <Stat label="Questions answered" value={String(answered.length)} note={`${fullMarks} got full marks`} />
        <Stat label="Written without hints" value={written.length ? `${Math.round((own / written.length) * 100)}%` : "–"} note={written.length ? `${own} of ${written.length} written answers` : "Shows after the first worksheet"} />
      </section>

      <ReadinessMeter r={ready} audience="parent" nickname={child.nickname} />

      <section id="exam" className="card scroll-mt-4 bg-white p-5">
        <h2 className="text-lg font-bold">{child.nickname}&apos;s next exam</h2>
        <p className="text-sm text-muted">The readiness meter measures against this exam: only the chosen chapters count, and the countdown uses the date.</p>
        {examMsg && EXAM_MSG[examMsg] && (
          <p className={`mt-3 rounded-xl p-3 text-sm font-medium ${EXAM_MSG[examMsg].good ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`}>{EXAM_MSG[examMsg].text}</p>
        )}
        <form action={saveExam} className="mt-4 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="childId" value={child.id} />
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-bold">
              Exam date
              <input type="date" name="date" defaultValue={plan?.date ?? ""} className="h-11 rounded-xl border border-line bg-white px-3 font-normal" />
            </label>
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 font-bold">Chapters in the exam</legend>
              {LESSONS.map((l) => (
                <label key={l.id} className="flex items-center gap-2">
                  <input type="checkbox" name="lessonIds" value={l.id} defaultChecked={plan?.lessonIds?.length ? plan.lessonIds.includes(l.id) : true} className="h-4 w-4 accent-black" />
                  {l.title.en}
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1 text-sm font-bold">
              <span>Actual exam mark <span className="font-normal text-muted">(after the exam, optional)</span></span>
              <span className="flex items-center gap-2 font-normal">
                <input type="number" name="actualMark" min={0} max={EXAM_MARKS} step={0.5} defaultValue={plan?.actualMark ?? ""} className="h-11 w-24 rounded-xl border border-line bg-white px-3" /> out of {EXAM_MARKS}
              </span>
              <span className="text-xs font-normal text-muted">Shown next to the meter, so you can see how close the estimate was.</span>
            </label>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-sm">The readiness meter estimates the exam mark from practice in Kali Kannada. It can&apos;t predict the exam exactly.</p>
            <HandwritingNote />
            {!plan?.acknowledged && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="acknowledged" required className="mt-0.5 h-4 w-4 accent-black" />
                I&apos;ve read this and understand the meter is a guide, not a prediction of the exam mark.
              </label>
            )}
            <button className="btn btn-primary self-start">Save exam</button>
          </div>
        </form>
      </section>

      <DeviceStats childId={child.id} nickname={child.nickname} lessonTitles={Object.fromEntries(LESSONS.map((l) => [l.id, l.title.en]))} />

      <section className="card bg-white p-5">
        <h2 className="text-lg font-bold">Recommended next practice</h2>
        {rec ? <p className="mt-1">{rec.text}</p> : <p className="mt-1 text-muted">Not enough answers yet to make a fair suggestion. After a few worksheets, this will point to the area that needs most practice.</p>}
      </section>

      <section className="card bg-white p-5">
        <h2 className="text-lg font-bold">Skills</h2>
        <p className="text-sm text-muted">Each percentage only counts questions that test that skill. “Not practised yet” is not a low score.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-sm text-muted">
              <tr><th className="py-2">Skill</th><th>Status</th><th>Questions</th><th>Marks</th><th className="w-1/3">Score</th></tr>
            </thead>
            <tbody>
              {skills.map((s) => (
                <tr key={s.skill} className="border-t border-line">
                  <td className="py-3 font-bold">{s.label}</td>
                  <td className="text-sm">{STATUS[s.status]}</td>
                  <td>{s.attempted || "–"}</td>
                  <td>{s.available ? `${fmt(s.earned)} of ${fmt(s.available)}` : "–"}</td>
                  <td>
                    {s.pct === null ? <span className="text-sm text-muted">Not practised yet</span> : (
                      <div className="flex items-center gap-2">
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-accent-soft"><div className="h-full rounded-full bg-accent" style={{ width: `${s.pct}%` }} /></div>
                        <span className="w-10 text-right font-bold">{s.pct}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card bg-white p-5">
        <h2 className="text-lg font-bold">Score over time</h2>
        <p className="text-sm text-muted">First try of each worksheet, as a percentage (worksheets have different totals). Indicative only: worksheets cover different chapters, and scores here don&apos;t predict school exam marks.</p>
        {trend.length >= 2 ? <ScoreChart points={trend} /> : <p className="mt-4 rounded-xl bg-accent-soft p-4 text-sm">Not enough worksheets yet to show a trend – {trend.length === 1 ? "one more" : "two"} to go.</p>}
      </section>

      <section className="card bg-white p-5">
        <h2 className="text-lg font-bold">History</h2>
        {worksheets.length === 0 ? <p className="mt-2 text-muted">No worksheets yet.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted"><tr><th className="py-2">Date</th><th>Worksheet</th><th>Try</th><th>Score</th><th>Time</th><th>Hints</th><th /></tr></thead>
              <tbody>
                {worksheets.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="py-3">{new Date(s.startedAt).toLocaleDateString("en-IN")}</td>
                    <td>{getWorksheet(s.worksheetId)?.title.en}</td>
                    <td>{s.retryOf ? "Retry" : "First try"}</td>
                    <td>{s.status === "graded" ? `${fmt(s.awarded ?? 0)}/${fmt(s.max ?? 0)}` : <span className="text-muted">Not finished</span>}</td>
                    <td>{writingTime(s.startedAt, s.writingDoneAt, getWorksheet(s.worksheetId)?.minutes ?? 60)?.text ?? "–"}</td>
                    <td>{hintText(s.help)}</td>
                    <td>{s.status === "graded" && <Link href={`/parent/session/${s.id}`} className="font-bold text-accent">Review answers →</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Link href="/feedback" className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5">
        <span className="flex-1"><b className="font-semibold">How is Kali Kannada working for you?</b> <span className="text-muted">Give feedback in 30 seconds.</span></span>
        <span aria-hidden>→</span>
      </Link>

      <section className="card bg-white p-5 text-sm text-muted">
        <h2 className="text-base font-bold text-ink">Your data</h2>
        <p className="mt-1">We store {child.nickname}&apos;s nickname, answers, marks and the answer photos (so you can check the marking). Photos are only visible to you. AI is used to read handwriting and mark sentence answers; we log how much it costs, not what was written.</p>
        <form action={renameChild} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="childId" value={child.id} />
          <label htmlFor="nickname" className="font-bold text-ink">Nickname</label>
          <input id="nickname" name="nickname" defaultValue={child.nickname} required maxLength={40} className="h-10 rounded-xl border border-line bg-white px-3 text-ink" />
          <button className="btn btn-ghost h-10 min-h-0">Rename</button>
        </form>
        <form action={deleteChild} className="mt-3">
          <input type="hidden" name="childId" value={child.id} />
          <button className="font-bold text-bad underline">Delete {child.nickname}&apos;s profile and all their data</button>
        </form>
      </section>
    </main>
      <DemoMenu back="/parent" />
      <Link href="/feedback" aria-label="Give feedback" title="Give feedback" className="fixed right-5 bottom-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-black text-[var(--brand-yellow)] shadow-lg transition hover:scale-105">
        <LineIcon name="chat" size={26} />
      </Link>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card bg-white p-5">
      <p className="text-sm font-bold text-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold">{value}</p>
      <p className="text-sm text-muted">{note}</p>
    </div>
  );
}

// "2 × Hint 1, 1 × Hint 2" for the history table.
function hintText(help: Record<string, number>) {
  const levels = Object.values(help);
  const h1 = levels.filter((l) => l === 1).length;
  const h2 = levels.filter((l) => l >= 2).length;
  return [h1 && `${h1} × Hint 1`, h2 && `${h2} × Hint 2`].filter(Boolean).join(", ") || "None";
}
