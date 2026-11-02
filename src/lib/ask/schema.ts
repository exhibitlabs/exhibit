import { z } from "zod";

// Shared between the server (tools, validation) and the palette (rendering). No server-only imports.

export const CHART_TONES = ["green", "red", "grey", "ink", "amber"] as const;
export type ChartTone = (typeof CHART_TONES)[number];

export const ChartSchema = z.object({
  type: z.enum(["bar", "line", "donut"]).describe("bar for comparisons across groups or weeks, line for a trend over time, donut for a split of one total."),
  title: z.string().max(70).describe("Short title, e.g. 'Item-not-received outcomes, last 90 days ($)'."),
  unit: z.enum(["usd", "count", "percent", "hours"]),
  labels: z.array(z.string().max(40)).min(1).max(14).describe("Category or week labels, one per value."),
  series: z
    .array(
      z.object({
        name: z.string().max(40),
        values: z.array(z.number()).describe("One value per label, copied exactly from a tool result."),
        tone: z.enum(CHART_TONES).optional().describe("green = money kept or won, red = lost, grey = refunded or neutral, ink = counts."),
      }),
    )
    .min(1)
    .max(3),
  stacked: z.boolean().optional(),
});
export type AnswerChart = z.infer<typeof ChartSchema>;

/** What the model (or the offline router) files as its answer. */
export const AnswerInputSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(1600)
    .describe("The answer in plain words: 2-5 short sentences or a few '- ' bullets. Bold the single key fact with **double asterisks**. Every number must come from a tool result."),
  chart: ChartSchema.nullable().optional().describe("One small chart when it makes the answer clearer, otherwise null."),
  cases: z
    .array(z.object({ id: z.string().describe("A dispute id from a tool result."), note: z.string().max(60).optional().describe("Why to open it, e.g. 'due in 26h'.") }))
    .max(6)
    .optional(),
  orders: z
    .array(z.object({ id: z.string().describe("An order id from at_risk_orders."), note: z.string().max(60).optional() }))
    .max(6)
    .optional(),
  followups: z.array(z.string().max(80)).max(3).describe("2-3 short follow-up questions the merchant might ask next."),
});
export type AnswerInput = z.infer<typeof AnswerInputSchema>;

export type CaseChip = { id: string; buyer: string; reason: string; amount: number; currency: string; status: string; hoursLeft: number | null; decision: string | null; note?: string; href: string };
export type OrderChip = { id: string; buyer: string; item: string; amount: number; band: string; signal: string | null; note?: string; href: string };

/** The answer as the palette renders it: chips are resolved server-side from real records. */
export type Answer = { text: string; chart: AnswerChart | null; cases: CaseChip[]; orders: OrderChip[]; followups: string[] };

export type AskStep = { id: string; name: string; label: string };

export type AskEvent =
  | { t: "start"; provider: AskProviderKind; model: string; label: string }
  | { t: "step"; step: AskStep }
  | { t: "step_done"; id: string; summary: string; ms: number; ok: boolean }
  | { t: "text"; text: string }
  | { t: "text_reset" }
  | { t: "answer"; answer: Answer }
  | { t: "notice"; message: string }
  | { t: "error"; message: string }
  | { t: "done"; ms: number };

export type AskProviderKind = "anthropic" | "claude-code" | "offline";

export type AskTurn = { q: string; a: string };

export type AskIndex = {
  provider: AskProviderKind;
  label: string;
  cases: { id: string; buyer: string; reason: string; amount: number; status: string; hoursLeft: number | null; decision: string | null }[];
  orders: { id: string; buyer: string; item: string; amount: number; band: string; signal: string | null }[];
  suggestions: string[];
};

export const SUGGESTED_QUESTIONS = [
  "Which disputes need me today?",
  "Why are we losing item-not-received cases?",
  "How much has Exhibit recovered this quarter?",
  "Which orders are about to turn into disputes?",
  "Summarize the Daniel Reyes case for my accountant",
  "What's our win rate by dispute reason?",
];
