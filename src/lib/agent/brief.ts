import { z } from "zod";
import { EVIDENCE_TYPES } from "../paypal/types";

export const DECISIONS = ["FIGHT", "OFFER", "REFUND", "MESSAGE_BUYER"] as const;
export type Decision = (typeof DECISIONS)[number];

export const ACTION_TYPES = ["provide_evidence", "provide_supporting_info", "make_offer", "accept_claim", "refund_then_prove", "send_message"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const OFFER_TYPES = ["REFUND", "REFUND_WITH_RETURN", "REFUND_WITH_REPLACEMENT", "REPLACEMENT_WITHOUT_REFUND"] as const;

export const CaseBriefSchema = z.object({
  decision: z.enum(DECISIONS).describe("FIGHT = file evidence; OFFER = propose a resolution to the buyer; REFUND = accept or refund now; MESSAGE_BUYER = resolve in conversation first."),
  headline: z.string().max(120).describe("One line a busy merchant reads first, e.g. 'Signed for at the door: fight with proof of delivery'."),
  summary: z.string().max(700).describe("Two or three sentences: what happened and why this is the right call."),
  win_likelihood: z.number().int().min(0).max(100).describe("Your estimate (0-100) that PayPal rules for the merchant if they take your recommended action. For REFUND use the likelihood had they fought."),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reasoning: z
    .array(z.object({ point: z.string().max(300), refs: z.array(z.string()).max(6).describe("Evidence refs returned by tools, e.g. shipment:SHP-10482") }))
    .min(2)
    .max(7),
  risks: z.array(z.string().max(260)).max(5).describe("What could make this go wrong."),
  missing_evidence: z.array(z.string().max(220)).max(5).describe("Evidence that would help but we do not have."),
  exhibits: z
    .array(
      z.object({
        label: z.string().regex(/^[A-H]$/).describe("Exhibit letter, A first."),
        title: z.string().max(80),
        ref: z.string().describe("Exactly one evidence ref from a tool result."),
        why: z.string().max(240).describe("What this exhibit proves."),
      }),
    )
    .max(8),
  paypal_action: z.object({
    type: z.enum(ACTION_TYPES).describe(
      "provide_evidence: file evidence (needs provide_evidence link). provide_supporting_info: send the response and evidence packet to PayPal for a chargeback it is already reviewing (needs provide_supporting_info link). make_offer: inquiry-stage offer. accept_claim: accept liability and refund. refund_then_prove: refund the capture now, then file PROOF_OF_REFUND. send_message: inquiry-stage message to the buyer.",
    ),
    evidence_types: z.array(z.enum(EVIDENCE_TYPES)).max(4).optional().describe("For provide_evidence / refund_then_prove."),
    tracking_ref: z.string().optional().describe("Shipment ref whose carrier and tracking number go into PROOF_OF_FULFILLMENT."),
    offer_type: z.enum(OFFER_TYPES).optional().describe("For make_offer; must be one of the dispute's allowed offer types."),
    amount: z.number().min(0).optional().describe("Offer or refund amount in the dispute currency."),
  }),
  response_letter: z
    .string()
    .max(1900)
    .describe("The response PayPal's reviewer reads (sent as evidence notes / offer note). Plain text, factual, cites exhibits by letter. No placeholders."),
  buyer_message: z
    .object({
      language: z.string().describe("BCP-47 code of the buyer's language, e.g. de"),
      text: z.string().max(1900).describe("Message to the buyer, written in their language."),
      english: z.string().max(1900).optional().describe("English translation for the merchant when language is not en."),
    })
    .nullable()
    .describe("A message to the buyer when one helps (required for send_message and make_offer), otherwise null."),
});

export type CaseBrief = z.infer<typeof CaseBriefSchema>;

export function expectedRecovery(brief: CaseBrief, amount: number) {
  switch (brief.decision) {
    case "FIGHT":
      return (brief.win_likelihood / 100) * amount;
    case "OFFER":
      return Math.max(0, amount - (brief.paypal_action.amount ?? 0));
    case "MESSAGE_BUYER":
      return (brief.win_likelihood / 100) * amount;
    default:
      return 0;
  }
}
