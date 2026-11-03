import { describe, expect, it } from "vitest";
import { checkPageCount, isPdf, MAX_PDF_PAGES, pdfErrorMessage, PdfError } from "@/lib/pdfPages";

describe("PDF uploads", () => {
  it("recognises PDFs by type or name", () => {
    expect(isPdf(new File([""], "answers.pdf", { type: "application/pdf" }))).toBe(true);
    expect(isPdf(new File([""], "SCAN.PDF", { type: "" }))).toBe(true);
    expect(isPdf(new File([""], "page.jpg", { type: "image/jpeg" }))).toBe(false);
  });
  it("accepts 1 to 10 pages and explains anything else", () => {
    expect(() => checkPageCount(1)).not.toThrow();
    expect(() => checkPageCount(MAX_PDF_PAGES)).not.toThrow();
    expect(() => checkPageCount(0)).toThrow(PdfError);
    expect(() => checkPageCount(11)).toThrow(/at most 10 pages/);
  });
  it("turns pdf.js errors into plain words", () => {
    expect(pdfErrorMessage({ name: "PasswordException" })).toMatch(/password-protected/);
    expect(pdfErrorMessage(new Error("Invalid PDF structure"))).toMatch(/couldn't be opened/);
    expect(pdfErrorMessage(new PdfError("That PDF has no pages."))).toBe("That PDF has no pages.");
  });
});
