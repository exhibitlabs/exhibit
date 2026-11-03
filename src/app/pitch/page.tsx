import type { Metadata } from "next";
import { FOUNDERS, GITHUB_URL, TEAM } from "@/components/landing/data";
import demo from "@/components/landing/records/demo-briefs.json";
import { Deck } from "@/components/pitch/Deck";
import { buildSlides, type DeckFacts, type EvalGroup } from "@/components/pitch/slides";
import { CONTACT_EMAIL, TEST_TOTAL } from "@/components/site/company/records";
import { EVAL } from "@/components/site/facts";
import evalResults from "../../../eval/results.json";

export const metadata: Metadata = {
  title: "Pitch",
  description: "Exhibit as a 14-slide deck: disputes answered with evidence, refunds when the buyer is right. Arrow keys to move.",
  alternates: { canonical: "/pitch" },
};

// Every fact on the deck comes from the checked-in records. The slides read the site's own facts
// (src/components/site/facts.ts, from src/components/landing/records, data.ts and eval/results.json), so the deck,
// the site and the app say the same thing. The few facts the site does not state are assembled here, from the same
// records. Nothing is typed by hand.

type EvalCase = { reason: string; expected: string; decision: string | null; guardrails: { final_valid?: boolean; revalidation_problems?: unknown[] } | null };

const CALLS = ["FIGHT", "REFUND", "MESSAGE_BUYER", "OFFER"] as const;
const CALL_LABEL: Record<string, string> = { FIGHT: "Fight", REFUND: "Refund", MESSAGE_BUYER: "Message", OFFER: "Offer" };

/** The evaluation by the call each label expects, and how many briefs passed every guardrail, from eval/results.json. */
function evaluation(): DeckFacts["evaluation"] {
  const cases = ((evalResults as unknown as { cases: EvalCase[] }).cases ?? []).filter(Boolean);
  if (!cases.length) return null;
  const groups: EvalGroup[] = [...CALLS, ...new Set(cases.map((c) => c.expected).filter((d) => !(CALLS as readonly string[]).includes(d)))]
    .map((d) => ({ decision: d, label: CALL_LABEL[d] ?? d, matched: cases.filter((c) => c.expected === d).map((c) => c.decision === c.expected) }))
    .filter((g) => g.matched.length);
  const guarded = cases.filter((c) => c.guardrails?.final_valid && !c.guardrails.revalidation_problems?.length).length;
  return {
    cases: EVAL.cases,
    matched: EVAL.matched,
    refunded: EVAL.refunded,
    falseFights: EVAL.falseFights,
    guardrails: `${guarded}/${cases.length}`,
    medianSeconds: EVAL.medianSeconds,
    reasons: new Set(cases.map((c) => c.reason)).size,
    model: EVAL.model,
    date: EVAL.date,
    caveat: EVAL.caveat,
    url: EVAL.url,
    groups,
  };
}

export default function PitchPage() {
  const order = ["FIGHT", "OFFER", "MESSAGE_BUYER", "REFUND"];
  const facts: DeckFacts = {
    team: { founders: FOUNDERS, names: TEAM.names, firstCommit: TEAM.firstCommit },
    links: { github: GITHUB_URL, contact: CONTACT_EMAIL, run: "npm install && npm run dev" },
    tests: TEST_TOTAL,
    evaluation: evaluation(),
    decisions: order.map((d) => ({ label: CALL_LABEL[d], n: demo.cases.filter((c) => c.decision === d).length })).filter((d) => d.n),
  };
  return <Deck slides={buildSlides(facts)} />;
}
