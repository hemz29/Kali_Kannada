"use client";
import { useRef } from "react";

// "How is this worked out?": the readiness rules in plain words (they mirror lib/readiness.ts), plus the handwriting note.
// A centred pop-up on a computer, a sheet from the bottom on a phone.
export function ReadinessInfo({ className = "" }: { className?: string }) {
  const box = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault(); // inside a link (the home tile), open the pop-up instead of following the link
          e.stopPropagation();
          box.current?.showModal();
        }}
        className={`inline-flex items-center gap-1 text-sm font-medium text-muted underline decoration-dotted underline-offset-4 hover:text-ink ${className}`}
      >
        <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full border border-current text-[10px] font-bold no-underline">i</span>
        How is this worked out?
      </button>
      <dialog
        ref={box}
        onClick={(e) => e.target === box.current && box.current?.close()}
        className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-white p-0 text-ink backdrop:bg-black/40 sm:m-auto sm:max-w-xl sm:rounded-3xl"
      >
        <div className="max-h-[80vh] overflow-y-auto p-6 text-sm leading-relaxed">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold">How exam readiness is worked out</h2>
            <button type="button" onClick={() => box.current?.close()} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-lg">×</button>
          </div>
          <p className="mt-3">
            We look at the practice papers your child wrote in the <b>last two weeks</b>: how many answers were right, added up the way the school paper is
            marked. No AI is used for it.
          </p>
          <ol className="mt-4 flex list-decimal flex-col gap-3 pl-5">
            <li><b>Which papers count.</b> Worksheets and practice tests on the exam&apos;s chapters, written in the last 2 weeks. If a paper was done twice, only the latest try counts. Quick tap cards are practice and don&apos;t change the number.</li>
            <li><b>Only correct answers earn marks.</b> A wrong answer counts the same as a blank one. The checks below never add marks; they only show what&apos;s left before Exam ready.</li>
            <li><b>The likely mark.</b> For each part of the paper (meanings, opposites, one-sentence answers, the poem…) we take the share of answers that were right, and add the parts up by the marks the school paper gives them. An answer written with a hint counts half.</li>
            <li><b>The range.</b> &quot;Likely 30–34&quot; is the likely mark ±2 once there are 4 or more papers, or ±4 with fewer.</li>
            <li>
              <b>Checks</b>, like a parent would make at home, after correct answers: attempts every question · careful spelling (2 or fewer slips a paper) · answers complete for the marks · finishes in time · 4 different papers in 2 weeks. Until most answers are right, only the paper count is shown.
            </li>
            <li><b>The levels.</b> Just starting (under 50%) · Getting there (50–69%) · Nearly ready (70–84%) · Exam ready: about 34 out of 40 or more <i>and</i> all five checks done.</li>
            <li><b>When it shows.</b> After a parent chooses the exam chapters in Parent view and the first practice paper is written.</li>
          </ol>
          <HandwritingNote className="mt-5" />
        </div>
      </dialog>
    </>
  );
}

export function HandwritingNote({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-2xl bg-warn-soft p-4 text-sm text-warn ${className}`}>
      <b>Handwriting matters.</b> In the exam, marks depend on whether the teacher can read and understand the child&apos;s writing, and how they choose to mark it. Kali Kannada reads handwriting from photos, which isn&apos;t the same as a teacher reading it. The meter can&apos;t predict the exam exactly.
    </p>
  );
}
