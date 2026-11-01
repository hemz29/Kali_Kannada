import type { QuestionType, Skill } from "@/content/schema";

// The child's avatar is stored in the "theme" column (themes came first; see lib/avatars).
export type Child = { id: string; parentId: string; nickname: string; theme: string; createdAt: string; exam?: ExamPlan | null };

// The next exam, set by the parent in Parent view (stored in children.exam, migration 0004).
// actualMark is the real result, entered afterwards; acknowledged means the parent has read the readiness note.
export type ExamPlan = { date: string | null; lessonIds: string[]; actualMark?: number | null; acknowledged?: boolean };

export type SessionStatus = "writing" | "reading" | "checking" | "graded";
export type PracticeSession = {
  id: string;
  parentId: string;
  childId: string;
  kind: "worksheet" | "cards";
  worksheetId: string;
  // A retry of a worksheet points at the session it retries; the trend chart uses first attempts only.
  retryOf: string | null;
  status: SessionStatus;
  markingVersion: string;
  // "I'm stuck" help: highest help level opened per question id (0 = none).
  help: Record<string, number>;
  awarded: number | null;
  max: number | null;
  // The timer runs from startedAt ("I'm ready") to writingDoneAt ("I've finished writing" or the first photo).
  startedAt: string;
  writingDoneAt?: string | null;
  completedAt: string | null;
};

// Where on the page photo, as fractions of its width and height. Older readings have no box.
export type PageBox = { left: number; top: number; right: number; bottom: number };
export type UncertainWord = { index: number; word: string; alternatives: string[]; box?: PageBox };

export type PageUpload = {
  id: string;
  sessionId: string;
  imageKey: string;
  status: "received" | "reading" | "read" | "failed";
  error: string | null;
  createdAt: string;
};

// One child answer as read from a photo, before and after grading.
export type QuestionAttempt = {
  id: string;
  sessionId: string;
  parentId: string;
  childId: string;
  questionId: string;
  type: QuestionType;
  skill: Skill;
  pageId: string | null;
  // Vertical position of the answer on the page (0–1), used to show the child's handwriting strip.
  region: { top: number; bottom: number; left?: number; right?: number } | null;
  text: string;
  confidence: "high" | "low";
  uncertainWords: UncertainWord[];
  readingConfirmed: boolean;
  misreadFlagged: boolean;
  helpLevel: number;
  awarded: number | null;
  max: number;
  status: "correct" | "partial" | "incorrect" | "blank" | "review" | null;
  method: "key" | "ai" | "reviewer" | null;
  feedback: AttemptFeedback | null;
  markingVersion: string;
  createdAt: string;
};

// nearMiss: marking found the answer one or two letters off the right one (a spelling slip).
export type AttemptScore = Pick<QuestionAttempt, "questionId" | "type" | "skill" | "sessionId" | "awarded" | "max" | "status" | "helpLevel" | "createdAt" | "readingConfirmed"> & { nearMiss?: boolean };

export type AttemptFeedback = {
  en: string;
  points?: { point: string; met: boolean }[];
  nearMiss?: { wrote: string; correct: string };
  model?: { kn: string; en: string };
};

export type UploadToken = {
  token: string;
  parentId: string;
  childId: string;
  sessionId: string;
  expiresAt: string;
  usedAt: string | null;
};

export type AiUsageEvent = {
  purpose: "read_answers" | "grade_answers";
  model: string;
  sessionId: string | null;
  inputTokens: number;
  outputTokens: number;
  ms: number;
  ok: boolean;
  error: string | null;
};

// What parents and children open, for the owner's admin page.
export type ActivityEvent = { kind: string; path?: string; childId?: string | null; detail?: Record<string, unknown> };

// Every call is scoped to the signed-in parent. The Supabase implementation also enforces this with RLS.
export interface Store {
  listChildren(parentId: string): Promise<Child[]>;
  getChild(parentId: string, childId: string): Promise<Child | null>;
  createChild(parentId: string, nickname: string, avatar: string): Promise<Child>;
  updateChild(parentId: string, childId: string, patch: Partial<Pick<Child, "nickname" | "theme" | "exam">>): Promise<void>;
  deleteChild(parentId: string, childId: string): Promise<void>;

  createSession(s: Omit<PracticeSession, "id" | "startedAt">): Promise<PracticeSession>;
  getSession(parentId: string, sessionId: string): Promise<PracticeSession | null>;
  updateSession(parentId: string, sessionId: string, patch: Partial<PracticeSession>): Promise<void>;
  listSessions(parentId: string, childId: string): Promise<PracticeSession[]>;

  addPage(parentId: string, page: Omit<PageUpload, "id" | "createdAt">): Promise<PageUpload>;
  updatePage(parentId: string, pageId: string, patch: Partial<PageUpload>): Promise<void>;
  listPages(parentId: string, sessionId: string): Promise<PageUpload[]>;

  // Replaces all attempts of a session (re-reading a page re-creates them).
  replaceAttempts(parentId: string, sessionId: string, attempts: Omit<QuestionAttempt, "id" | "createdAt">[]): Promise<void>;
  updateAttempt(parentId: string, attemptId: string, patch: Partial<QuestionAttempt>): Promise<void>;
  listSessionAttempts(parentId: string, sessionId: string): Promise<QuestionAttempt[]>;
  listChildAttempts(parentId: string, childId: string): Promise<QuestionAttempt[]>;
  // Just the marks of every answer, without the text, feedback or handwriting: enough for scores and readiness.
  listAttemptScores(parentId: string, childId: string): Promise<AttemptScore[]>;

  createToken(t: Omit<UploadToken, "usedAt">): Promise<void>;
  getToken(token: string): Promise<UploadToken | null>;

  putImage(key: string, data: Buffer, contentType: string): Promise<void>;
  getImage(key: string): Promise<Buffer | null>;

  logAi(parentId: string, e: AiUsageEvent): Promise<void>;
  logActivity(parentId: string, e: ActivityEvent): Promise<void>;
}
