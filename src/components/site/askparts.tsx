import { Fragment } from "react";

// The pieces of the Ask Exhibit palette (src/components/app/ask/AskPalette.tsx, AskChart.tsx) that hold no data: the
// answer's light markdown and its bar chart. Shared by the server fragment and the client replay.

/** **bold** spans, as the palette renders them (AskPalette inline()). */
function inline(s: string, key: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={`${key}-${i}`}>{part}</Fragment>
    ),
  );
}

/** Paragraphs and "- " bullet runs (AskPalette Rich). */
export function AskRich({ text }: { text: string }) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const bullet = /^\s*[-•]\s/.test(raw);
    if (!raw.trim()) continue;
    const last = blocks.at(-1);
    if (last && last.list === bullet && (bullet || !last.list)) last.lines.push(bullet ? raw.replace(/^\s*[-•]\s/, "") : raw);
    else blocks.push({ list: bullet, lines: [bullet ? raw.replace(/^\s*[-•]\s/, "") : raw] });
  }
  return (
    <div className="s-f-rich">
      {blocks.map((b, i) =>
        b.list ? (
          <ul key={i}>
            {b.lines.map((l, j) => (
              <li key={j}>{inline(l, `${i}-${j}`)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{inline(b.lines.join(" "), `${i}`)}</p>
        ),
      )}
    </div>
  );
}

/** The axis rule the app's charts use (AskChart niceAxis): about four round steps that end just above the data. */
function niceAxis(maxVal: number) {
  const mag = 10 ** Math.floor(Math.log10(maxVal / 6));
  const step = [1, 2, 2.5, 5, 10, 20].map((m) => m * mag).find((st) => Math.ceil((maxVal * 1.02) / st) <= 6) ?? 20 * mag;
  return { max: Math.ceil((maxVal * 1.02) / step) * step, step };
}

const TONE: Record<string, string> = { green: "#15803d", red: "#b91c1c", grey: "#d9d9d6", ink: "#0a0a0a", amber: "#8a8a87" };

/** The answer's grouped bar chart as AG Charts draws it in the app: legend on top, $ axis, quiet grid, 2px corners. */
export function AskBars({ chart, width = 600 }: { chart: { title: string; labels: string[]; series: { name: string; values: number[]; tone?: string }[] }; width?: number }) {
  const H = 176;
  const top = 26;
  const bottom = 22;
  const left = 40;
  const peak = Math.max(0, ...chart.labels.map((_, i) => Math.max(...chart.series.map((s) => s.values[i] ?? 0))));
  const axis = niceAxis(peak);
  const ticks = Array.from({ length: Math.round(axis.max / axis.step) + 1 }, (_, i) => i * axis.step);
  const plotW = width - left - 4;
  const y = (v: number) => top + (H - top - bottom) * (1 - v / axis.max);
  const n = chart.labels.length;
  const step = plotW / (n - 0.38 + 0.3);
  const band = step * (1 - 0.38);
  const barW = band / chart.series.length;
  return (
    <svg className="s-f-chart__svg" width="100%" viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`${chart.title}: ${chart.labels.map((l, i) => `${l}, ${chart.series.map((s) => `${s.name} $${Math.round(s.values[i])}`).join(", ")}`).join("; ")}`}>
      <g className="s-f-chart__lg">
        {chart.series.map((s, i) => {
          const total = chart.series.reduce((a, x) => a + 14 + x.name.length * 6.4 + 18, 0) - 18;
          let x0 = (width - total) / 2;
          for (let k = 0; k < i; k++) x0 += 14 + chart.series[k].name.length * 6.4 + 18;
          return (
            <g key={s.name}>
              <rect x={x0} y={4} width={8} height={8} fill={TONE[s.tone ?? (i === 0 ? "ink" : "grey")]} />
              <text x={x0 + 14} y={12}>
                {s.name}
              </text>
            </g>
          );
        })}
      </g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={width} y1={y(t)} y2={y(t)} stroke="#f1f1f0" />
          <text x={left - 8} y={y(t) + 4} textAnchor="end" className="s-f-chart__tick">
            ${t}
          </text>
        </g>
      ))}
      {chart.labels.map((label, gi) => {
        const x0 = left + step * 0.15 + gi * step;
        return (
          <g key={label}>
            {chart.series.map((s, si) => {
              const v = s.values[gi] ?? 0;
              const h = H - bottom - y(v);
              return v > 0 ? <rect key={s.name} x={x0 + si * barW} y={y(v)} width={barW} height={Math.max(1, h)} rx={2} fill={TONE[s.tone ?? (si === 0 ? "ink" : "grey")]} /> : null;
            })}
            <text x={x0 + band / 2} y={H - 4} textAnchor="middle" className="s-f-chart__tick">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
