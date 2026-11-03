import { NextResponse } from "next/server";
import { getWorksheet } from "@/content";
import { getParent, userStore } from "@/lib/server/context";
import { logActivity } from "@/lib/server/activity";

// Changes with every deploy, so cached worksheet PDFs (kept 14 days, see next.config.ts) are refreshed after an update.
const VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";

// Notes the download for the admin page, then hands over the worksheet's ready-made PDF.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getWorksheet(id)) return new Response("Not found", { status: 404 });
  const parent = await getParent();
  if (parent) await logActivity(await userStore(), parent.id, { kind: "worksheet_download", path: `/worksheets/${id}.pdf`, detail: { worksheetId: id } });
  return NextResponse.redirect(new URL(`/worksheets/${id}.pdf?v=${VERSION}`, req.url));
}
