import { clsx } from "clsx";

export type Tone = "neutral" | "outline" | "green" | "red" | "amber" | "blue" | "violet" | "ink";

/**
 * A small tag beside a value or inside a row: 20px, radius 6, Geist 12 at 500. Green and red carry meaning
 * (won, kept, failed, lost); everything else is neutral. `amber`, `blue` and `violet` are kept as aliases of
 * the neutral tones so older call sites stay calm.
 */
const tones: Record<Tone, string> = {
  neutral: "bg-[#f1f1ef] text-ink-2",
  outline: "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]",
  green: "bg-green-soft text-green",
  red: "bg-red-soft text-red",
  amber: "bg-[#f1f1ef] text-ink-2",
  blue: "bg-[#f1f1ef] text-ink-2",
  violet: "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]",
  ink: "bg-ink text-white",
};

export function Chip({ tone = "neutral", children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={clsx("inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] px-1.5 text-[12px] font-medium leading-none", tones[tone], className)}>
      {dot ? <span className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/** Exhibit's four calls. One tag style for all of them: the call is a recommendation, not a status. */
export const DECISION_META: Record<string, { label: string; tone: Tone; verb: string }> = {
  FIGHT: { label: "Fight", tone: "outline", verb: "File evidence" },
  OFFER: { label: "Offer", tone: "outline", verb: "Send offer" },
  REFUND: { label: "Refund", tone: "outline", verb: "Refund" },
  MESSAGE_BUYER: { label: "Message", tone: "outline", verb: "Message buyer" },
};

export function DecisionChip({ decision }: { decision: string | null }) {
  if (!decision) return <span className="text-[13px] text-faint">Not analyzed</span>;
  const m = DECISION_META[decision];
  return <Chip tone={m?.tone ?? "outline"}>{m?.label ?? decision}</Chip>;
}

/**
 * How a resolved case ended, in one word. Green for a win; red only for a fight that was lost or a case left
 * unanswered; a refund the merchant chose, or a settlement, is neutral. `answered` is the inbox's label for the
 * call that answered the case ("Evidence filed", "Claim accepted"…), when one succeeded.
 */
export function outcomeMeta(code: string | null | undefined, answered?: string | null): { label: string; tone: Tone } | null {
  if (!code) return null;
  if (code === "RESOLVED_SELLER_FAVOUR") return { label: "Won", tone: "green" };
  if (code === "RESOLVED_WITH_PAYOUT") return { label: "Settled", tone: "neutral" };
  if (code === "RESOLVED_BUYER_FAVOUR") {
    if (answered === "Claim accepted" || answered === "Refunded" || answered === "Offer sent") return { label: "Refunded", tone: "neutral" };
    if (answered === "Evidence filed" || answered === "Sent to PayPal's review") return { label: "Lost", tone: "red" };
    // Messaged but never fought: it went to the buyer without a loss on record. Unanswered is a missed deadline.
    return answered ? { label: "Closed for the buyer", tone: "neutral" } : { label: "Closed for the buyer", tone: "red" };
  }
  return { label: code.replace(/_/g, " ").toLowerCase(), tone: "neutral" };
}
