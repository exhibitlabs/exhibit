import { clsx } from "clsx";
import { Check, Search } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Container, DecisionPill, Heading, Panel, Provenance, Section, utcDateTime } from "./Primitives";
import ask from "./records/ask.json";

const MODEL_NAME: Record<string, string> = { "claude-opus-5-5": "Claude Opus 5.5" };

/** Renders the answer exactly as filed: "- " lines become bullets, **x** becomes bold. */
function Rich({ text }: { text: string }) {
  const bold = (s: string): ReactNode[] => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>));
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length)
      blocks.push(
        <ul key={`l${blocks.length}`} className="space-y-1.5 pl-4">
          {list.map((l) => (
            <li key={l} className="list-disc marker:text-muted">
              {bold(l)}
            </li>
          ))}
        </ul>,
      );
    list = [];
  };
  for (const line of text.split("\n")) {
    if (line.startsWith("- ")) list.push(line.slice(2));
    else {
      flush();
      if (line.trim()) blocks.push(<p key={`p${blocks.length}`}>{bold(line)}</p>);
    }
  }
  flush();
  return <div className="space-y-2.5 text-[14px] leading-relaxed text-ink-2">{blocks}</div>;
}

const TONE: Record<string, string> = { ink: "#0a0a0a", green: "#15803d", grey: "#a1a1a1", red: "#b91c1c", amber: "#e8a33d" };
const LABEL: Record<string, string> = { FIGHT: "Fight", REFUND: "Refund", OFFER: "Offer", MESSAGE_BUYER: "Message" };

function Chart() {
  const c = ask.answer.chart;
  const max = Math.max(...c.series.flatMap((s) => s.values));
  const top = Math.ceil(max / 150) * 150;
  const ticks = [0, top / 3, (2 * top) / 3, top];
  const W = 420;
  const H = 230;
  const pad = { l: 44, r: 8, t: 14, b: 34 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const group = plotW / c.labels.length;
  const barW = 34;
  const gap = 8;
  const y = (v: number) => pad.t + plotH - (v / top) * plotH;
  const money = (v: number) => `$${v % 1 ? v.toFixed(2) : v}`;
  return (
    <figure className="min-w-0">
      <figcaption className="text-[12.5px] font-medium text-ink">{c.title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={c.labels.map((l, i) => `${LABEL[l] ?? l}: ${c.series.map((s) => `${s.name} ${money(s.values[i])}`).join(", ")}`).join("; ")}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#efefef" />
            <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" className="fill-muted text-[10px]" style={{ fontFamily: "var(--font-mono)" }}>
              ${t}
            </text>
          </g>
        ))}
        {c.labels.map((label, i) => {
          const gx = pad.l + group * i + group / 2 - (barW * c.series.length + gap * (c.series.length - 1)) / 2;
          return (
            <g key={label}>
              {c.series.map((s, j) => {
                const v = s.values[i];
                const x = gx + j * (barW + gap);
                return (
                  <g key={s.name}>
                    <rect x={x} y={y(v)} width={barW} height={Math.max(0, pad.t + plotH - y(v))} rx="3" fill={TONE[s.tone ?? "ink"]} />
                    <text x={x + barW / 2} y={y(v) - 6} textAnchor="middle" className="fill-ink-2 text-[10.5px]" style={{ fontFamily: "var(--font-mono)" }}>
                      {money(v)}
                    </text>
                  </g>
                );
              })}
              <text x={pad.l + group * i + group / 2} y={H - 12} textAnchor="middle" className="fill-muted text-[11.5px]">
                {LABEL[label] ?? label}
              </text>
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="#dcdcdc" />
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
        {c.series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: TONE[s.tone ?? "ink"] }} aria-hidden />
            {s.name}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function Ask() {
  const model = MODEL_NAME[ask.model ?? ""] ?? ask.model;
  return (
    <Section id="ask" label="Ask Exhibit" className="border-t border-line bg-[#fafafa]">
      <Container>
        <Heading
          kicker="Ask Exhibit"
          title="Ask about your whole dispute book."
          rest="Get answers you can check."
          lede="Exhibit answers from your PayPal records through read-only tools. Chart values and case ids are checked against what those tools returned, and an answer that doesn't match is sent back to be fixed."
        />

        <Panel className="mt-12 shadow-[0_1px_2px_rgb(0_0_0/0.03),0_24px_60px_-36px_rgb(10_10_10/0.25)]">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <p className="min-w-0 flex-1 text-[14.5px] text-ink">{ask.question}</p>
            <kbd className="num hidden shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted sm:inline">⌘K</kbd>
          </div>
          <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="min-w-0 px-4 py-5 sm:px-5 lg:border-r lg:border-line">
              <ol className="num space-y-1.5 text-[11.5px]">
                {ask.steps.map((s) => (
                  <li key={s.name} className="flex min-w-0 items-center gap-2">
                    <Check className="size-3.5 shrink-0 text-green" strokeWidth={3} aria-hidden />
                    <span className="shrink-0 text-ink">{s.name}</span>
                    <span className="min-w-0 truncate font-sans text-muted">{s.summary}</span>
                    <span className="ml-auto shrink-0 text-muted">{s.ms} ms</span>
                  </li>
                ))}
              </ol>
              <div className="mt-5">
                <Rich text={ask.answer.text} />
              </div>
              <ul className="mt-5 flex flex-wrap gap-2">
                {ask.answer.cases.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px]">
                    <DecisionPill decision={c.decision as "FIGHT" | "REFUND"} className="h-[18px] px-1.5 text-[10.5px]" />
                    <span className="font-medium text-ink">{c.buyer}</span>
                    <span className="num text-muted">${c.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={clsx("min-w-0 border-t border-line px-4 py-5 sm:px-5 lg:border-t-0")}>
              <Chart />
              <div className="mt-6 border-t border-line pt-4">
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Suggested next</div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {ask.answer.followups.map((f) => (
                    <li key={f} className="rounded-full border border-line bg-white px-2.5 py-1 text-[12px] text-ink-2">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Panel>
        <Provenance className="mt-5">
          A live answer from {model} over the PayPal sandbox account, {utcDateTime(ask.capturedAt)}, in {((ask.ms ?? 0) / 1000).toFixed(1)} s. Shown exactly as filed, including the chart values.
        </Provenance>
      </Container>
    </Section>
  );
}
