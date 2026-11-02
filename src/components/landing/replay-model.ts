// Shapes shared by the hero builder (server) and the replay (client). Plain data only.

export type IconKey = "dispute" | "order" | "carrier" | "customer" | "risk" | "inbox" | "policies" | "protection" | "tracking" | "scale";

export type ReplayNode = { id: string; title: string; system: string; icon: IconKey; side: "l" | "r" };

export type ReplayStep = {
  node: string;
  /** Tool name for agent runs, e.g. get_carrier_tracking. */
  tool?: string;
  /** The one input worth showing, e.g. "order_id: KA-10503". */
  arg?: string | null;
  summary: string;
  /** Tool latency in ms, as recorded. */
  ms?: number | null;
  /** Offset from the start of the real run, in ms. */
  at?: number;
  /** A warning the radar raised on this record (prevention only). */
  flag?: string;
};

export type ReplayMark = { node: string; label: string; title: string };

export type ReplayCase = {
  key: "fight" | "refund" | "prevent";
  decision: "FIGHT" | "REFUND" | "PREVENT";
  tab: { verb: string; who: string; amount: string; reason: string };
  provenance: { tone: "sandbox" | "demo"; short: string; long: string };
  claim: { kicker: string; title: string; amount: string; who: string };
  nodes: ReplayNode[];
  steps: ReplayStep[];
  /** Real timing; null for the prevention radar, which is not a timed agent run. */
  timing: { briefAt: number; durationMs: number; lastResultAt: number } | null;
  verdict: {
    tone: "green" | "ink";
    ring?: { value: number; label: string };
    score?: { before: number; after: number };
    headlineLabel: string;
    headline: string;
    stats: string[];
    marksLabel: string;
    marks: ReplayMark[];
    action: { label: string; endpoint?: string; detail: string };
    quote?: { label: string; text: string; translation?: string };
  };
};
