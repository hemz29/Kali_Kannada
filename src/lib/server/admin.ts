import "server-only";
import { fromRow } from "@/lib/store/supabase";
import { localDump } from "@/lib/store/local";
import type { Child, PracticeSession, QuestionAttempt } from "@/lib/store/types";
import { serviceClient } from "./context";
import { isDemoUser } from "./demo";
import type { AiCall } from "@/lib/aiCost";

// The owner's admin page: every family's activity in one place. Only these emails can open it.
const ADMINS = (process.env.ADMIN_EMAILS ?? "hemlata.v.29@gmail.com").split(",").map((e) => e.trim().toLowerCase());
export const isAdmin = (email: string) => ADMINS.includes(email.toLowerCase());

export type Family = { parentId: string; email: string; joinedAt: string | null; lastSignInAt: string | null; isGuest: boolean };
// Real families and demo (dummy) families are never mixed: the admin page shows one or the other.
export type AdminView = "real" | "demo";
export type Activity = { parentId: string; childId: string | null; kind: string; path: string | null; createdAt: string; device: string | null };
const deviceIn = (detail: unknown) => ((detail as { device?: string } | null)?.device ?? null);
export type AdminData = {
  families: Family[];
  children: Child[];
  sessions: PracticeSession[];
  attempts: Pick<QuestionAttempt, "sessionId" | "skill" | "helpLevel" | "status" | "awarded" | "max" | "method">[];
  activity: Activity[];
  aiCalls: AiCall[];
  activityMissing: boolean;
};

export async function loadAdminData(view: AdminView = "real"): Promise<AdminData> {
  return keepOnly(view, await loadAll());
}

// Everything, with the demo accounts marked, before the real/demo split.
async function loadAll(): Promise<AdminData & { demoParents: Set<string> }> {
  const db = serviceClient();
  if (!db) {
    const d = await localDump();
    const parents = [...new Set(d.children.map((c) => c.parentId))];
    return {
      demoParents: new Set(d.demoParents ?? []),
      families: parents.map((p) => ({ parentId: p, email: "demo@studybuddy.local", joinedAt: null, lastSignInAt: null, isGuest: false })),
      children: d.children,
      sessions: d.sessions,
      attempts: d.attempts,
      activity: d.activity.map((a) => ({ parentId: a.parentId, childId: a.childId ?? null, kind: a.kind, path: a.path ?? null, createdAt: a.createdAt, device: deviceIn(a.detail) })),
      aiCalls: d.ai.map((a) => ({ parentId: a.parentId, ok: a.ok, inputTokens: a.inputTokens, outputTokens: a.outputTokens, model: a.model, purpose: a.purpose, sessionId: a.sessionId, createdAt: a.at })),
      activityMissing: false,
    };
  }

  const all = async (table: string, columns = "*") => {
    const { data, error } = await db.from(table).select(columns).limit(5000);
    return { rows: ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => fromRow<Record<string, unknown>>(r)), error };
  };
  const [users, children, sessions, attempts, activity, ai] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 1000 }),
    all("children"),
    all("practice_sessions"),
    all("question_attempts", "session_id, skill, help_level, status, awarded, max, method"),
    all("activity_events", "parent_id, child_id, kind, path, created_at, detail"),
    all("ai_usage_events", "parent_id, ok, input_tokens, output_tokens, model, purpose, session_id, created_at"),
  ]);
  return {
    demoParents: new Set((users.data?.users ?? []).filter(isDemoUser).map((u) => u.id)),
    families: (users.data?.users ?? []).map((u) => ({ parentId: u.id, email: u.email ?? "", joinedAt: u.created_at ?? null, lastSignInAt: u.last_sign_in_at ?? null, isGuest: Boolean(u.is_anonymous) })),
    children: children.rows as unknown as Child[],
    sessions: (sessions.rows as unknown as PracticeSession[]).map((s) => ({ ...s, awarded: s.awarded === null ? null : Number(s.awarded), max: s.max === null ? null : Number(s.max) })),
    attempts: (attempts.rows as unknown as AdminData["attempts"]).map((a) => ({ ...a, awarded: a.awarded === null ? null : Number(a.awarded), max: Number(a.max) })),
    activity: (activity.rows as unknown as (Activity & { detail?: unknown })[]).map(({ detail, ...a }) => ({ ...a, device: deviceIn(detail) })),
    aiCalls: ai.rows as unknown as AdminData["aiCalls"],
    activityMissing: Boolean(activity.error),
  };
}

// One place that splits real from demo, so every table and chart on the admin page follows the toggle.
// AI log rows without a family (a family that was deleted) count as real.
function keepOnly(view: AdminView, d: AdminData & { demoParents: Set<string> }): AdminData {
  const { demoParents, ...rest } = d;
  const want = (parentId: string | null | undefined) => (parentId ? demoParents.has(parentId) : false) === (view === "demo");
  const sessions = rest.sessions.filter((s) => want(s.parentId));
  const sessionIds = new Set(sessions.map((s) => s.id));
  return {
    ...rest,
    // Demo accounts are all made at reset time, so a dummy family "joined" when its child was added (spread over weeks).
    families: rest.families
      .filter((f) => want(f.parentId))
      .map((f) => {
        if (view !== "demo") return f;
        const first = rest.children.filter((c) => c.parentId === f.parentId).map((c) => c.createdAt).sort()[0];
        return first ? { ...f, joinedAt: first, lastSignInAt: f.lastSignInAt ?? first } : f;
      }),
    children: rest.children.filter((c) => want(c.parentId)),
    sessions,
    attempts: rest.attempts.filter((a) => sessionIds.has(a.sessionId)),
    activity: rest.activity.filter((a) => want(a.parentId)),
    aiCalls: rest.aiCalls.filter((a) => want(a.parentId)),
  };
}
