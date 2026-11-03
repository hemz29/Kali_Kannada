import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson, getWorksheet } from "@/content";
import { SKILLS, type Skill } from "@/content/schema";
import { requireParent } from "@/lib/server/context";
import { isAdmin, loadAdminData, type Family } from "@/lib/server/admin";
import { writingTime } from "@/lib/time";
import { Logo } from "@/components/shell/Logo";
import { DemoMenu } from "@/components/DemoMenu";
import { activityMix, busyTimes, childSummaries, devices, funnel, median, repeatParents, visits, weekly } from "@/lib/adminStats";
import { Bars, GrowthChart } from "@/components/admin/AdminCharts";
import { loadFeedback } from "@/lib/server/feedback";
import { INTENT, REPLACE, countBy, nps, npsBreakdown } from "@/lib/feedback";
import { costSummary, inr, USD_TO_INR, usd } from "@/lib/aiCost";

// "💻 75% · 📱 20% · tablet 5% (40 visits)" from the device noted on each visit.
function deviceSplit(acts: { device: string | null }[]) {
  const known = acts.filter((a) => a.device);
  if (!known.length) return "–";
  const pct = (d: string) => Math.round((known.filter((a) => a.device === d).length / known.length) * 100);
  const parts = [["computer", "Computer"], ["phone", "Phone"], ["tablet", "Tablet"]].filter(([d]) => pct(d) > 0).map(([d, label]) => `${label} ${pct(d)}%`);
  return `${parts.join(" · ")} (${known.length} visit${known.length > 1 ? "s" : ""})`;
}
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "–");

// The owner's view of the pilot: who joined, who practised, how long sessions took, what parents looked at.
type Query = { view?: string; kids?: string; families?: string; sessions?: string };

export default async function Admin({ searchParams }: { searchParams: Promise<Query> }) {
  const me = await requireParent();
  if (!isAdmin(me.email)) notFound();
  // Real users unless Demo data is chosen. Feedback only ever comes from real parents.
  const query = await searchParams;
  const demo = query.view === "demo";
  // Long tables show 10 rows a page; each table keeps its own page in the address (?kids=2, ?families=3, ?sessions=1).
  const pages = { kids: paged(query, "kids"), families: paged(query, "families"), sessions: paged(query, "sessions") };
  const [d, fbReal] = await Promise.all([loadAdminData(demo ? "demo" : "real"), loadFeedback()]);
  const fb = demo ? { ...fbReal, rows: [] as typeof fbReal.rows } : fbReal;

  const familyOf = new Map(d.families.map((f) => [f.parentId, f]));
  const childOf = new Map(d.children.map((c) => [c.id, c]));
  const worksheets = d.sessions.filter((s) => s.kind === "worksheet").sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const finished = worksheets.filter((s) => s.status === "graded");
  const hint2 = d.attempts.filter((a) => (a.helpLevel ?? 0) >= 2).length;
  const review = d.attempts.filter((a) => a.status === "review").length;
  const cost = costSummary(d.aiCalls, new Set(finished.map((s) => s.id)));
  const tokens = d.aiCalls.reduce((t, a) => t + Number(a.inputTokens) + Number(a.outputTokens), 0);
  // Guests have no email: they're numbered by when they started, "Guest 1", "Guest 2"...
  const guestNo = new Map([...d.families].filter((f) => f.isGuest).sort((a, b) => (a.joinedAt ?? "").localeCompare(b.joinedAt ?? "")).map((f, i) => [f.parentId, i + 1]));
  const label = (f?: Family) => (f ? f.email || (guestNo.has(f.parentId) ? `Guest ${guestNo.get(f.parentId)}` : "(unknown)") : "(unknown)");
  const guests = d.families.filter((f) => f.isGuest).length;

  const vs = visits(d.activity, d.sessions);
  const repeat = repeatParents(d.activity, d.sessions);
  const active30 = new Set(vs.filter((v) => Date.now() - v.start < 30 * 864e5).map((v) => v.parentId)).size;
  const avgVisit = vs.length ? Math.round(vs.reduce((t, v) => t + v.minutes, 0) / vs.length) : null;
  const printed = d.activity.filter((a) => a.kind === "worksheet_print" || a.kind === "worksheet_download").length;
  const times = finished.map((s) => writingTime(s.startedAt, s.writingDoneAt, getWorksheet(s.worksheetId)?.minutes ?? 60)?.took).filter((t): t is number => !!t);
  const medTime = median(times);
  const avgScore = finished.length ? Math.round(finished.reduce((t, s) => t + (s.awarded ?? 0) / (s.max || 1), 0) / finished.length * 100) : null;
  const hinted = d.attempts.filter((a) => (a.helpLevel ?? 0) >= 1).length;
  const kids = childSummaries(d.children, d.sessions, d.attempts, d.activity, (k) => SKILLS[k as Skill]?.en ?? k).sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
  const lessonViews = Object.entries(d.activity.reduce<Record<string, number>>((m, a) => {
    const id = a.path?.match(/^\/learn\/lesson\/([^/?#]+)/)?.[1];
    if (id) m[id] = (m[id] ?? 0) + 1;
    return m;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, n]) => ({ what: getLesson(id)?.title.en ?? id, n }));
  const score = nps(fb.rows.map((r) => r.answers.nps));
  const split = npsBreakdown(fb.rows.map((r) => r.answers.nps));
  const willUse = fb.rows.filter((r) => r.answers.intent === "Definitely" || r.answers.intent === "Probably").length;
  const weeks = weekly(d.families, d.children, d.sessions, vs);
  const busy = busyTimes(vs);
  const top = Object.entries(worksheets.reduce<Record<string, number>>((m, s) => ((m[s.worksheetId] = (m[s.worksheetId] ?? 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ what: getWorksheet(id)?.title.en ?? id, n }));

  return (
    <div className="app-bg min-h-screen">
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6">
        <Logo />
        <DemoMenu back={demo ? "/admin?view=demo" : "/admin"} />
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-3xl">Pilot admin</h1>
          {/* Real and demo statistics are never mixed. */}
          <div className="ml-auto flex rounded-full border border-line bg-white p-1 text-sm font-semibold" role="group" aria-label="Which statistics">
            <Link href="/admin" aria-current={!demo} className={`rounded-full px-4 py-1.5 ${!demo ? "bg-black text-white" : "text-muted hover:text-ink"}`}>Real users</Link>
            <Link href="/admin?view=demo" aria-current={demo} className={`rounded-full px-4 py-1.5 ${demo ? "bg-[var(--brand-yellow)] text-black" : "text-muted hover:text-ink"}`}>Demo data</Link>
          </div>
        </div>
        {demo && (
          <p className="demo-stripes rounded-2xl border-2 border-black p-4 text-center font-bold">
            DUMMY DATA, for demonstration only. Not real users. <Link href="/admin" className="underline">Back to real statistics</Link>
          </p>
        )}

        <Card title="Feedback">
          {demo ? (
            <p className="mt-2 text-muted">Feedback only ever comes from real parents. See it under <Link href="/admin" className="underline">Real users</Link>.</p>
          ) : fb.missing ? (
            <p className="mt-2 rounded-2xl bg-warn-soft p-4 text-warn">Answers can&apos;t be saved yet: run <code>supabase/migrations/0003_feedback.sql</code> in the Supabase SQL Editor.</p>
          ) : !fb.rows.length ? (
            <p className="mt-2 text-muted">No answers yet. Share <b>/feedback?n=Name</b> with parents.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Replies" value={fb.rows.length} />
                <Stat label="Will use it for the next test" value={`${Math.round((willUse / fb.rows.length) * 100)}%`} note={`${willUse} said definitely or probably`} />
                <Stat
                  label="NPS"
                  value={score ?? "–"}
                  note={`${split.fans} fan${split.fans === 1 ? "" : "s"} · ${split.neutral} neutral · ${split.unhappy} unhappy`}
                  hint="NPS = % of fans (scored 9–10) minus % unhappy (scored 0–6). Neutral replies (7–8) don't count either way."
                />
                <Stat label="Average recommend" value={(fb.rows.reduce((t, r) => t + r.answers.nps, 0) / fb.rows.length).toFixed(1)} note="out of 10" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Bars title="Will you use it for your next Kannada test?" data={countBy(fb.rows, "intent", INTENT)} x="what" bars={[{ key: "n", name: "Parents" }]} horizontal />
                <Bars title="Which prep step would it replace?" data={countBy(fb.rows, "replace", REPLACE)} x="what" bars={[{ key: "n", name: "Parents" }]} horizontal />
              </div>
              <Table head={["When", "Who", "Next test", "Would replace", "Recommend", "Comment"]}>
                {fb.rows.map((r, i) => (
                  <tr key={i} className="border-t border-line align-top">
                    <td className="py-2">{date(r.createdAt)}</td>
                    <td>{r.name || (r.parentId ? label(familyOf.get(r.parentId)) : "Anonymous")}</td>
                    <td>{r.answers.intent}</td>
                    <td>{[r.answers.replace ?? []].flat().join(", ") || "–"}</td>
                    <td>{r.answers.nps}</td>
                    <td className="min-w-64">{r.answers.comment ?? "–"}</td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </Card>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Parents registered" value={d.families.length} note={`${d.families.length - guests} with email · ${guests} guests (no email yet)`} />
          <Stat label="Children registered" value={d.children.length} />
          <Stat label="Active parents" value={new Set(vs.filter((v) => Date.now() - v.start < 7 * 864e5).map((v) => v.parentId)).size} note={`this week · ${active30} in 30 days`} />
          <Stat label="Came back another day" value={repeat} note={d.families.length ? `${Math.round((repeat / d.families.length) * 100)}% of parents` : undefined} />
          <Stat label="Average visit" value={avgVisit === null ? "–" : `${avgVisit} min`} note={`${vs.length} visits · ${d.families.length ? fmt(vs.length / d.families.length) : 0} per parent`} />
          <Stat label="Worksheets printed" value={printed} note="downloads and prints" />
          <Stat label="Worksheets started" value={worksheets.length} note={`${finished.length} finished`} />
          <Stat label="Writing time" value={medTime === null ? "–" : `${Math.round(medTime)} min`} note="median per worksheet" />
          <Stat label="Average score" value={avgScore === null ? "–" : `${avgScore}%`} note="finished worksheets" />
          <Stat label="Answers with hints" value={d.attempts.length ? `${Math.round((hinted / d.attempts.length) * 100)}%` : "–"} note={`${hint2} used Hint 2`} />
          <Stat label="Waiting for review" value={review} note="answers" />
          <Stat label="AI calls" value={d.aiCalls.length} note={`${tokens.toLocaleString("en-IN")} tokens`} />
        </section>

        <Card title="AI costs (Claude API)">
          <p className="mt-1 text-sm text-muted">
            From the tokens logged for every AI call (reading handwriting and marking sentence answers), at Anthropic&apos;s list prices.
            Hosting (Vercel), the database (Supabase) and the read-aloud voices are on free plans and not included. Rupees at ₹{USD_TO_INR}/$.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="This month" value={usd(cost.thisMonth)} note={`${inr(cost.thisMonth)} · last 30 days ${usd(cost.last30)}`} />
            <Stat label="Per marked worksheet" value={cost.perWorksheet === null ? "–" : usd(cost.perWorksheet)} note={cost.perWorksheet === null ? "after the first marked worksheet" : `${inr(cost.perWorksheet)} · all calls for it`} />
            <Stat label="Per page read" value={cost.perPage === null ? "–" : usd(cost.perPage)} note={cost.perPage === null ? "after the first page" : `${inr(cost.perPage)} · handwriting reading`} />
            <Stat label="All time" value={usd(cost.total)} note={`${cost.calls} calls${cost.failed ? ` · ${cost.failed} failed` : ""} · reading ${usd(cost.reading)}, marking ${usd(cost.marking)}`} />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[2fr_1fr]">
            <Bars title="AI spend per day" note="US dollars, last 30 days" data={cost.daily} x="day" bars={[{ key: "usd", name: "$" }]} decimals />
            <div className="card p-4 text-sm">
              <p className="font-bold">By model</p>
              {cost.byModel.length ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {cost.byModel.map(([m, v]) => (
                    <li key={m} className="flex justify-between gap-3"><span>{m}</span><span className="font-medium">{usd(v)}</span></li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-muted">No AI calls yet.</p>}
              {cost.unknownModels && <p className="mt-2 text-xs text-muted">Some calls used a model without a known price; they are counted at Claude Opus 5.5 prices.</p>}
              <p className="mt-3 text-xs text-muted">The exact bill is in the Anthropic Console (Billing).</p>
            </div>
          </div>
        </Card>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <GrowthChart data={weeks} />
          <Bars title="Active parents per week" data={weeks} x="week" bars={[{ key: "active", name: "Parents" }]} />
          <Bars title="Worksheets per week" data={weeks} x="week" bars={[{ key: "started", name: "Started" }, { key: "finished", name: "Finished" }]} />
          <Bars title="From sign-up to coming back" note="Parents at each step" data={funnel(d.families, d.children, d.sessions, repeat)} x="step" bars={[{ key: "n", name: "Parents" }]} horizontal />
          <Bars title="What families use" data={activityMix(d.activity, d.sessions)} x="what" bars={[{ key: "n", name: "Times" }]} horizontal />
          <Bars title="Most read lessons" note="Times a lesson was opened" data={lessonViews} x="what" bars={[{ key: "n", name: "Opened" }]} horizontal />
          <Bars title="Most started worksheets" data={top} x="what" bars={[{ key: "n", name: "Started" }]} horizontal />
          <Bars title="Devices" note="Every recorded visit or action" data={devices(d.activity)} x="device" bars={[{ key: "n", name: "Events" }]} />
          <Bars title="Busiest days" note="Visits, India time" data={busy.days} x="day" bars={[{ key: "visits", name: "Visits" }]} />
          <Bars title="Busiest hours" note="Visits by hour of the day, India time" data={busy.hours} x="hour" bars={[{ key: "visits", name: "Visits" }]} />
        </section>
        <p className="text-xs text-muted">Visits group everything a family does with less than 30 minutes between steps. Page views and printing are counted from 24 Oct 2026, so earlier visits look shorter.</p>
        <p className="text-sm text-muted">Devices across all families: {deviceSplit(d.activity)}</p>
        {d.activityMissing && (
          <p className="rounded-2xl bg-warn-soft p-4 text-warn">
            Page views aren&apos;t being recorded yet: run <code>supabase/migrations/0002_timer_activity.sql</code> in the Supabase SQL Editor.
          </p>
        )}

        <Card title="What each child is doing" id="kids">
          <p className="mt-1 text-sm text-muted">One row per child, most recently active first. Signals point out who needs a nudge and where children get stuck.</p>
          <Table head={["Child", "Family", "Days active", "Time spent", "Last seen", "Lessons read", "Grammar cards", "Worksheets", "Hints", "Signals"]}>
            {pages.kids.slice(kids).map((k) => (
              <tr key={k.childId} className="border-t border-line align-top">
                <td className="py-2 font-bold">{k.nickname}</td>
                <td>{label(familyOf.get(k.parentId))}</td>
                <td>{k.days} <span className="text-muted">({k.visits} visits)</span></td>
                <td>{k.minutes ? `${k.minutes} min` : "–"}</td>
                <td>{k.lastSeen ? date(new Date(k.lastSeen).toISOString()) : "Never"}</td>
                <td>{k.lessons.length ? k.lessons.map((l) => getLesson(l)?.title.en ?? l).join(", ") : "–"}</td>
                <td>{k.cardSets ? `${k.cardSets} sets · ${k.cardPct}%` : "–"}</td>
                <td>{k.started ? `${k.finished} of ${k.started} finished${k.worksheetPct !== null ? ` · ${k.worksheetPct}%` : ""}` : "–"}</td>
                <td>{k.hintPct === null ? "–" : `${k.hintPct}% of answers`}</td>
                <td className="min-w-56">
                  {k.signals.length ? (
                    <ul className="flex flex-col gap-1">{k.signals.map((x) => <li key={x} className="rounded-lg bg-accent-soft px-2 py-1 text-xs">{x}</li>)}</ul>
                  ) : <span className="text-muted">On track</span>}
                </td>
              </tr>
            ))}
          </Table>
          <Pager query={query} name="kids" total={kids.length} page={pages.kids.page} />
        </Card>

        <Card title="Families" id="families">
          <Table head={["Parent email", "Joined", "Last sign-in", "Children", "Worksheets (finished)", "Dashboard views", "Device use", "Last activity"]}>
            {pages.families.slice(d.families).map((f) => {
              const kids = d.children.filter((c) => c.parentId === f.parentId);
              const ws = worksheets.filter((s) => s.parentId === f.parentId);
              const acts = d.activity.filter((a) => a.parentId === f.parentId);
              const last = [...ws.map((s) => s.startedAt), ...acts.map((a) => a.createdAt)].sort().at(-1);
              return (
                <tr key={f.parentId} className="border-t border-line">
                  <td className="py-2 font-bold">{label(f)}{f.isGuest && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium">guest</span>}</td>
                  <td>{date(f.joinedAt)}</td>
                  <td>{date(f.lastSignInAt)}</td>
                  <td>{kids.length ? kids.map((k) => k.nickname).join(", ") : <span className="text-warn">None yet</span>}</td>
                  <td>{ws.length ? `${ws.length} (${ws.filter((s) => s.status === "graded").length})` : <span className="text-warn">Not started</span>}</td>
                  <td>{acts.filter((a) => a.kind === "parent_dashboard").length}</td>
                  <td>{deviceSplit(acts)}</td>
                  <td>{date(last)}</td>
                </tr>
              );
            })}
          </Table>
          <Pager query={query} name="families" total={d.families.length} page={pages.families.page} />
        </Card>

        <Card title="Worksheet sessions" id="sessions">
          <Table head={["Started", "Family", "Child", "Worksheet", "Status", "Score", "Time", "Hints (1 / 2)"]}>
            {pages.sessions.slice(worksheets).map((s) => {
              const ws = getWorksheet(s.worksheetId);
              const levels = Object.values(s.help ?? {});
              return (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-2">{date(s.startedAt)}</td>
                  <td>{label(familyOf.get(s.parentId))}</td>
                  <td>{childOf.get(s.childId)?.nickname ?? "–"}</td>
                  <td>{ws?.title.en ?? s.worksheetId}{s.retryOf ? " (retry)" : ""}</td>
                  <td>{s.status === "graded" ? "Finished" : s.status === "writing" ? "Writing" : s.status === "checking" ? "Checking photos" : "Reading photos"}</td>
                  <td>{s.status === "graded" ? `${fmt(s.awarded ?? 0)}/${fmt(s.max ?? 0)}` : "–"}</td>
                  <td>{writingTime(s.startedAt, s.writingDoneAt, ws?.minutes ?? 60)?.text ?? "–"}</td>
                  <td>{levels.filter((l) => l === 1).length} / {levels.filter((l) => l >= 2).length}</td>
                </tr>
              );
            })}
          </Table>
          <Pager query={query} name="sessions" total={worksheets.length} page={pages.sessions.page} />
        </Card>

      </main>
    </div>
  );
}

function Stat({ label, value, note, hint }: { label: string; value: number | string; note?: string; hint?: string }) {
  return (
    <div className="card p-3" title={hint}>
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-light">{value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
      {hint && <span className="sr-only">{hint}</span>}
    </div>
  );
}

function Card({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-4 bg-white p-5">
      <h2 className="text-xl">{title}</h2>
      {children}
    </section>
  );
}

const PAGE = 10;

function paged(query: Query, name: "kids" | "families" | "sessions") {
  const page = Math.max(1, Math.floor(Number(query[name]) || 1));
  return { page, slice: <T,>(rows: T[]) => rows.slice((page - 1) * PAGE, page * PAGE) };
}

// "1 2 3 … 9 →" under a table. Other tables' pages and the Real/Demo choice stay as they are.
function Pager({ query, name, total, page }: { query: Query; name: "kids" | "families" | "sessions"; total: number; page: number }) {
  const count = Math.ceil(total / PAGE);
  if (count <= 1) return null;
  const href = (n: number) => {
    const q = new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][]);
    if (n === 1) q.delete(name);
    else q.set(name, String(n));
    const s = q.toString();
    return `/admin${s ? `?${s}` : ""}#${name}`;
  };
  const shown = [...new Set([1, page - 1, page, page + 1, count])].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const cur = Math.min(page, count);
  return (
    <nav aria-label="Pages" className="mt-3 flex flex-wrap items-center gap-1 text-sm">
      <span className="mr-2 text-muted">{(cur - 1) * PAGE + 1}–{Math.min(cur * PAGE, total)} of {total}</span>
      {cur > 1 && <Link href={href(cur - 1)} className="top-btn !h-8">← Prev</Link>}
      {shown.map((n, i) => (
        <span key={n} className="flex items-center gap-1">
          {i > 0 && n - shown[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
          <Link href={href(n)} aria-current={n === cur ? "page" : undefined} className={`top-btn !h-8 !px-3 ${n === cur ? "!border-black !bg-black !text-white" : ""}`}>{n}</Link>
        </span>
      ))}
      {cur < count && <Link href={href(cur + 1)} className="top-btn !h-8">Next →</Link>}
    </nav>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-muted">
          <tr>{head.map((h) => <th key={h} className="py-2 pr-4 font-bold">{h}</th>)}</tr>
        </thead>
        <tbody className="[&_td]:pr-4">{children}</tbody>
      </table>
    </div>
  );
}
