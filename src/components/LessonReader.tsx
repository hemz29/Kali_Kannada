"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Lesson } from "@/content/schema";
import { transliterate } from "@/lib/transliterate";
import { KnText, ReadFromContext } from "@/components/Word";
import { LineIcon } from "@/components/LineIcon";
import audio from "@/content/audio.json";
import { ReadAloudControls } from "@/components/ReadAloudControls";
import { onStopAudio, stopOtherAudio, useReadAloud } from "@/lib/readAloud";
import { stats } from "@/lib/localStats";

// Sentences with recorded Kannada speech (made by scripts/tts.mjs) as "<lessonId>/<sentenceId>", and the voices they were made with.
// FROM_WORD sentences also have "<sentenceId>-w<n>" files, read from word n onwards.
const HAS_AUDIO = new Set<string>(audio.sentences);
const FROM_WORD = new Set<string>((audio as { fromWord?: string[] }).fromWord ?? []);

type Sentence = { id: string; kn: string; en: string };

const titleCase = (s: string) => s.replace(/(^|\s)(\S)/g, (_, sp, c) => sp + c.toUpperCase());

export function LessonReader({ lesson }: { lesson: Lesson }) {
  const [showTr, setShowTr] = useState(true);
  const [showEn, setShowEn] = useState(true);
  // Read aloud: one <audio> element plays a queue of sentences (one sentence, or a whole part).
  const { voice, rate } = useReadAloud();
  const [queue, setQueue] = useState<string[]>([]);
  const player = useRef<HTMLAudioElement | null>(null);
  // The queue holds audio file names; a sentence read from a word onwards plays "<key>-w<n>".
  const playing = queue[0]?.replace(/-w\d+$/, "") ?? null;
  const key = (id: string) => `${lesson.id}/${id}`;
  useEffect(() => {
    const a = player.current;
    if (!a) return;
    if (!playing) return a.pause();
    stopOtherAudio(player);
    a.src = `/audio/${voice}/${queue[0]}.mp3`;
    a.play().catch(() => setQueue([]));
    stats.listened(lesson.id);
  }, [queue[0], voice]); // eslint-disable-line react-hooks/exhaustive-deps
  // A word played elsewhere on the page stops the reading.
  useEffect(() => onStopAudio(player, () => setQueue([])), []);
  useEffect(() => {
    const a = player.current;
    if (!a) return;
    a.preservesPitch = true;
    a.defaultPlaybackRate = a.playbackRate = rate; // the default carries over to the next sentence's file
  }, [rate]);
  // Tapping a Listen button again while it is reading stops it.
  const play = (ids: string[]) => setQueue(playing && ids.includes(playing) ? [] : ids);
  // Tapping a word reads from it to the end of the part. Restarting from a word never toggles playback off.
  const readFrom = (sentences: Sentence[], i: number, w: number) => {
    const rest = sentences.slice(i).filter((x) => HAS_AUDIO.has(key(x.id))).map((x) => key(x.id));
    if (!rest.length || rest[0] !== key(sentences[i].id)) return;
    if (w > 0 && FROM_WORD.has(rest[0])) rest[0] += `-w${w}`;
    if (rest[0] === queue[0] && player.current) player.current.currentTime = 0; // same word again: start it over
    setQueue(rest);
  };

  const blocks: { heading?: { kn: string; en: string }; sentences: Sentence[]; intro?: boolean }[] = [
    ...(lesson.intro.length ? [{ heading: { kn: "ಪಾಠ ಪ್ರವೇಶ", en: "Introduction" }, sentences: lesson.intro, intro: true }] : []),
    ...lesson.parts,
  ];

  return (
    <div className="flex flex-col gap-5">
      <audio ref={player} onEnded={() => setQueue((q) => q.slice(1))} preload="none" />
      <Link href="/learn/lessons" className="text-sm font-bold text-accent">← Back</Link>
      <div className="card bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="mr-auto">
            <h1 className="text-3xl font-bold"><KnText text={lesson.title.kn} /></h1>
            <p className="mt-1 text-xl font-bold">
              {titleCase(transliterate(lesson.title.kn.replace(/\s*\(.*\)\s*$/, "")))}{" "}
              <span className="font-normal text-muted">({lesson.kind})</span>
            </p>
            {lesson.author.en && <p className="mt-0.5 text-sm text-muted">{lesson.author.en}</p>}
          </div>
          <Link href={`/learn/cards/${lesson.id}`} className="btn btn-soft max-sm:!hidden">Practise →</Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Toggle on={showTr} set={setShowTr} label="Sound it out" title="Kannada written in English letters" />
          <Toggle on={showEn} set={setShowEn} label="English meaning" />
          <p className="text-sm text-muted sm:ml-3">
            Tap any word for its sound and meaning
            {/* Only the lessons in the teacher's review (26 Oct 2026); English lines for newer lessons aren't reviewed yet. */}
            {lesson.number < 17 && <> · <span className="text-good">checked by a Kannada teacher</span></>}
          </p>
        </div>
      </div>

      {blocks.map((b, bi) => (
        <section key={bi} className="paper overflow-hidden">
          {b.heading && (
            <h2 className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-gray-100 bg-gray-50 px-5 py-3 font-sans font-bold">
              <span><KnText text={b.heading.kn} /> <span className="text-gray-500">· {b.heading.en}</span></span>
              {b.sentences.some((x) => HAS_AUDIO.has(key(x.id))) && (
                <span className="ml-auto flex items-center gap-1.5 font-medium">
                  <ReadAloudControls />
                  <button
                    onClick={() => play(b.sentences.filter((x) => HAS_AUDIO.has(key(x.id))).map((x) => key(x.id)))}
                    className="ml-1 flex items-center gap-1.5 rounded-full bg-black px-3 py-1 text-sm text-[var(--brand-yellow)]"
                  >
                    <LineIcon name="sound" size={16} /> {b.sentences.some((x) => key(x.id) === playing) && queue.length > 1 ? "Stop" : "Listen to this part"}
                  </button>
                </span>
              )}
            </h2>
          )}
          <ol className={lesson.kind === "poem" && !b.intro ? "py-2" : "divide-y divide-gray-100"}>
            {b.sentences.map((s, si) => (
              <li key={s.id} className={`grid gap-3 px-5 ${lesson.kind === "poem" && !b.intro ? "py-1.5" : "py-3"} ${showEn ? "md:grid-cols-2" : ""}`}>
                <div className={playing === key(s.id) ? "-mx-2 rounded-xl bg-accent-soft px-2" : ""}>
                  <p className="text-[1.45rem] leading-relaxed">
                    {HAS_AUDIO.has(key(s.id)) && (
                      <button
                        onClick={() => play([key(s.id)])}
                        aria-label={playing === key(s.id) ? "Stop" : "Listen"}
                        title={playing === key(s.id) ? "Stop" : "Listen"}
                        className={`mr-2 inline-grid h-8 w-8 place-items-center rounded-full align-middle ${playing === key(s.id) ? "bg-black text-[var(--brand-yellow)]" : "bg-[#f2f2f2] text-black hover:bg-black hover:text-white"}`}
                      >
                        <LineIcon name="sound" size={16} />
                      </button>
                    )}
                    <ReadFromContext.Provider value={HAS_AUDIO.has(key(s.id)) ? (w) => readFrom(b.sentences, si, w) : null}>
                      <KnText text={s.kn} />
                    </ReadFromContext.Provider>
                  </p>
                  {showTr && <p className="mt-0.5 text-[0.95rem] italic text-gray-500">{transliterate(s.kn)}</p>}
                </div>
                {showEn && <p className="self-center text-gray-700">{s.en}</p>}
              </li>
            ))}
          </ol>
        </section>
      ))}

      {lesson.summaryEn.length > 0 && (
        <section className="card p-5">
          <h2 className="text-lg font-bold">What the poem is about</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {lesson.summaryEn.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </section>
      )}

      <section className="paper p-5">
        <h2 className="text-lg"><KnText text="ಪದಗಳ ಅರ್ಥ" /> · Word meanings from your teacher&apos;s notes</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {lesson.glossary.map((g) => (
            <div key={g.word}>
              <dt className="text-xl font-bold"><KnText text={g.word} /> <span className="text-sm font-normal italic text-gray-500">{transliterate(g.word)}</span></dt>
              <dd className="text-gray-700"><KnText text={g.meaningKn} /> <span className="text-gray-500">· {g.meaningEn}</span></dd>
            </div>
          ))}
        </dl>
      </section>

      <Link href={`/learn/cards/${lesson.id}`} className="btn btn-primary self-center px-8">Done reading? Practise this lesson →</Link>
    </div>
  );
}

function Toggle({ on, set, label, title }: { on: boolean; set: (v: boolean) => void; label: string; title?: string }) {
  return (
    <button onClick={() => set(!on)} title={title} aria-pressed={on} className={`rounded-full border px-3 py-1 text-sm ${on ? "border-black bg-black text-[var(--brand-yellow)]" : "border-line bg-white text-muted hover:border-black"}`}>
      {label}
    </button>
  );
}

