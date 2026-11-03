import "./company.css";
import { clsx } from "clsx";
import type { CSSProperties } from "react";
import heroRuns from "@/components/landing/records/hero-runs.json";
import { DrawerHeadView, DrawerSuccess } from "../drawer";
import { LENA_DRAWER } from "../facts";
import { LENA_ORDER } from "../fragments";
import { UiPill } from "../ui";

// Case fragments for the company pages, rebuilt from the app's brief card and prevention drawer with values from the
// landing records only. Each root carries data-ui like the kit's fragments.

/** The app's Seller Protection labels (ResponsePanel), read off the check's own summary in the run. */
function protectionOf(summary: string | undefined) {
  if (!summary) return null;
  if (/^likely eligible/i.test(summary)) return { label: "Likely protected", tone: "green" };
  if (/^not eligible/i.test(summary)) return { label: "Not protected", tone: "red" };
  if (/^at risk/i.test(summary)) return { label: "At risk", tone: "neutral" };
  if (/^not applicable/i.test(summary)) return { label: "Not covered", tone: "neutral" };
  return null;
}

/**
 * The top of the app's brief card (src/components/app/case/BriefCard.tsx) for a recorded sandbox run
 * (records/hero-runs.json): the call, the confidence and the run's clock, the headline, the summary's first sentence,
 * and the four figures. A dash in the model's headline is set as a colon, as the site's copy rules ask.
 */
export function BriefCard({ run, className }: { run: "fight" | "refund" | "refund2"; className?: string }) {
  const r = heroRuns[run];
  const b = r.brief;
  const amount = r.claim.amount;
  const expected = b.decision === "FIGHT" ? (b.winLikelihood / 100) * amount : 0;
  const money = (n: number) => `$${n.toFixed(2)}`;
  const protection = protectionOf(r.steps.find((s) => s.node === "protection")?.summary);
  const seconds = r.durationMs < 10_000 ? (r.durationMs / 1000).toFixed(1) : Math.round(r.durationMs / 1000);
  return (
    <div data-ui className={clsx("s-ui s-ui-card", className)} role="group" aria-label={`Exhibit's brief on ${r.claim.buyer}'s dispute`}>
      <div className="s-f-bc">
        <div className="s-f-bc__top">
          <div className="s-f-bc__meta">
            <UiPill decision={b.decision as "FIGHT" | "REFUND"} />
            <span>{b.confidence.toLowerCase()} confidence</span>
            <span>· {seconds} s investigation</span>
          </div>
          <p className="s-f-bc__h">{b.headline.replace(/\s+—\s+/g, ": ")}</p>
          <p className="s-f-bc__sum">{b.summary.split(/(?<=[.!?])\s+/)[0]}</p>
        </div>
        <div className="s-f-bc__stats">
          <div>
            <div className="s-f-bc__k">{b.decision === "REFUND" ? "Chance if fought" : "Win likelihood"}</div>
            <div className="s-f-bc__v">
              <b>{b.winLikelihood}%</b>
            </div>
          </div>
          <div>
            <div className="s-f-bc__k">At stake</div>
            <div className="s-f-bc__v">
              <span className="s-ui-mono">{money(amount)}</span>
            </div>
          </div>
          <div>
            <div className="s-f-bc__k">Expected back</div>
            <div className="s-f-bc__v">
              <span className="s-ui-mono">{money(expected)}</span>
            </div>
          </div>
          <div>
            <div className="s-f-bc__k">Seller Protection</div>
            <div className="s-f-bc__v">{protection ? <span className={`s-f-bc__pv s-f-bc__pv--${protection.tone}`}>{protection.label}</span> : <span className="s-f-bc__pv s-f-bc__pv--none">–</span>}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lena Hoffmann's order in the prevention drawer once Exhibit's reply went out (records/prevention.json, demo merchant). */
export function PreventionSave({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div data-ui className={clsx("s-ui s-ui-sheet", className)} style={style} role="group" aria-label={`A prevented dispute on the demo merchant: order ${LENA_ORDER.orderId}, risk ${LENA_DRAWER.score} to ${LENA_DRAWER.after}, $${LENA_DRAWER.saved} kept`}>
      <div className="s-f-dr s-co-prevented">
        <DrawerHeadView order={LENA_ORDER} prevented />
        <DrawerSuccess saved={LENA_DRAWER.saved} fee={LENA_DRAWER.fee} />
      </div>
    </div>
  );
}
