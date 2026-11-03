"use client";

import { ArrowLeft, ArrowUpRight, Check, CornerDownRight, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AskBars, AskRich } from "../askparts";
import { UiKbd } from "../ui";

// The Ask Exhibit palette (src/components/app/ask/AskPalette.tsx) with one recorded answer (records/ask.json): the
// input row, the question, the read-only steps, the answer, the chart, the cases and the follow-ups, then the footer.
// The body scrolls inside the palette after 600 px, as the app caps it. It renders complete; the page's Replay
// button (under the palette, not part of the app) plays it back the way it arrived. Reduced motion skips to the end.

type Step = { name: string; label: string; summary: string; ms: number };
type Chart = { title: string; labels: string[]; series: { name: string; values: number[]; tone: string }[] };
type Case = { id: string; buyer: string; reason: string; amount: number; decision: string; note: string; status?: string };

export function AskReplay({ question, steps, text, chart, cases, followups, provider }: { question: string; steps: Step[]; text: string; chart: Chart; cases: Case[]; followups: string[]; provider: string }) {
  // phase: 0 asking, 1..n steps done, n+1 streaming text, n+2 complete
  const done = steps.length + 2;
  const [phase, setPhase] = useState(done);
  const [chars, setChars] = useState(text.length);
  const timers = useRef<number[]>([]);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const replay = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    body.current?.scrollTo({ top: 0 });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase(done);
      setChars(text.length);
      return;
    }
    setPhase(0);
    setChars(0);
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    steps.forEach((_, i) => at(450 + i * 450, () => setPhase(i + 1)));
    const start = 450 + steps.length * 450 + 150;
    at(start, () => setPhase(steps.length + 1));
    const words = text.split(/(?<=\s)/);
    let acc = 0;
    words.forEach((w, i) => {
      acc += w.length;
      const n = acc;
      at(start + i * 14, () => setChars(n));
    });
    at(start + words.length * 14 + 200, () => setPhase(done));
  };

  const streaming = phase === steps.length + 1;
  const complete = phase === done;

  return (
    <div className="s-pr-askwrap">
      <div data-ui className="s-ui s-ui-window s-pr-ask" role="group" aria-label="Ask Exhibit, a recorded answer">
        <div className="s-f-pal">
          <div className="s-f-pal__in">
            <span className="s-f-pal__back" aria-hidden>
              <ArrowLeft strokeWidth={1.75} />
            </span>
            <span className="s-f-pal__tag">Ask Exhibit</span>
            <span className="s-f-pal__ph">{complete ? "Ask a follow-up…" : "Exhibit is answering…"}</span>
            <UiKbd>esc</UiKbd>
          </div>
          <div ref={body} className="s-f-pal__body s-f-pal__body--scroll s-pr-ask__body" tabIndex={0} aria-label="The answer">
            <section className="s-f-turn">
              <p className="s-f-turn__q">{question}</p>
              <div className="s-f-turn__steps">
                {steps.map((s, i) =>
                  phase > i ? (
                    <div key={s.name} className="s-f-turn__step">
                      <Check strokeWidth={2.25} aria-hidden />
                      <span>{s.summary}</span>
                      <em>{(s.ms / 1000).toFixed(1)} s</em>
                    </div>
                  ) : phase === i ? (
                    <div key={s.name} className="s-f-turn__step s-f-turn__step--run">
                      <i className="s-f-spin" aria-hidden />
                      <span>{s.label}…</span>
                    </div>
                  ) : null,
                )}
              </div>
              <div aria-live="polite">{phase >= steps.length + 1 ? <AskRich text={streaming ? text.slice(0, chars) : text} /> : null}</div>
              {complete ? (
                <>
                  <div className="s-f-chart">
                    <p className="s-f-chart__t">{chart.title}</p>
                    <AskBars chart={chart} width={640} />
                  </div>
                  <p className="s-f-turn__lbl">Cases</p>
                  <div className="s-f-cases">
                    {cases.map((c) => (
                      <div key={c.id} className="s-f-casecard">
                        <span className="s-f-casecard__tx">
                          <b>{c.buyer}</b>
                          <span>
                            {c.reason} · {c.note ?? c.status}
                          </span>
                        </span>
                        <span className="s-ui-mono s-f-casecard__amt">${Math.round(c.amount).toLocaleString("en-US")}</span>
                        <ArrowUpRight aria-hidden />
                      </div>
                    ))}
                  </div>
                  <div className="s-f-follow">
                    {followups.map((f) => (
                      <span key={f}>
                        <CornerDownRight aria-hidden />
                        <span className="s-f-follow__t">{f}</span>
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
          </div>
          <div className="s-f-pal__ft">
            <span className="s-f-pal__prov">
              <i />
              {provider}
              <span>· read-only, grounded in your records</span>
            </span>
            <span className="s-f-pal__keys" aria-hidden>
              <span>
                <UiKbd>⌫</UiKbd> back
              </span>
              <span>
                <UiKbd>⌘</UiKbd>
                <UiKbd>K</UiKbd>
              </span>
            </span>
          </div>
        </div>
      </div>
      <button type="button" className="s-pr-ask__replay" onClick={replay} disabled={!complete}>
        <RotateCcw aria-hidden /> Replay the answer
      </button>
    </div>
  );
}
