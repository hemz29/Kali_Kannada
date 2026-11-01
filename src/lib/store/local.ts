import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ActivityEvent, AiUsageEvent, Child, PageUpload, PracticeSession, QuestionAttempt, Store, UploadToken } from "./types";

// Demo-mode store: one JSON file on this computer. Used when Supabase isn't configured (local development).
type Db = {
  children: Child[];
  sessions: PracticeSession[];
  pages: (PageUpload & { parentId: string })[];
  attempts: QuestionAttempt[];
  tokens: UploadToken[];
  ai: (AiUsageEvent & { parentId: string; at: string })[];
  activity: (ActivityEvent & { parentId: string; createdAt: string })[];
  demoParents?: string[]; // dummy families for demos (see lib/server/demo.ts), shown only in the admin page's Demo view
};

const DIR = process.env.LOCAL_DATA_DIR ?? path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "db.json");
const empty = (): Db => ({ children: [], sessions: [], pages: [], attempts: [], tokens: [], ai: [], activity: [] });

let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Db> {
  try {
    return { ...empty(), ...JSON.parse(await fs.readFile(FILE, "utf8")) };
  } catch {
    return empty();
  }
}

// Serialise read-modify-write cycles so concurrent requests don't overwrite each other.
function tx<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(db, null, 1));
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

const read = <T>(fn: (db: Db) => T) => queue.then(load).then(fn);
const now = () => new Date().toISOString();

export const localStore: Store = {
  listChildren: (parentId) => read((db) => db.children.filter((c) => c.parentId === parentId)),
  getChild: (parentId, childId) => read((db) => db.children.find((c) => c.id === childId && c.parentId === parentId) ?? null),
  createChild: (parentId, nickname, theme) =>
    tx((db) => {
      const c: Child = { id: randomUUID(), parentId, nickname, theme, createdAt: now() };
      db.children.push(c);
      return c;
    }),
  updateChild: (parentId, childId, patch) =>
    tx((db) => {
      const c = db.children.find((x) => x.id === childId && x.parentId === parentId);
      if (c) Object.assign(c, patch);
    }),
  deleteChild: async (parentId, childId) => {
    const keys: string[] = [];
    await tx((db) => {
      const sessionIds = new Set(db.sessions.filter((s) => s.childId === childId && s.parentId === parentId).map((s) => s.id));
      keys.push(...db.pages.filter((p) => sessionIds.has(p.sessionId)).map((p) => p.imageKey));
      db.children = db.children.filter((c) => !(c.id === childId && c.parentId === parentId));
      db.sessions = db.sessions.filter((s) => !sessionIds.has(s.id));
      db.pages = db.pages.filter((p) => !sessionIds.has(p.sessionId));
      db.attempts = db.attempts.filter((a) => !sessionIds.has(a.sessionId));
      db.tokens = db.tokens.filter((t) => !sessionIds.has(t.sessionId));
    });
    await Promise.all(keys.map((k) => fs.rm(path.join(DIR, "images", k), { force: true })));
  },

  createSession: (s) =>
    tx((db) => {
      const full: PracticeSession = { ...s, id: randomUUID(), startedAt: now() };
      db.sessions.push(full);
      return full;
    }),
  getSession: (parentId, id) => read((db) => db.sessions.find((s) => s.id === id && s.parentId === parentId) ?? null),
  updateSession: (parentId, id, patch) =>
    tx((db) => {
      const s = db.sessions.find((x) => x.id === id && x.parentId === parentId);
      if (s) Object.assign(s, patch);
    }),
  listSessions: (parentId, childId) =>
    read((db) => db.sessions.filter((s) => s.parentId === parentId && s.childId === childId)),

  addPage: (parentId, page) =>
    tx((db) => {
      const p = { ...page, id: randomUUID(), createdAt: now(), parentId };
      db.pages.push(p);
      return p;
    }),
  updatePage: (parentId, id, patch) =>
    tx((db) => {
      const p = db.pages.find((x) => x.id === id && x.parentId === parentId);
      if (p) Object.assign(p, patch);
    }),
  listPages: (parentId, sessionId) =>
    read((db) => db.pages.filter((p) => p.sessionId === sessionId && p.parentId === parentId)),

  replaceAttempts: (parentId, sessionId, attempts) =>
    tx((db) => {
      db.attempts = db.attempts.filter((a) => !(a.sessionId === sessionId && a.parentId === parentId));
      db.attempts.push(...attempts.map((a) => ({ ...a, id: randomUUID(), createdAt: now() })));
    }),
  updateAttempt: (parentId, id, patch) =>
    tx((db) => {
      const a = db.attempts.find((x) => x.id === id && x.parentId === parentId);
      if (a) Object.assign(a, patch);
    }),
  listSessionAttempts: (parentId, sessionId) =>
    read((db) => db.attempts.filter((a) => a.sessionId === sessionId && a.parentId === parentId)),
  listChildAttempts: (parentId, childId) =>
    read((db) => db.attempts.filter((a) => a.childId === childId && a.parentId === parentId)),
  listAttemptScores: (parentId, childId) =>
    read((db) =>
      db.attempts
        .filter((a) => a.childId === childId && a.parentId === parentId)
        .map(({ questionId, type, skill, sessionId, awarded, max, status, helpLevel, createdAt, readingConfirmed, feedback }) => ({ questionId, type, skill, sessionId, awarded, max, status, helpLevel, createdAt, readingConfirmed, nearMiss: Boolean(feedback?.nearMiss) })),
    ),

  createToken: (t) =>
    tx((db) => {
      db.tokens.push({ ...t, usedAt: null });
    }),
  getToken: (token) => read((db) => db.tokens.find((t) => t.token === token) ?? null),

  putImage: async (key, data) => {
    const file = path.join(DIR, "images", key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  },
  getImage: async (key) => {
    try {
      return await fs.readFile(path.join(DIR, "images", key));
    } catch {
      return null;
    }
  },

  logAi: (parentId, e) =>
    tx((db) => {
      db.ai.push({ ...e, parentId, at: now() });
    }),
  logActivity: (parentId, e) =>
    tx((db) => {
      db.activity.push({ ...e, parentId, createdAt: now() });
    }),
};

// Everything in the demo store, for the admin page.
export const localDump = () => load();

// Demo data in the local file: the same dummy families as on Supabase, marked so the admin page can keep them apart.
export async function localResetDemo(families: { parentId: string; child: Child; sessions: PracticeSession[]; attempts: QuestionAttempt[]; activity: (ActivityEvent & { createdAt: string })[]; ai: (AiUsageEvent & { at: string })[] }[]) {
  await tx((db) => {
    const old = new Set(db.demoParents ?? []);
    db.children = db.children.filter((c) => !old.has(c.parentId));
    db.sessions = db.sessions.filter((s) => !old.has(s.parentId));
    db.attempts = db.attempts.filter((a) => !old.has(a.parentId));
    db.activity = db.activity.filter((a) => !old.has(a.parentId));
    db.ai = db.ai.filter((a) => !old.has(a.parentId));
    for (const f of families) {
      db.children.push(f.child);
      db.sessions.push(...f.sessions);
      db.attempts.push(...f.attempts);
      db.activity.push(...f.activity.map((a) => ({ ...a, parentId: f.parentId })));
      db.ai.push(...f.ai.map((a) => ({ ...a, parentId: f.parentId })));
    }
    db.demoParents = families.map((f) => f.parentId);
  });
}
