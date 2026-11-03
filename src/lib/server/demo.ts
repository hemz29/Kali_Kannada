import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { arjun, buildFamily, DEMO_PARENT_EMAIL, dummyFamilies, isDemoEmail, type FamilyRecords, type FamilySpec } from "@/lib/demoData";
import { localResetDemo } from "@/lib/store/local";
import type { AiUsageEvent } from "@/lib/store/types";
import { isDemo, serviceClient } from "./context";

// Writing and clearing demo data. Every demo account is tagged (user_metadata.demo = true) and uses a demo-…@kali-kannada.app
// address; nothing here ever deletes or changes an account that isn't both, so real families can't be touched.

export const isDemoUser = (u: { email?: string | null; user_metadata?: Record<string, unknown> | null; is_anonymous?: boolean }) =>
  u.user_metadata?.demo === true && (u.is_anonymous || isDemoEmail(u.email ?? ""));

async function allUsers(db: SupabaseClient) {
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);
  return data.users;
}

// The rows for one family, with ids made here so sessions, answers and AI calls can point at each other.
function rows(parentId: string, f: FamilyRecords) {
  const childId = randomUUID();
  const ids = new Map(f.sessions.map((s) => [s.key, randomUUID()]));
  return {
    childId,
    child: { id: childId, parent_id: parentId, nickname: f.child.nickname, theme: f.child.theme, created_at: f.child.createdAt },
    sessions: f.sessions.map((s) => ({
      id: ids.get(s.key), parent_id: parentId, child_id: childId, kind: s.kind, worksheet_id: s.worksheetId, retry_of: null, status: s.status,
      marking_version: s.markingVersion, help: s.help, awarded: s.awarded, max: s.max, started_at: s.startedAt, writing_done_at: s.writingDoneAt, completed_at: s.completedAt,
    })),
    attempts: f.attempts.map((a) => ({
      parent_id: parentId, session_id: ids.get(a.sessionKey), child_id: childId, question_id: a.questionId, type: a.type, skill: a.skill, text: a.text,
      confidence: a.confidence, reading_confirmed: true, help_level: a.helpLevel, awarded: a.awarded, max: a.max, status: a.status, method: a.method,
      marking_version: a.markingVersion, created_at: a.createdAt,
    })),
    activity: f.activity.map((a) => ({ parent_id: parentId, child_id: childId, kind: a.kind, path: a.path, detail: a.detail, created_at: a.createdAt })),
    ai: f.ai.map((a) => ({ parent_id: parentId, session_id: ids.get(a.sessionKey), purpose: a.purpose, model: a.model, input_tokens: a.inputTokens, output_tokens: a.outputTokens, ms: a.ms, ok: a.ok, created_at: a.createdAt })),
  };
}

async function insert(db: SupabaseClient, table: string, data: object[]) {
  for (let i = 0; i < data.length; i += 500) {
    const { error } = await db.from(table).insert(data.slice(i, i + 500));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function writeFamily(db: SupabaseClient, spec: FamilySpec, now: number) {
  const created = await db.auth.admin.createUser({ email: spec.email, email_confirm: true, user_metadata: { demo: true, name: `${spec.nickname}'s family (demo)` } });
  if (created.error || !created.data.user) throw new Error(`demo account ${spec.email}: ${created.error?.message}`);
  const r = rows(created.data.user.id, buildFamily(spec, now));
  await insert(db, "children", [r.child]);
  // The exam goes in children.exam (migration 0004), or on the account until that update is run (see examPlan.ts).
  if (spec.exam) {
    const { error } = await db.from("children").update({ exam: spec.exam }).eq("id", r.childId);
    if (error) await db.auth.admin.updateUserById(created.data.user.id, { app_metadata: { exams: { [r.childId]: spec.exam } } });
  }
  await insert(db, "practice_sessions", r.sessions);
  await insert(db, "question_attempts", r.attempts);
  await insert(db, "activity_events", r.activity).catch(() => undefined); // activity table comes with migration 0002
  await insert(db, "ai_usage_events", r.ai);
}

// Removes every demo account (and its AI log rows, which would otherwise outlive it) and makes them all again.
export async function resetDemo(now = Date.now()) {
  const families = [arjun(now), ...dummyFamilies(now)];
  if (isDemo) {
    await localResetDemo(
      families.map((spec) => {
        const parentId = `demo-${randomUUID()}`;
        const f = buildFamily(spec, now);
        const r = rows(parentId, f);
        return {
          parentId,
          child: { id: r.childId, parentId, nickname: f.child.nickname, theme: f.child.theme, createdAt: f.child.createdAt, exam: f.child.exam ?? null },
          sessions: r.sessions.map((s, i) => ({ ...f.sessions[i], id: s.id!, parentId, childId: r.childId })),
          attempts: r.attempts.map((a, i) => ({ ...f.attempts[i], id: randomUUID(), parentId, childId: r.childId, sessionId: a.session_id! })),
          activity: f.activity.map((a) => ({ kind: a.kind, path: a.path, childId: r.childId, detail: a.detail, createdAt: a.createdAt })),
          ai: f.ai.map((a, i) => ({ purpose: a.purpose, model: a.model, sessionId: r.ai[i].session_id ?? null, inputTokens: a.inputTokens, outputTokens: a.outputTokens, ms: a.ms, ok: a.ok, error: null, at: a.createdAt }) as AiUsageEvent & { at: string }),
        };
      }),
    );
    return;
  }
  const db = serviceClient()!;
  for (const u of (await allUsers(db)).filter(isDemoUser)) {
    await db.from("ai_usage_events").delete().eq("parent_id", u.id);
    const { error } = await db.auth.admin.deleteUser(u.id); // children, practice, answers and visits go with it
    if (error) throw new Error(`removing demo account: ${error.message}`);
  }
  for (const spec of families) await writeFamily(db, spec, now);
}

// The demo parent's account, made (with all the dummy families) the first time it's needed.
export async function demoParent(): Promise<{ id: string; email: string; childId: string | null }> {
  const db = serviceClient()!;
  let user = (await allUsers(db)).find((u) => u.email?.toLowerCase() === DEMO_PARENT_EMAIL && isDemoUser(u));
  if (!user) {
    await resetDemo();
    user = (await allUsers(db)).find((u) => u.email?.toLowerCase() === DEMO_PARENT_EMAIL);
  }
  if (!user) throw new Error("demo parent could not be created");
  const { data } = await db.from("children").select("id").eq("parent_id", user.id).limit(1).maybeSingle();
  return { id: user.id, email: DEMO_PARENT_EMAIL, childId: (data?.id as string | undefined) ?? null };
}

// Tags a guest started from the switcher, so it counts as demo, not as a real family.
export async function tagDemoGuest(id: string) {
  await serviceClient()?.auth.admin.updateUserById(id, { user_metadata: { demo: true } });
}

// Signs this browser in as the given account without a password: the admin API makes a one-time sign-in token and the
// server uses it straight away, which sets that account's session cookies.
export async function signInAs(email: string, client: SupabaseClient) {
  const { data, error } = await serviceClient()!.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(`sign-in link for ${email}: ${error?.message}`);
  const first = await client.auth.verifyOtp({ type: "email", token_hash: data.properties.hashed_token });
  if (first.error) {
    const again = await client.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
    if (again.error) throw new Error(`signing in as ${email}: ${again.error.message}`);
  }
}
