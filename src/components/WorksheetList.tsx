import { ChoiceCard, type Tone } from "@/components/shell/PageHeader";
import type { Worksheet } from "@/content";
import { KnText } from "@/components/Word";

export function WorksheetList({ worksheets, done, tone }: { worksheets: Worksheet[]; done: Map<string, number>; tone: Tone }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {worksheets.map((w) => (
        <ChoiceCard
          key={w.id}
          href={`/learn/worksheet/${w.id}`}
          tone={tone}
          title={w.title.en}
          sub={<KnText text={w.title.kn} mode="hover" />}
          badge={done.get(w.id) ? <span className="chip bg-good-soft text-good">Done ×{done.get(w.id)}</span> : <span className="chip bg-white/80">New</span>}
        >
          <span className="text-sm font-bold text-muted">{w.oralMarks ? `${w.totalMarks + w.oralMarks} marks (${w.totalMarks} written + ${w.oralMarks} oral)` : `${w.totalMarks} marks`} · {w.minutes === 60 ? "1 hour" : `${w.minutes} minutes`}</span>
        </ChoiceCard>
      ))}
    </div>
  );
}
