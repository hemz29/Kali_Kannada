import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttemptScore, Store } from "./types";

// Supabase-backed store. Given a signed-in user's client, RLS limits every query to that parent's rows;
// the explicit parent_id filters keep behaviour identical to the local store and to the service client.
const snake = (k: string) => k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function toRow(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [snake(k), v]));
}
export function fromRow<T>(row: Record<string, unknown> | null): T {
  return (row && Object.fromEntries(Object.entries(row).map(([k, v]) => [camel(k), typeof v === "string" && /^(awarded|max)$/.test(k) ? Number(v) : v]))) as T;
}
function check<T>({ data, error }: { data: T; error: { message: string } | null }) {
  if (error) throw new Error(error.message);
  return data;
}

const BUCKET = "answer-pages";

export function supabaseStore(db: SupabaseClient): Store {
  const rows = <T>(r: { data: unknown; error: { message: string } | null }) =>
    (check(r) as Record<string, unknown>[] | null ?? []).map((x) => fromRow<T>(x));
  const one = <T>(r: { data: unknown; error: { message: string } | null }) => {
    const d = check(r) as Record<string, unknown> | null;
    return d ? fromRow<T>(d) : null;
  };

  return {
    listChildren: async (parentId) => rows(await db.from("children").select().eq("parent_id", parentId).order("created_at")),
    getChild: async (parentId, id) => one(await db.from("children").select().eq("parent_id", parentId).eq("id", id).maybeSingle()),
    createChild: async (parentId, nickname, theme) =>
      one(await db.from("children").insert({ parent_id: parentId, nickname, theme }).select().single()) as never,
    updateChild: async (parentId, id, patch) => {
      check(await db.from("children").update(toRow(patch)).eq("parent_id", parentId).eq("id", id));
    },
    deleteChild: async (parentId, id) => {
      // Rows go with the child (on delete cascade); the answer photos in storage have to be removed separately.
      const sessions = rows<{ id: string }>(await db.from("practice_sessions").select("id").eq("parent_id", parentId).eq("child_id", id));
      if (sessions.length) {
        const pages = rows<{ imageKey: string }>(await db.from("page_uploads").select("image_key").eq("parent_id", parentId).in("session_id", sessions.map((x) => x.id)));
        const keys = pages.map((x) => x.imageKey).filter(Boolean);
        for (let i = 0; i < keys.length; i += 1000) check(await db.storage.from(BUCKET).remove(keys.slice(i, i + 1000)));
      }
      check(await db.from("children").delete().eq("parent_id", parentId).eq("id", id));
    },

    createSession: async (s) => one(await db.from("practice_sessions").insert(toRow(s)).select().single()) as never,
    getSession: async (parentId, id) =>
      one(await db.from("practice_sessions").select().eq("parent_id", parentId).eq("id", id).maybeSingle()),
    updateSession: async (parentId, id, patch) => {
      check(await db.from("practice_sessions").update(toRow(patch)).eq("parent_id", parentId).eq("id", id));
    },
    listSessions: async (parentId, childId) =>
      rows(await db.from("practice_sessions").select().eq("parent_id", parentId).eq("child_id", childId).order("started_at")),

    addPage: async (parentId, page) =>
      one(await db.from("page_uploads").insert({ ...toRow(page), parent_id: parentId }).select().single()) as never,
    updatePage: async (parentId, id, patch) => {
      check(await db.from("page_uploads").update(toRow(patch)).eq("parent_id", parentId).eq("id", id));
    },
    listPages: async (parentId, sessionId) =>
      rows(await db.from("page_uploads").select().eq("parent_id", parentId).eq("session_id", sessionId).order("created_at")),

    replaceAttempts: async (parentId, sessionId, attempts) => {
      check(await db.from("question_attempts").delete().eq("parent_id", parentId).eq("session_id", sessionId));
      if (attempts.length) check(await db.from("question_attempts").insert(attempts.map(toRow)));
    },
    updateAttempt: async (parentId, id, patch) => {
      check(await db.from("question_attempts").update(toRow(patch)).eq("parent_id", parentId).eq("id", id));
    },
    listSessionAttempts: async (parentId, sessionId) =>
      rows(await db.from("question_attempts").select().eq("parent_id", parentId).eq("session_id", sessionId)),
    listChildAttempts: async (parentId, childId) =>
      rows(await db.from("question_attempts").select().eq("parent_id", parentId).eq("child_id", childId).order("created_at")),
    listAttemptScores: async (parentId, childId) =>
      rows(
        await db
          .from("question_attempts")
          .select("question_id, type, skill, session_id, awarded, max, status, help_level, created_at, reading_confirmed, near_miss:feedback->nearMiss")
          .eq("parent_id", parentId)
          .eq("child_id", childId)
          .order("created_at"),
      ).map((a) => ({ ...(a as AttemptScore & { nearMiss?: unknown }), nearMiss: Boolean((a as { nearMiss?: unknown }).nearMiss) })),

    createToken: async (t) => {
      check(await db.from("upload_tokens").insert(toRow(t)));
    },
    getToken: async (token) => one(await db.from("upload_tokens").select().eq("token", token).maybeSingle()),

    putImage: async (key, data, contentType) => {
      check(await db.storage.from(BUCKET).upload(key, data, { contentType, upsert: true }));
    },
    getImage: async (key) => {
      const { data, error } = await db.storage.from(BUCKET).download(key);
      return error || !data ? null : Buffer.from(await data.arrayBuffer());
    },

    logAi: async (parentId, e) => {
      check(await db.from("ai_usage_events").insert({ ...toRow(e), parent_id: parentId }));
    },
    logActivity: async (parentId, e) => {
      check(await db.from("activity_events").insert({ kind: e.kind, path: e.path ?? null, child_id: e.childId ?? null, detail: e.detail ?? {}, parent_id: parentId }));
    },
  };
}
