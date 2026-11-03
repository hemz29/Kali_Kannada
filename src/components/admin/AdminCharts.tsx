"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Small monochrome charts for the admin page: black for the main series, grey for the second, yellow to highlight.
const INK = "#000";
const GREY = "#b5b5b5";
const YELLOW = "#fbce1a";
const axis = { tickLine: false, axisLine: false, fontSize: 11 } as const;

type Row = Record<string, string | number>;

function Frame({ title, note, children }: { title: string; note?: string; children: React.ReactElement }) {
  return (
    <section className="card flex flex-col gap-1 p-4">
      <h2 className="text-sm font-bold">{title}</h2>
      {note && <p className="text-xs text-muted">{note}</p>}
      <div className="mt-2 h-48">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </section>
  );
}

export function GrowthChart({ data }: { data: Row[] }) {
  return (
    <Frame title="Families and children registered" note="Running total, by week">
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -25 }}>
        <CartesianGrid stroke="#eee" vertical={false} />
        <XAxis dataKey="week" {...axis} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="parents" name="Parents" stroke={INK} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="children" name="Children" stroke={YELLOW} strokeWidth={2} dot={false} />
      </LineChart>
    </Frame>
  );
}

export function Bars({ title, note, data, x, bars, horizontal, decimals }: {
  title: string; note?: string; data: Row[]; x: string; bars: { key: string; name: string }[]; horizontal?: boolean; decimals?: boolean;
}) {
  const colours = [INK, GREY];
  return (
    <Frame title={title} note={note}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 5, right: 10, bottom: 0, left: horizontal ? 10 : decimals ? 0 : -25 }}>
        <CartesianGrid stroke="#eee" vertical={!!horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" allowDecimals={false} {...axis} />
            <YAxis type="category" dataKey={x} width={130} {...axis} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} {...axis} interval="preserveStartEnd" />
            <YAxis allowDecimals={Boolean(decimals)} {...axis} />
          </>
        )}
        <Tooltip cursor={{ fill: "#f5f5f5" }} />
        {bars.length > 1 && <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />}
        {bars.map((b, i) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={colours[i]} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={28} />)}
      </BarChart>
    </Frame>
  );
}
