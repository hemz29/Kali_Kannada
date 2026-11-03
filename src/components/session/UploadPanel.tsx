"use client";
import { useState } from "react";
import imageCompression from "browser-image-compression";
import type { SessionState } from "./SessionView";
import { LineIcon } from "@/components/LineIcon";
import { isPdf, pdfErrorMessage } from "@/lib/pdfPages";

const PAGE_STATUS: Record<string, string> = {
  received: "Received",
  reading: "Reading your handwriting…",
  read: "Read ✓",
  failed: "Couldn't read",
};

// Shrinks a photo in the browser before upload (keeps handwriting sharp, stays well under server limits).
export async function compressPage(file: File) {
  return imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 2400, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.85 });
}

// Standalone it is a card; `inline` lays it out as a row inside the writing block, next to the timer.
export function UploadPanel({ state, onOpen, refresh, inline = false }: { state: SessionState; onOpen: () => void; refresh: () => void; inline?: boolean }) {
  const { session, pages } = state;
  const [qr, setQr] = useState<{ svg: string; url: string } | null>(null);
  const [busy, setBusy] = useState<"" | "pdf" | "upload">("");
  const [error, setError] = useState("");
  const open = qr !== null || pages.length > 0;

  // Pressing either upload button means writing is over: stop the timer.
  const finishWriting = () => fetch(`/api/sessions/${session.id}/done`, { method: "POST" }).then(refresh, () => undefined);

  async function showQr() {
    setError("");
    onOpen();
    finishWriting();
    const res = await fetch(`/api/sessions/${session.id}/token`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Couldn't make the QR code.");
    setQr({ svg: data.qrSvg, url: data.url });
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy("upload");
    setError("");
    onOpen();
    finishWriting();
    // A PDF (e.g. from a scanner) becomes one photo per page first, then every page uploads like a photo.
    const photos: File[] = [];
    for (const f of Array.from(files)) {
      if (!isPdf(f)) {
        photos.push(f);
        continue;
      }
      setBusy("pdf");
      try {
        const { pdfToPages } = await import("@/lib/pdfPages");
        photos.push(...(await pdfToPages(f)));
      } catch (err) {
        setError(pdfErrorMessage(err));
      }
      setBusy("upload");
    }
    for (const f of photos) {
      try {
        const small = await compressPage(f);
        const body = new FormData();
        body.append("page", small, "page.jpg");
        const res = await fetch(`/api/sessions/${session.id}/pages`, { method: "POST", body });
        if (!res.ok) setError((await res.json()).error ?? "Upload failed.");
      } catch {
        setError("That file isn't a photo or PDF we can read. Please choose a JPG or PNG photo, or a PDF.");
      }
    }
    setBusy("");
    refresh();
  }

  const reading = pages.some((p) => p.status === "received" || p.status === "reading");

  const fromComputer = (
    <label title="Photos or a PDF" className={`btn btn-ghost cursor-pointer ${inline ? "w-full whitespace-nowrap" : ""}`}>
      {busy === "pdf" ? "Preparing PDF…" : busy ? "Uploading…" : inline ? <><LineIcon name="laptop" size={20} /> From this computer</> : "Upload photos or a PDF from this computer"}
      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" multiple className="sr-only" disabled={Boolean(busy)} onChange={(e) => uploadFiles(e.target.files)} />
    </label>
  );
  const qrBlock = qr && (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: qr.svg }} />
      <p className="font-bold">Scan with the phone camera</p>
      <p className="text-sm text-muted">The link works for 30 minutes. Photos appear here as soon as they arrive.</p>
    </div>
  );
  const pageList = pages.length > 0 && (
    <ul className="flex flex-col gap-2">
      {pages.map((p, i) => (
        <li key={p.id} className={`rounded-xl px-3 py-2 text-sm ${p.status === "failed" ? "bg-bad-soft" : p.status === "read" ? "bg-good-soft" : "bg-accent-soft"}`}>
          <span className="font-bold">Page {i + 1}:</span> {PAGE_STATUS[p.status]}
          {p.status === "reading" && <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent align-middle" />}
          {p.error && <p className="mt-1">{p.error}</p>}
        </li>
      ))}
    </ul>
  );
  const readingNote = reading && <p className="text-sm text-muted">Reading takes about a minute per page. You can send more pages meanwhile.</p>;
  const errorNote = error && <p className="text-sm text-bad">{error}</p>;

  if (inline)
    return (
      <>
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="min-w-0 leading-tight sm:mr-auto">
            <span className="block text-lg font-extrabold">Finished writing?</span>
            <span className="text-sm text-muted">Send a photo of each page (or a PDF) to be marked.</span>
          </p>
          {/* Both buttons the same size, side by side (stacked on a phone). */}
          <div className={`grid gap-2 ${qr ? "" : "sm:grid-cols-2"}`}>
            {!qr && <button onClick={showQr} className="btn btn-primary w-full whitespace-nowrap"><LineIcon name="camera" size={20} /> From a phone</button>}
            {fromComputer}
          </div>
        </div>
        {(qrBlock || pageList || readingNote || errorNote) && (
          <div className="flex basis-full flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-start sm:gap-6">
            {qrBlock}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {pageList}
              {readingNote}
              {errorNote}
            </div>
          </div>
        )}
      </>
    );

  return (
    <div className="card flex flex-col gap-4 p-5">
      <h2 className="text-xl font-extrabold">Finished writing?</h2>
      {!open ? (
        <>
          <p className="text-muted">Take a photo of each page with a phone. We&apos;ll read your handwriting and mark it.</p>
          <button onClick={showQr} className="btn btn-primary"><LineIcon name="camera" size={20} /> Send photos from a phone</button>
        </>
      ) : (
        <>
          {qrBlock || <button onClick={showQr} className="btn btn-soft">Show QR code for a phone</button>}
          {pageList}
          {readingNote}
        </>
      )}
      {fromComputer}
      {errorNote}
    </div>
  );
}
