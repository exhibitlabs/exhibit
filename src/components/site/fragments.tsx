import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  Fingerprint,
  Inbox,
  Keyboard,
  Landmark,
  LayoutDashboard,
  MessagesSquare,
  Package,
  Radar,
  RotateCw,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";
import { FILING, LETTERHEAD, PACKET_COVER } from "./product/filing";
import { PdfFacts, PdfLabel, PdfLetterhead, PdfPage, PdfTitle } from "./packet";
import { ASK, fmtApp, LENA_DRAWER, RECORD, REYES, usd } from "./facts";
import { AskBars, AskRich } from "./askparts";
import { DrawerHeadView, DrawerSignalsView, FixSectionView, MessagePreviewView, type DrawerOrder, type DrawerSignal } from "./drawer";
import { UiButton, UiChip, UiCite, UiExhibit, UiKbd, UiPill, UiRing, UiStatus } from "./ui";

// Product UI fragments bound to the real records: the pieces of the app the site shows, rebuilt from the app's own
// components after its final design pass (src/components/app/**). Each renders the inside of a UiWindow / UiSheet /
// UiCard (or a FitBox for the full case page). Values come from facts.ts and product/filing.ts. Times are UTC in the
// app's own format ("Oct 20, 1:17 PM"); the captions say so.

/** The app's evidence-ref labels (src/lib/reflabel.ts). */
function refLabel(ref: string) {
  const [ns, ...rest] = ref.split(":");
  const id = rest.join(":");
  if (ns === "paypal") return rest[0] === "seller-protection" ? "Seller Protection check" : rest[0] === "message" ? "Buyer's PayPal message" : "PayPal dispute";
  const names: Record<string, string> = {
    order: "Order",
    listing: "Listing",
    shipment: "Tracking",
    customer: "Customer history",
    msg: "Message",
    conversation: "Conversation",
    risk: "Risk signals",
    policy: "Policy",
  };
  if (ns === "customer") return names.customer;
  if (ns === "policy") return `${id[0]?.toUpperCase()}${id.slice(1)} policy`;
  return `${names[ns] ?? ns} ${id}`;
}
const letterFor = (ref: string) => REYES.brief.exhibits.find((x) => x.ref === ref)?.label ?? null;

/** The app's Seller Protection labels (ResponsePanel VERDICT_LABEL), read off the check's own summary. */
function protectionOf(summary: string | undefined): { label: string; tone: "green" | "red" | "neutral" } | null {
  if (!summary) return null;
  if (/^likely eligible/i.test(summary)) return { label: "Likely protected", tone: "green" };
  if (/^not eligible/i.test(summary)) return { label: "Not protected", tone: "red" };
  if (/^at risk/i.test(summary)) return { label: "At risk", tone: "neutral" };
  if (/^not applicable/i.test(summary)) return { label: "Not covered", tone: "neutral" };
  return null;
}

/** The run's clock as the brief prints it: "36 s investigation" (BriefCard: whole seconds from 10 s up). */
const investigation = (ms: number) => `${ms < 10_000 ? (ms / 1000).toFixed(1) : Math.round(ms / 1000)} s investigation`;

/** The latest answer PayPal accepted on the case: the case page's "Filed" step and response card read it (caseState.answeredBy). */
const latestAnswer = REYES.lastFiling;
const answerActor = REYES.approvedByAgent ? `${REYES.approvedByAgent}, approved by you` : "you";
const ANSWER: Record<string, { label: string; call: string }> = {
  "provide-evidence": {
    label: "Evidence filed",
    call: "POST /v1/customer/disputes/{id}/provide-evidence",
  },
  "provide-supporting-info": {
    label: "Sent to PayPal's review",
    call: "POST /v1/customer/disputes/{id}/provide-supporting-info",
  },
  "accept-claim": {
    label: "Claim accepted",
    call: "POST /v1/customer/disputes/{id}/accept-claim",
  },
};
const answered = ANSWER[latestAnswer.path.split("/").pop() ?? ""] ?? ANSWER["provide-evidence"];

// ---------------------------------------------------------------------------------------------- evidence graph
type GraphNode = {
  node: string;
  title: string;
  icon: LucideIcon;
  side: "l" | "r";
};
const GRAPH: GraphNode[] = [
  { node: "paypal", title: "The dispute", icon: Landmark, side: "l" },
  { node: "order", title: "Order & listing", icon: Package, side: "l" },
  { node: "carrier", title: "Delivery", icon: Truck, side: "l" },
  { node: "customer", title: "Buyer history", icon: UserRound, side: "l" },
  { node: "risk", title: "Checkout signals", icon: Fingerprint, side: "r" },
  { node: "inbox", title: "Buyer messages", icon: MessagesSquare, side: "r" },
  { node: "policies", title: "Store policies", icon: ScrollText, side: "r" },
  {
    node: "protection",
    title: "Seller Protection",
    icon: ShieldCheck,
    side: "r",
  },
];

/** Which source an evidence ref came from (the app's sourceOf). */
function sourceOf(ref: string) {
  const [ns, sub] = ref.split(":");
  if (ns === "paypal") return sub === "seller-protection" ? "protection" : "paypal";
  if (ns === "order" || ns === "listing") return "order";
  if (ns === "shipment") return "carrier";
  if (ns === "customer") return "customer";
  if (ns === "risk") return "risk";
  if (ns === "msg" || ns === "conversation") return "inbox";
  if (ns === "policy") return "policies";
  return null;
}

// The app's geometry (src/components/app/case/EvidenceGraph.tsx): 53 px nodes 10 px apart, a 188 px hub centred
// between the columns, columns at most 340 px, wires fanned in to 22% of their offset at the hub.
const NODE_H = 53;
const NODE_GAP = 10;
const HUB_W = 188;
const HUB_H = 156;
const BOARD_H = 4 * NODE_H + 3 * NODE_GAP;

/**
 * The evidence graph of the Reyes run as the app draws it, header, board and legend: eight sources, six cited (green
 * badges A to F), the dispute read and cited without an exhibit, store policies not queried. `width` is the card's
 * width in px; `gap` the space between a column and the hub (the app's clamp(48px, 7vw, 120px)).
 */
export function EvidenceGraph({ width = 1098, gap = 97 }: { width?: number; gap?: number }) {
  const inner = width - 2 - 48;
  const cell = (inner - HUB_W - 2 * gap) / 2;
  const colW = Math.min(340, cell);
  const leftX = cell - colW;
  const hubX = cell + gap;
  const rightX = hubX + HUB_W + gap;
  const hubTop = (BOARD_H - HUB_H) / 2;
  const cy = BOARD_H / 2;
  const done = true;
  const nodes = GRAPH.map((g) => {
    const step = REYES.run.steps.find((s) => s.node === g.node);
    const exhibits = REYES.brief.exhibits.filter((x) => x.node === g.node);
    const points = REYES.brief.reasoning.filter((r) => r.refs.some((ref) => sourceOf(ref) === g.node));
    const row = GRAPH.filter((x) => x.side === g.side).indexOf(g);
    const top = row * (NODE_H + NODE_GAP);
    return { ...g, step, exhibits, points, top, y: top + NODE_H / 2 };
  });
  const edge = (n: (typeof nodes)[number]) => {
    const y2 = cy + (n.y - cy) * 0.22;
    const [x1, x2] = n.side === "l" ? [cell, hubX] : [rightX, hubX + HUB_W];
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${n.y} C ${mx} ${n.y}, ${mx} ${y2}, ${x2} ${y2}`;
  };
  const cited = nodes.filter((n) => n.exhibits.length).length;
  return (
    <section className="s-f-card s-f-eg" style={{ width }}>
      <div className="s-f-eg__h">
        <span className="s-f-eg__t">Evidence graph</span>
        <span className="s-f-eg__m">
          {REYES.brief.exhibits.length} exhibits from {cited} sources
        </span>
      </div>
      <div className="s-f-eg__board">
        <div className="s-f-eg__grid" style={{ height: BOARD_H }}>
          <svg className="s-f-eg__edges" width={inner} height={BOARD_H} viewBox={`0 0 ${inner} ${BOARD_H}`} aria-hidden>
            {nodes.map((n) => {
              const wire = n.exhibits.length || (done && n.points.length) ? "cite" : n.step ? "read" : "skip";
              return (
                <path
                  key={n.node}
                  d={edge(n)}
                  fill="none"
                  strokeLinecap="round"
                  stroke={wire === "cite" ? "#15803d" : wire === "read" ? "#3d3d3c" : "#dcdcda"}
                  strokeWidth={wire === "cite" ? 1.9 : wire === "read" ? 1.1 : 1}
                  opacity={wire === "read" ? 0.22 : 1}
                  strokeDasharray={wire === "skip" ? "3 5" : undefined}
                />
              );
            })}
          </svg>
          {nodes.map((n) => {
            const Icon = n.icon;
            const state = n.exhibits.length ? "cite" : n.step ? "read" : "skip";
            const ms = n.step?.ms != null && n.step.ms > 20 ? `${n.step.ms} ms` : null;
            const summary = n.step ? n.step.summary.replace(/\s+—\s+/g, " in ") : "Skipped";
            return (
              <div
                key={n.node}
                className={`s-f-node s-f-node--${state}${n.side === "r" ? " s-f-node--r" : ""}`}
                style={{
                  top: n.top,
                  left: n.side === "l" ? leftX : rightX,
                  width: colW,
                }}
              >
                <span className="s-f-node__ic">
                  <Icon aria-hidden strokeWidth={1.8} />
                </span>
                <span className="s-f-node__tx">
                  <span className="s-f-node__t">
                    <span className="s-f-node__tt">{n.title}</span>
                    {ms ? <span className="s-f-node__ms">{ms}</span> : null}
                  </span>
                  <span className="s-f-node__s">{summary}</span>
                </span>
                {n.exhibits.length ? (
                  <span className="s-f-node__bx">
                    {n.exhibits.map((x) => (
                      <UiExhibit key={x.label} letter={x.label} variant="badge" />
                    ))}
                  </span>
                ) : null}
              </div>
            );
          })}
          <div className="s-f-hub" style={{ left: hubX, top: hubTop, width: HUB_W, height: HUB_H }}>
            <UiRing value={REYES.brief.winLikelihood} label={`${REYES.brief.winLikelihood} percent likely to win`} />
            <UiPill decision="FIGHT" solid />
            <span className="s-f-hub__lk">likely to win</span>
          </div>
        </div>
      </div>
      <div className="s-f-eg__foot">
        <Legend kind="cite">Cited to fight</Legend>
        <Legend kind="read">Read, not cited</Legend>
        <Legend kind="skip">Not queried</Legend>
        <span className="s-f-eg__hint">Select a source to see how the agent used it.</span>
      </div>
    </section>
  );
}

function Legend({ kind, children }: { kind: "cite" | "read" | "skip"; children: ReactNode }) {
  return (
    <span className="s-f-leg">
      <svg width="18" height="6" aria-hidden>
        <line
          x1="1"
          y1="3"
          x2="17"
          y2="3"
          stroke={kind === "cite" ? "#15803d" : kind === "read" ? "#3d3d3c" : "#dcdcda"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={kind === "skip" ? "3 3" : undefined}
          opacity={kind === "read" ? 0.35 : 1}
        />
      </svg>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------- the brief
/**
 * The app's brief card (src/components/app/case/BriefCard.tsx) for the Reyes run: the call and its confidence, the
 * headline, the summary, the four figures, the reasoning with a citation on every point, and the risks.
 * `points` limits the reasoning shown; `summary="first"` keeps the summary's first sentence (a crop for small plates),
 * `"none"` drops it; `why={false}` ends the card at the four figures.
 */
export function BriefCardView({ points, summary = "full", risks = true, why = true }: { points?: number; summary?: "full" | "first" | "none"; risks?: boolean; why?: boolean }) {
  const b = REYES.brief;
  const protection = protectionOf(REYES.run.steps.find((s) => s.node === "protection")?.summary);
  const text = summary === "first" ? b.summary.split(/(?<=[.!?])\s+/)[0] : summary === "none" ? null : b.summary;
  return (
    <div className="s-f-bc">
      <div className="s-f-bc__top">
        <div className="s-f-bc__meta">
          <UiPill decision="FIGHT" />
          <span>{b.confidence} confidence</span>
          <span>· {investigation(REYES.run.durationMs)}</span>
        </div>
        <p className="s-f-bc__h">{b.headlinePlain}</p>
        {text ? <p className="s-f-bc__sum">{text}</p> : null}
      </div>
      <div className="s-f-bc__stats">
        <div>
          <div className="s-f-bc__k">Win likelihood</div>
          <div className="s-f-bc__v">
            <b>{b.winLikelihood}%</b>
          </div>
        </div>
        <div>
          <div className="s-f-bc__k">At stake</div>
          <div className="s-f-bc__v">
            <span className="s-ui-mono">{usd(REYES.amount)}</span>
          </div>
        </div>
        <div>
          <div className="s-f-bc__k">Expected back</div>
          <div className="s-f-bc__v">
            <span className="s-ui-mono">{usd(b.expectedBack)}</span>
          </div>
        </div>
        <div>
          <div className="s-f-bc__k">Seller Protection</div>
          <div className="s-f-bc__v">{protection ? <span className={`s-f-bc__pv s-f-bc__pv--${protection.tone}`}>{protection.label}</span> : <span className="s-f-bc__pv s-f-bc__pv--none">–</span>}</div>
        </div>
      </div>
      {why ? (
        <div className="s-f-bc__why">
          <p className="s-f-bc__wh">Why</p>
          <ul className="s-f-bc__pts">
            {b.reasoning.slice(0, points ?? b.reasoning.length).map((p, i) => (
              <li key={i}>
                {p.point}
                <span className="s-f-bc__refs">
                  {p.refs.map((ref) => (
                    <UiCite key={ref} letter={letterFor(ref)}>
                      {refLabel(ref)}
                    </UiCite>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {risks && b.risks.length ? (
        <div className="s-f-bc__risks">
          <div>
            <p className="s-f-bc__rh">
              <AlertTriangle aria-hidden strokeWidth={1.9} /> What could go wrong
            </p>
            <ul>
              {b.risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The cited decision for a plate: the brief card cropped to its first reasoning points. */
export function BriefSheet({ points = 3 }: { points?: number }) {
  return <BriefCardView points={points} summary="first" risks={false} />;
}

// ---------------------------------------------------------------------------------------------- response card
/** The letter's opening with the facts the app underlines (records it can cite word for word: order, total, capture). */
function CitedOpening() {
  const text = REYES.brief.letterOpening;
  const cites = [REYES.orderId, usd(REYES.amount), REYES.captureId].filter((c): c is string => !!c);
  const parts: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    const hits = cites.map((c) => ({ c, i: rest.indexOf(c) })).filter((h) => h.i >= 0);
    if (!hits.length) {
      parts.push(rest);
      break;
    }
    const h = hits.sort((a, b) => a.i - b.i)[0];
    if (h.i > 0) parts.push(rest.slice(0, h.i));
    parts.push(
      <span key={key++} className="s-f-cite">
        {h.c}
      </span>,
    );
    rest = rest.slice(h.i + h.c.length);
  }
  return <p className="s-f-letter">{parts}</p>;
}

/** The app's "Response to PayPal" card once the case is answered: the letter, its legend, and what was filed. */
function ResponseCard() {
  return (
    <section className="s-f-card s-f-rp">
      <div className="s-f-rp__tabs">
        <span className="s-f-tab s-f-tab--on">Response to PayPal</span>
      </div>
      <div className="s-f-rp__body">
        <CitedOpening />
        <div className="s-f-rp__legend">
          <span>
            <UiExhibit letter="A" variant="sm" /> an exhibit in the packet
          </span>
          <span>
            <span className="s-f-cite">1Z84…</span> matches a record; hover for the source
          </span>
        </div>
      </div>
      <div className="s-f-rp__done">
        <div className="s-f-rp__ok">
          <Check aria-hidden strokeWidth={2.6} />
          {answered.label}
        </div>
        <p>
          {answered.label} by {answerActor} on {fmtApp(latestAnswer.at)}. PayPal has it now; the case updates when PayPal responds.
        </p>
        <span className="s-f-rp__call">
          <span className="s-ui-mono">{answered.call}</span> → {latestAnswer.status} · see the call
        </span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------- the case page
const NAV_ITEMS: [LucideIcon, string, boolean?][] = [
  [LayoutDashboard, "Overview"],
  [Inbox, "Disputes", true],
  [Radar, "Prevention"],
  [Sparkles, "Autopilot"],
  [Bot, "Agent requests"],
  [Activity, "PayPal activity"],
];

type Step = {
  label: string;
  detail: string;
  at?: string;
  state: "done" | "active" | "todo";
};

/** Opened → Investigated → Filed → PayPal reviewing → Resolved, as the app derives it (caseState.lifecycle). */
const STEPS: Step[] = [
  {
    label: "Opened",
    detail: REYES.channel === "EXTERNAL" ? "Chargeback · card issuer" : "Chargeback",
    at: REYES.openedAt,
    state: "done",
  },
  {
    label: "Investigated",
    detail: `Fight · ${REYES.brief.winLikelihood}%`,
    at: new Date(Date.parse(REYES.run.startedAt) + REYES.run.durationMs).toISOString(),
    state: "done",
  },
  {
    label: answered.label,
    detail: `by ${answerActor}`,
    at: latestAnswer.at,
    state: "done",
  },
  {
    label: "PayPal reviewing",
    detail: "PayPal's reviewer has the case",
    state: "active",
  },
  { label: "Resolved", detail: "PayPal decides", state: "todo" },
];

/**
 * Exhibit's case page for the Reyes chargeback, rebuilt from the app as it runs on the PayPal sandbox: the frame
 * (sidebar and top bar on #f6f6f5) around the white page, the case header, the lifecycle, the evidence graph, the
 * brief and the response. Designed at 1386 x 1013 px (the app in a 1386 px window); place it in a FitBox.
 */
export function CasePage() {
  const r = REYES;
  return (
    <div className="s-f-app" aria-hidden>
      <aside className="s-f-sb">
        <div className="s-f-sb__logo">
          <LogoMark size={22} />
          <span>Exhibit</span>
        </div>
        <div className="s-f-sb__who">
          <b>Kora Atelier</b>
          <span>
            <i />
            PayPal sandbox merchant
          </span>
        </div>
        <nav className="s-f-sb__nav">
          {NAV_ITEMS.map(([Icon, label, on]) => (
            <span key={label} className={on ? "s-f-nav s-f-nav--on" : "s-f-nav"}>
              <Icon strokeWidth={1.6} />
              {label}
            </span>
          ))}
        </nav>
        <div className="s-f-sb__foot">
          <span className="s-f-nav">
            <Settings strokeWidth={1.6} />
            Settings
          </span>
          <span className="s-f-nav">
            <Keyboard strokeWidth={1.6} />
            Shortcuts
            <UiKbd className="s-f-nav__kbd">?</UiKbd>
          </span>
        </div>
      </aside>
      <div className="s-f-col">
        <div className="s-f-top">
          <span className="s-f-env">
            <i />
            PayPal sandbox, live API · Claude CLI, live
          </span>
          <span className="s-f-search">
            <Search strokeWidth={1.8} />
            <span>Ask Exhibit, or jump to a case</span>
            <UiKbd>⌘</UiKbd>
            <UiKbd>K</UiKbd>
          </span>
          <span className="s-f-top__r">
            <span className="s-f-bell">
              <Bell strokeWidth={1.7} />
            </span>
          </span>
        </div>
        <div className="s-f-sheet">
          <div className="s-f-ch">
            <div className="s-f-ch__crumbs">
              <span className="s-f-ch__trail">
                <ArrowLeft />
                Disputes
                <i>/</i>
                <span className="s-ui-mono">{r.id}</span>
              </span>
              <span className="s-f-ch__pager">
                <span className="s-f-ch__count">3 of 3 open</span>
                <span className="s-f-sq">
                  <ChevronLeft />
                </span>
                <span className="s-f-sq s-f-sq--off">
                  <ChevronRight />
                </span>
              </span>
            </div>
            <div className="s-f-ch__row">
              <div className="s-f-ch__title">
                <p className="s-f-ch__h1">
                  {r.buyer} · {r.reason}
                </p>
                <p className="s-f-ch__sub">
                  {r.item} · <span className="s-ui-mono">{usd(r.amount)}</span> · Chargeback · PayPal reviewing · opened {fmtApp(r.openedAt)}
                </p>
              </div>
              <div className="s-f-ch__acts">
                <span className="s-f-done">
                  <Check strokeWidth={2.6} />
                  {answered.label}
                </span>
                <UiButton icon>
                  <RotateCw />
                </UiButton>
              </div>
            </div>
          </div>
          <div className="s-f-lc">
            <ol className="s-f-steps">
              {STEPS.map((s, i) => (
                <li key={s.label} className={`s-f-step s-f-step--${s.state}`}>
                  <span className="s-f-step__m">{s.state === "done" ? <Check strokeWidth={3.5} /> : s.state === "active" ? <i /> : null}</span>
                  <span className="s-f-step__tx">
                    <span className="s-f-step__lab">
                      <span>{s.label}</span>
                      {i < STEPS.length - 1 ? <i /> : null}
                    </span>
                    <span className="s-f-step__det">{s.detail}</span>
                    {s.at ? <span className="s-f-step__at">{fmtApp(s.at)}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="s-f-body">
            <EvidenceGraph />
            <div className="s-f-two">
              <section className="s-f-card">
                <BriefCardView />
              </section>
              <ResponseCard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- the packet
/**
 * The evidence packet's cover page exactly as it was filed on Nov 3 (run run_00a4c818-1a0, approval apv_348c2c7423),
 * printed as src/lib/packet/Packet.tsx prints it: the letterhead, the title, the facts and the merchant's response,
 * whose first `paragraphs` run on down the page: past the plate's edge, or fading out where the overlay stacks on
 * phones (the index of exhibits A to F follows on the next page).
 * The Oct 21 brief lettered its exhibits differently, so this reads from FILING, not from REYES.brief.
 */
export function PacketPage({ paragraphs = 5 }: { paragraphs?: number }) {
  return (
    <PdfPage merchant={LETTERHEAD} disputeId={FILING.disputeId} className={paragraphs ? "s-pdf--narrow s-pdf--fade" : "s-pdf--narrow s-pdf--top"} footer={false}>
      <PdfLetterhead merchant={LETTERHEAD} disputeId={FILING.disputeId} date={PACKET_COVER.date} />
      <PdfTitle disputeId={FILING.disputeId} headline={FILING.headline} />
      <PdfFacts facts={PACKET_COVER.facts} />
      {paragraphs ? (
        <div className="s-pdf__sec">
          <PdfLabel>Merchant&apos;s response</PdfLabel>
          <div className="s-pdf__letter">
            {FILING.letter
              .split("\n\n")
              .slice(0, paragraphs)
              .map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
          </div>
        </div>
      ) : null}
    </PdfPage>
  );
}

/**
 * The top of the Ask Exhibit answer as the palette shows it (AskPalette.tsx Turn): the question, the read-only steps
 * and the answer's opening line. A crop for small spaces; AskAnswer is the whole palette.
 */
export function AskTurnTop() {
  return (
    <section className="s-f-turn">
      <p className="s-f-turn__q">{ASK.question}</p>
      <div className="s-f-turn__steps">
        {ASK.steps.map((s) => (
          <div key={s.name} className="s-f-turn__step">
            <Check strokeWidth={2.25} />
            <span>{s.summary}</span>
            <em>{(s.ms / 1000).toFixed(1)} s</em>
          </div>
        ))}
      </div>
      <AskRich text={ASK.answer.text.split("\n")[0]} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------- prevention
const D = LENA_DRAWER;
/** Lena Hoffmann's order as the drawer's header reads it (demo merchant, PayPal simulator). */
export const LENA_ORDER: DrawerOrder = {
  buyer: D.buyer,
  country: D.country,
  orderId: D.orderId,
  item: D.item,
  score: D.score,
  band: "high",
  exposure: D.exposure,
  amount: D.amount,
  fee: D.fee,
};
const LENA_SIGNALS: DrawerSignal[] = D.signals.map((s) => ({
  ...s,
  lang: s.kind === "buyer_waiting" ? "de" : undefined,
}));

/** The at-risk order as the prevention drawer opens on it (demo merchant, PayPal simulator), before Exhibit's reply. */
export function AtRiskCard() {
  return (
    <div className="s-f-dr">
      <DrawerHeadView order={LENA_ORDER} />
      <DrawerSignalsView signals={LENA_SIGNALS} />
    </div>
  );
}

/** "Fix it now": the reply in German as the drawer shows it before it is sent, then the one action. */
export function BuyerReply() {
  return (
    <div className="s-f-dr">
      <FixSectionView detail={D.fix.detail} label="Message buyer" channel="inbox" top>
        <MessagePreviewView language="German" subject={D.fix.subject} body={D.fix.body} />
      </FixSectionView>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- Ask Exhibit
/**
 * The recorded Ask Exhibit answer as the palette shows it (src/components/app/ask/AskPalette.tsx): the input row, the
 * question, the read-only steps, the answer, the chart, the cases and the follow-ups, then the footer. `height` is
 * the palette's scrolling body (the app caps it near 560 px on a 900 px window); the answer runs past it.
 */
export function AskAnswer({ height }: { height?: number }) {
  const a = ASK.answer;
  return (
    <div className="s-f-pal">
      <div className="s-f-pal__in">
        <span className="s-f-pal__back">
          <ArrowLeft strokeWidth={1.75} />
        </span>
        <span className="s-f-pal__tag">Ask Exhibit</span>
        <span className="s-f-pal__ph">Ask a follow-up…</span>
        <UiKbd>esc</UiKbd>
      </div>
      <div className="s-f-pal__body" style={height ? { height } : undefined}>
        <section className="s-f-turn">
          <p className="s-f-turn__q">{ASK.question}</p>
          <div className="s-f-turn__steps">
            {ASK.steps.map((s) => (
              <div key={s.name} className="s-f-turn__step">
                <Check strokeWidth={2.25} />
                <span>{s.summary}</span>
                <em>{(s.ms / 1000).toFixed(1)} s</em>
              </div>
            ))}
          </div>
          <AskRich text={a.text} />
          <div className="s-f-chart">
            <p className="s-f-chart__t">{a.chart.title}</p>
            <AskBars chart={a.chart} width={480} />
          </div>
          <p className="s-f-turn__lbl">Cases</p>
          <div className="s-f-cases">
            {a.cases.map((c) => (
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
            {a.followups.map((f) => (
              <span key={f}>
                <CornerDownRight aria-hidden />
                <span className="s-f-follow__t">{f}</span>
              </span>
            ))}
          </div>
        </section>
      </div>
      <div className="s-f-pal__ft">
        <span className="s-f-pal__prov">
          <i />
          Claude Opus 5.5 · Claude CLI
          <span>· read-only, grounded in your records</span>
        </span>
        <span className="s-f-pal__keys">
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
  );
}

// ---------------------------------------------------------------------------------------------- agents
const A = FILING.approval;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Agent requests as the merchant saw them on Nov 3 (src/components/app/AgentApprovals.tsx): Claude Code's request
 * waiting for approval, a minute old, and then, when `decided`, the same request in the Decided table.
 */
export function ApprovalCard({ decided = true }: { decided?: boolean }) {
  return (
    <>
      <div data-ui className="s-ui s-ui-card s-f-apq" role="group" aria-label={`Agent requests: ${A.client} asks to ${lower(A.title)}, waiting for the merchant`}>
        <div className="s-ui-card__head">
          <div>Waiting for you</div>
          <span>1 request</span>
        </div>
        <ApprovalRow />
      </div>
      {decided ? <DecidedTable /> : null}
    </>
  );
}

/** One pending request in the queue: who asks for what, the case, how long ago, the agent's note, and the three buttons. */
export function ApprovalRow() {
  return (
    <div className="s-f-apq__row">
      <div className="s-f-apq__tx">
        <p className="s-f-apq__who">
          <span>{A.client} asks to</span> <b>{lower(A.title)}</b>
        </p>
        <p className="s-f-apq__det">{A.detail}</p>
        <p className="s-f-apq__meta">
          <u className="s-ui-mono">{FILING.disputeId}</u>
          <span>· 1m ago</span>
          <span className="s-f-apq__note">· &ldquo;{A.note}&rdquo;</span>
        </p>
      </div>
      <div className="s-f-apq__acts">
        <UiButton variant="ghost" size="sm">
          Review <ArrowRight />
        </UiButton>
        <UiButton size="sm">Reject</UiButton>
        <UiButton variant="primary" size="sm">
          <Check /> Approve
        </UiButton>
      </div>
    </div>
  );
}

/**
 * The case page's banner for an agent's request (AgentApprovals.tsx, ApprovalBanner), as the merchant saw it on the
 * Reyes case a minute after Claude Code asked: who asks for what, the detail, the agent's note, Reject and Approve.
 */
export function ApprovalBannerView() {
  return (
    <section className="s-f-ban">
      <span className="s-f-ban__rule" aria-hidden />
      <div className="s-f-ban__main">
        <div className="s-f-ban__tx">
          <p className="s-f-ban__meta">
            <Bot aria-hidden strokeWidth={1.8} />
            <b>Agent request</b>
            <span aria-hidden>·</span>
            <span>{A.client} via MCP · 1m ago</span>
          </p>
          <p className="s-f-ban__who">
            {A.client} asks to <b>{lower(A.title)}</b>
          </p>
          <p className="s-f-ban__det">{A.detail}</p>
          <p className="s-f-ban__note">
            {A.client}: &ldquo;{A.note}&rdquo;
          </p>
        </div>
        <div className="s-f-ban__acts">
          <UiButton>
            <X /> Reject
          </UiButton>
          <UiButton variant="primary">
            <Check /> Approve
          </UiButton>
        </div>
      </div>
      <div className="s-f-ban__foot">
        <ShieldCheck aria-hidden />
        Nothing reaches PayPal until you approve. Exhibit then files the brief below as written, and logs it under {A.client}.
      </div>
    </section>
  );
}

/** The Decided table with the approved request: "Approved, sent", the request, the case, the agent and when. */
export function DecidedTable({ className }: { className?: string }) {
  return (
    <div data-ui className={`s-ui s-ui-card s-f-dec${className ? ` ${className}` : ""}`} role="group" aria-label={`Decided: approved and sent, ${fmtApp(A.approvedAt)} UTC`}>
      <div className="s-ui-card__head">
        <div>Decided</div>
        <span>1 recent</span>
      </div>
      <div className="s-f-tbl__wrap">
        <table className="s-f-tbl">
          <thead>
            <tr>
              <th className="s-f-tbl__dec">Decision</th>
              <th>Request</th>
              <th className="s-f-tbl__case">Case or order</th>
              <th className="s-f-tbl__agent">Agent</th>
              <th className="s-f-tbl__when">Decided</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="s-f-tbl__dec">
                <UiChip tone="green">Approved, sent</UiChip>
              </td>
              <td className="s-f-tbl__req">
                <span>{A.title}</span>
                <small>{A.detail}</small>
              </td>
              <td className="s-f-tbl__case">
                <u className="s-ui-mono">{FILING.disputeId}</u>
              </td>
              <td className="s-f-tbl__agent">{A.client}</td>
              <td className="s-f-tbl__when">{fmtApp(A.approvedAt)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The MCP flow behind the Nov 3 filing, shown as a terminal transcript (tool names and results are real). */
export function McpLines() {
  const f = REYES.lastFiling;
  return (
    <>
      <div>
        <span className="p">$</span> <span className="c">claude mcp add exhibit -e EXHIBIT_URL=http://localhost:3000 \</span>
      </div>
      <div>
        &nbsp;&nbsp;&nbsp;&nbsp;
        <span className="c">-- node exhibit/mcp/server.ts</span>
      </div>
      <div>
        <span className="y">›</span> <span className="c">investigate_dispute</span> <span className="p">{REYES.id}</span>
      </div>
      <div>
        &nbsp;&nbsp;<span className="g">FIGHT</span> · {REYES.brief.winLikelihood}% · {REYES.brief.exhibits.length} exhibits · every ref resolves
      </div>
      <div>
        <span className="y">›</span> <span className="c">request_dispute_action</span> <span className="p">{REYES.id}</span>
      </div>
      <div>&nbsp;&nbsp;pending · waiting for the merchant</div>
      <div>
        <span className="y">›</span> <span className="c">get_approval_status</span>
      </div>
      <div>
        &nbsp;&nbsp;<span className="g">approved</span> · provide-supporting-info · {f.status} · {f.debugId}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------- PayPal activity
type CallRow = {
  at: string;
  method: string;
  path: string;
  status: number;
  ms: number | null;
  debugId: string | null;
  disputeId?: string | null;
};

/** One row of the app's PayPal activity timeline (src/components/app/ActivityView.tsx) for a PayPal call. */
export function ActivityCall({ c }: { c: CallRow }) {
  return (
    <li className="s-f-act__row">
      <span className={c.method === "GET" ? "s-f-act__m s-f-act__m--get" : "s-f-act__m"}>{c.method}</span>
      <span className="s-f-act__main">
        <span className="s-f-act__p">{c.path}</span>
        <span className="s-f-act__sub">
          <span>PayPal sandbox</span>
          {c.debugId ? <span className="s-ui-mono">debug {c.debugId}</span> : null}
          {c.disputeId ? <u className="s-ui-mono">{c.disputeId}</u> : null}
        </span>
      </span>
      <span className="s-f-act__r">
        {c.ms != null ? <span className="s-ui-mono">{c.ms} ms</span> : null}
        <UiStatus code={c.status} />
      </span>
      <span className="s-f-act__at">{fmtApp(c.at)}</span>
      <ChevronRight className="s-f-act__chev" aria-hidden />
    </li>
  );
}

/** One row of the timeline for something a person or an agent did (no PayPal call): an icon, what happened, who. */
export function ActivityEvent({ icon: Icon, title, actor, at, disputeId, strong }: { icon: LucideIcon; title: string; actor: string; at: string; disputeId?: string; strong?: boolean }) {
  return (
    <li className="s-f-act__row">
      <span className="s-f-act__ic">
        <Icon aria-hidden strokeWidth={1.7} className={strong ? "s-f-act__ic--ink" : undefined} />
      </span>
      <span className="s-f-act__main">
        <span className="s-f-act__title">{title}</span>
        <span className="s-f-act__sub">
          <span>{actor}</span>
          {disputeId ? <u className="s-ui-mono">{disputeId}</u> : null}
        </span>
      </span>
      <span className="s-f-act__at">{fmtApp(at)}</span>
      <span className="s-f-act__chev" />
    </li>
  );
}

/**
 * PayPal activity: four real sandbox calls as the app's timeline lists them, newest first, the failed one included.
 * Drawn at the app's 1440 px width (813 px timeline); put it in a FitBox.
 */
export function AuditLog({ rows }: { rows?: CallRow[] }) {
  const pick: CallRow[] =
    rows ??
    [
      REYES.lastFiling,
      RECORD.filed.find((w) => w.path.endsWith("/accept-claim")),
      RECORD.filed.find((w) => w.path.endsWith("/provide-evidence")),
      RECORD.failedWrites.find((w) => w.status >= 500),
    ].filter((w): w is NonNullable<typeof w> => !!w);
  return (
    <ol className="s-f-act">
      {pick.map((w) => (
        <ActivityCall key={`${w.at}${w.debugId}`} c={w} />
      ))}
    </ol>
  );
}

/** Small helper for a labelled row inside a fragment. */
export function UiRow({ k, children }: { k: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2" style={{ borderTop: "1px solid var(--ui-line)" }}>
      <span className="s-ui-muted" style={{ fontSize: 12 }}>
        {k}
      </span>
      <span style={{ fontSize: 12.5, textAlign: "right" }}>{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- run timeline
const SYSTEM: Record<string, "PayPal" | "Store"> = {
  paypal: "PayPal",
  protection: "PayPal",
};

/**
 * The recorded run's tool calls on a time axis: what PayPal answered, what the store answered, and how long
 * Claude spent writing the cited brief. Bars grow in when the figure enters (inside a Reveal).
 */
export function RunTimeline() {
  const r = REYES.run;
  const total = r.durationMs;
  const pct = (ms: number) => `${((ms / total) * 100).toFixed(2)}%`;
  const paypal = r.steps.filter((s) => SYSTEM[s.node] === "PayPal");
  const store = r.steps.filter((s) => SYSTEM[s.node] !== "PayPal");
  const firstAt = r.steps[0].at;
  const ticks = Array.from({ length: Math.floor(total / 5000) + 1 }, (_, i) => i * 5000);
  const delay = (ms: number) => ({ "--d": Math.round((ms / total) * 900) }) as CSSProperties;
  const storeMs = store.map((s) => s.ms ?? 0);
  return (
    <div className="s-f-tl">
      <div className="s-f-tl__head">
        <span>
          <span className="s-ui-mono">{r.id.replace(/-.*$/, "")}</span> · tool calls on a time axis
        </span>
        <span className="s-ui-mono">{(total / 1000).toFixed(1)} s total</span>
      </div>
      <div className="s-f-tl__chart" aria-hidden>
        <div className="s-f-tl__marks">
          <div className="s-f-tl__mark" style={{ left: pct(r.briefAt) }}>
            <span>brief filed {(r.briefAt / 1000).toFixed(1)} s</span>
          </div>
        </div>
        <div className="s-f-tl__row s-f-tl__row--tall">
          <span className="s-f-tl__lab">PayPal</span>
          <div className="s-f-tl__track">
            {paypal.map((s, i) => (
              <Fragment key={s.tool}>
                <i
                  className="s-f-tl__bar s-f-tl__bar--ink"
                  style={{
                    left: pct(s.at),
                    width: `max(4px, ${pct(s.ms ?? 0)})`,
                    ...delay(s.at),
                  }}
                />
                <em className={`s-f-tl__txt ${i % 2 ? "s-f-tl__txt--below" : "s-f-tl__txt--above"}`} style={{ left: pct(s.at) }}>
                  <span className="s-ui-mono">{s.tool}</span> {s.ms} ms
                </em>
              </Fragment>
            ))}
          </div>
        </div>
        <div className="s-f-tl__row">
          <span className="s-f-tl__lab">Your store</span>
          <div className="s-f-tl__track">
            {store.map((s) => (
              <i key={s.tool} className="s-f-tl__bar s-f-tl__bar--tick" style={{ left: pct(s.at), ...delay(s.at) }} />
            ))}
            <em
              className="s-f-tl__txt"
              style={{
                left: `calc(${pct(store[store.length - 1].at)} + 10px)`,
              }}
            >
              {store.length} store lookups, {Math.min(...storeMs)} to {Math.max(...storeMs)} ms each
            </em>
          </div>
        </div>
        <div className="s-f-tl__row">
          <span className="s-f-tl__lab">Claude</span>
          <div className="s-f-tl__track">
            <i className="s-f-tl__bar s-f-tl__bar--plan" style={{ left: 0, width: pct(firstAt), ...delay(0) }}>
              <span>plans</span>
            </i>
            <i
              className="s-f-tl__bar s-f-tl__bar--write"
              style={{
                left: pct(r.lastResultAt),
                width: pct(r.briefAt - r.lastResultAt),
                ...delay(r.lastResultAt),
              }}
            >
              <span>writes the cited brief · {((r.briefAt - r.lastResultAt) / 1000).toFixed(1)} s</span>
            </i>
            <i
              className="s-f-tl__bar s-f-tl__bar--ink"
              style={{
                left: pct(r.briefAt),
                width: pct(total - r.briefAt),
                ...delay(r.briefAt),
              }}
            />
          </div>
        </div>
        <div className="s-f-tl__axis">
          {ticks.map((t) => (
            <span key={t} style={{ left: pct(t) }}>
              {t / 1000} s
            </span>
          ))}
        </div>
      </div>
      <ol className="s-f-tl__list">
        {r.steps.map((s) => (
          <li key={s.tool}>
            <span className="s-ui-mono">{s.tool}</span>
            <span className="s-ui-muted">{SYSTEM[s.node] === "PayPal" ? "PayPal" : "store"}</span>
            <span className="s-ui-mono">{s.ms} ms</span>
            <span className="s-ui-mono s-ui-muted">at {(s.at / 1000).toFixed(1)} s</span>
          </li>
        ))}
        <li>
          <span className="s-ui-mono">file_case_brief</span>
          <span className="s-ui-muted">Claude</span>
          <span className="s-ui-mono">validated</span>
          <span className="s-ui-mono s-ui-muted">at {(r.briefAt / 1000).toFixed(1)} s</span>
        </li>
      </ol>
    </div>
  );
}
