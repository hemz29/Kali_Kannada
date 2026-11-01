import { Wordmark } from "@/components/shell/Logo";
import { sectionPart, type Worksheet, type WorksheetSection } from "@/content";
import type { Question } from "@/content/schema";

// Printable worksheet in the school's paper format: Section A and B, bilingual instructions, marks per section
// as "(1X3=3)", answer lines. Kali Kannada's logo sits centred at the top; the school's name and logo are never used.
const WORD_TYPES = new Set(["meaning_kn", "meaning_en", "en_to_kn", "opposite", "gender", "plural", "split", "rhyme", "number_name"]);
const LINES: Record<string, number> = { one_sentence: 2, who_said: 1, own_sentence: 1, fill_blank: 0 };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function WorksheetPaper({ ws }: { ws: Worksheet }) {
  const partMarks = (p: "A" | "B") =>
    ws.sections.filter((s) => sectionPart(s.type) === p).reduce((t, s) => t + s.marksEach * s.questions.length, 0);
  let last = "";
  return (
    <article className="worksheet mx-auto bg-white text-black">
      <header className="relative text-center">
        <div className="mb-3 flex justify-center"><Wordmark size={28} /></div>
        <p className="pt-1 text-lg font-bold tracking-wide">GRADE VI · KANNADA 3rd LANGUAGE</p>
        <p className="kn mt-1 text-xl font-bold">{ws.title.kn}</p>
        <p className="text-sm">{ws.title.en}</p>
        <div className="mt-4 flex justify-between text-sm font-bold">
          <span>Duration: {ws.minutes === 60 ? "1 hour" : `${ws.minutes} minutes`}</span>
          <span>Max. Marks: {fmt(ws.totalMarks)}</span>
        </div>
        {/* A line of its own, with long, tall writing lines, so a child can write their name and date clearly. */}
        <div className="mt-7 flex items-end gap-8 text-left text-sm font-bold">
          <span className="flex flex-[3] items-end gap-2">NAME:<span className="h-9 flex-1 border-b border-black" /></span>
          <span className="flex flex-[1.3] items-end gap-2">DATE:<span className="h-9 flex-1 border-b border-black" /></span>
        </div>
      </header>
      <hr className="my-4 border-black" />
      {ws.sections.map((s, i) => {
        const part = sectionPart(s.type);
        const heading = !ws.retired && part !== last;
        last = part;
        return (
          <div key={s.type}>
            {heading && (
              <p className="mb-3 mt-1 text-center font-bold underline">
                Section – {part} ({fmt(partMarks(part))} Marks)
              </p>
            )}
            <Section n={i + 1} s={s} poemCues={ws.poemCues} />
          </div>
        );
      })}
      <p className="mt-6 text-center text-xs text-gray-500">When you finish, take a clear photo of each page in good light.</p>
    </article>
  );
}

function Section({ n, s, poemCues }: { n: number; s: WorksheetSection; poemCues?: string[] }) {
  const total = s.questions.length * s.marksEach;
  return (
    <section className="ws-section mb-5">
      <div className="flex items-start justify-between gap-4">
        <p className="font-bold">
          {n}. <span className="kn">{s.kn}</span>
          <br />
          <span className="ml-5 text-sm">({s.en})</span>
        </p>
        <span className="whitespace-nowrap text-sm font-bold">
          {s.type === "poem_line" ? `(${fmt(total)})` : `(${fmt(s.marksEach)}X${s.questions.length}=${fmt(total)})`}
        </span>
      </div>
      {WORD_TYPES.has(s.type) ? (
        <ol className="mt-2 grid grid-cols-2 gap-x-10 gap-y-4 pl-5">
          {s.questions.map((q, i) => (
            <li key={q.id} className="flex items-end gap-2">
              <span className="whitespace-nowrap">{i + 1}.</span>
              <span className={`${s.type === "en_to_kn" ? "" : "kn"} whitespace-nowrap text-lg`}>{q.prompt}</span>
              <span>–</span>
              <span className="flex-1 border-b border-dotted border-black">&nbsp;</span>
            </li>
          ))}
        </ol>
      ) : s.type === "poem_line" ? (
        <PoemLines questions={s.questions} cues={poemCues} />
      ) : (
        <ol className="mt-2 flex flex-col gap-3 pl-5">
          {s.questions.map((q, i) => (
            <li key={q.id}>
              <p className="kn text-lg">
                {i + 1}. {s.type === "fill_blank" ? q.prompt.replace("______", "_______________") : q.prompt}
              </p>
              {Array.from({ length: LINES[s.type] ?? 1 }).map((_, k) => (
                <div key={k} className="ml-5 h-9 border-b border-black/70" />
              ))}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// As on the school paper: the first word of the verse and the last word of its last line are printed;
// the child writes the four lines, then the poet's name.
function PoemLines({ questions, cues }: { questions: Question[]; cues?: string[] }) {
  const lines = questions.filter((q) => q.type === "poem_line");
  const poet = questions.find((q) => q.type === "poet_name");
  const stanzas: Question[][] = [];
  for (let i = 0; i < lines.length; i += 4) stanzas.push(lines.slice(i, i + 4));
  return (
    <div className="mt-2 flex flex-col gap-4 pl-5">
      {stanzas.map((st, si) => (
        <ol key={si} className="flex flex-col gap-1" aria-label={cues?.[si]}>
          {st.map((q, li) => (
            <li key={q.id} className="flex items-end gap-2">
              <span className="kn w-24 text-lg">{li === 0 ? q.prompt.replace(" …", "") : ""}</span>
              <span className="h-9 flex-1 border-b border-black/70" />
              {li === st.length - 1 && !cues && <span className="kn text-lg">{q.answers[0].split(" ").at(-1)}</span>}
            </li>
          ))}
        </ol>
      ))}
      {poet && (
        <p className="mt-2">
          <span className="kn">ಕವಿಯ ಹೆಸರು</span>: <span className="inline-block w-72 border-b border-dotted border-black">&nbsp;</span>
        </p>
      )}
    </div>
  );
}
