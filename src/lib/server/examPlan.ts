import "server-only";
import { isDemo, serviceClient } from "./context";
import type { Child, ExamPlan, Store } from "@/lib/store/types";

// The child's exam (date + chapters) lives in children.exam (migration 0004). Until that one-time database update is
// run, it's kept in the parent account's app_metadata instead (server-only, so the readiness meter works either way).

type Meta = { exams?: Record<string, ExamPlan> };
const columnMissing = (child: Child) => !isDemo && !("exam" in child);

async function metaExams(parentId: string): Promise<Record<string, ExamPlan>> {
  const { data } = (await serviceClient()?.auth.admin.getUserById(parentId)) ?? { data: null };
  return ((data?.user?.app_metadata ?? {}) as Meta).exams ?? {};
}

// The child with its exam filled in, from wherever it is stored.
export async function withExam<C extends Child | null>(parentId: string, child: C): Promise<C> {
  if (!child || !columnMissing(child)) return child;
  return { ...child, exam: (await metaExams(parentId))[child.id] ?? null };
}

export async function saveExamPlan(store: Store, parentId: string, child: Child, plan: ExamPlan) {
  if (!columnMissing(child)) {
    try {
      await store.updateChild(parentId, child.id, { exam: plan });
      return;
    } catch (err) {
      console.warn("exam column not available, saving to the account instead", err instanceof Error ? err.message : err);
    }
  }
  const db = serviceClient();
  if (!db) throw new Error("exam can't be saved");
  const { data } = await db.auth.admin.getUserById(parentId);
  const meta = data.user?.app_metadata ?? {};
  await db.auth.admin.updateUserById(parentId, { app_metadata: { ...meta, exams: { ...((meta as Meta).exams ?? {}), [child.id]: plan } } });
}
