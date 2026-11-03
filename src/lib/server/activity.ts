import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { deviceOf } from "@/lib/device";
import type { ActivityEvent, PracticeSession, Store } from "@/lib/store/types";
import { getWorksheet } from "@/content";
import { writingEnd } from "@/lib/time";

// Activity logging and the timer's end time are extras: if the database hasn't got the 0002 update yet,
// the app carries on without them.
// Each event notes the kind of device (phone, tablet or computer), so the pilot shows how families really use Kali Kannada.
// Saved after the response is sent, so recording a visit never slows the page down.
export async function logActivity(store: Store, parentId: string, e: ActivityEvent) {
  let device: string | null = null;
  try {
    device = deviceOf((await headers()).get("user-agent"));
  } catch {
    // No request headers (e.g. called outside a request): log without the device.
  }
  after(async () => {
    try {
      await store.logActivity(parentId, { ...e, detail: { ...e.detail, device } });
    } catch (err) {
      console.warn("activity not logged", err instanceof Error ? err.message : err);
    }
  });
}

export async function noteWritingDone(store: Store, session: PracticeSession) {
  if (session.writingDoneAt || session.kind !== "worksheet") return;
  try {
    // Pages sent long after the time was up count as finishing when the timer stopped (15 minutes over).
    const minutes = getWorksheet(session.worksheetId)?.minutes ?? 60;
    await store.updateSession(session.parentId, session.id, { writingDoneAt: new Date(writingEnd(session.startedAt, null, minutes)).toISOString() });
  } catch (err) {
    console.warn("writing time not saved", err instanceof Error ? err.message : err);
  }
}
