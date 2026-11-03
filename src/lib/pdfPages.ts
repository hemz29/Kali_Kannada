// A scanned answer sheet sent as a PDF becomes one JPEG photo per page, in the browser, so it goes through exactly the
// same upload, handwriting reading and marking as a photo. The PDF reader (Mozilla's pdf.js) only loads when a PDF is chosen.

export const MAX_PDF_PAGES = 10;
const LONG_SIDE = 2400; // the same size photos are shrunk to before upload

export class PdfError extends Error {}

export const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

// Friendly words for what went wrong (pdf.js names its errors).
export function pdfErrorMessage(err: unknown): string {
  if (err instanceof PdfError) return err.message;
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "PasswordException") return "That PDF is password-protected. Please save it without a password, or upload photos instead.";
  return "That PDF couldn't be opened. Please try another file, or upload photos of the pages instead.";
}

// Checks the page count before any page is drawn.
export function checkPageCount(pages: number) {
  if (pages < 1) throw new PdfError("That PDF has no pages.");
  if (pages > MAX_PDF_PAGES) throw new PdfError(`That PDF has ${pages} pages. Please upload at most ${MAX_PDF_PAGES} pages at a time (just the answer pages).`);
}

export async function pdfToPages(file: File): Promise<File[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  try {
    checkPageCount(doc.numPages);
    const out: File[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: LONG_SIDE / Math.max(base.width, base.height) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff"; // scans with transparent backgrounds would otherwise turn black as JPEG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new PdfError("A page couldn't be turned into a photo."))), "image/jpeg", 0.9));
      out.push(new File([blob], `${file.name.replace(/\.pdf$/i, "")}-page-${n}.jpg`, { type: "image/jpeg" }));
      page.cleanup();
    }
    return out;
  } finally {
    await task.destroy();
  }
}
