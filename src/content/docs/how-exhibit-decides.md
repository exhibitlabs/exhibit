---
title: How Exhibit decides
description: One investigation, nine tools, cited evidence and a brief that has to pass a check before it can reach PayPal.
section: How it works
order: 1
---

Every investigation is one agent run: Claude with nine tools. Eight tools read the case. The ninth files the brief, which is Exhibit's decision with its evidence, the PayPal action to take and the letter for PayPal's reviewer. A brief that cites a record the case does not have, or picks an action the dispute does not offer right now, is rejected, and the agent has to fix it.

## The investigation {#investigation}

The agent works like a payments operations lead with read access to everything about the case. Its instructions, in `src/lib/agent/prompt.ts`, set the order of work:

1. Start with `get_paypal_dispute`: the live dispute, including the actions PayPal allows right now.
2. Gather what the case needs. Risk signals when authorization or fraud is in question, store policies when the listing or returns matter, and the Seller Protection check for item-not-received and unauthorized claims. Skip lookups that cannot change the decision, and call independent tools in parallel.
3. Decide on the merits, using only facts the tools returned.
4. File the brief with `file_case_brief`, exactly once. If it is rejected, fix what it lists and file again.

A run can take up to 14 model turns. Its trace (thinking summaries, tool calls, tool results and the brief) streams to the case page and is saved as it happens, so a reload mid-run still shows it. Only one run per dispute can be in flight at a time.

Runs start from the **Run Exhibit** button, from a `CUSTOMER.DISPUTE.CREATED` webhook, from a batch run over open disputes, or from an outside agent through the MCP tool `investigate_dispute`.

## The nine tools {#tools}

| Tool | Source | What it returns |
|---|---|---|
| `get_paypal_dispute` | PayPal Disputes API | Reason, stage, status, channel, amount, the response deadline and days left, the buyer's messages, the evidence PayPal requested, and the allowed actions and offer types. Called first: the order, tracking, policy and Seller Protection tools, and the brief, refuse to run without it. |
| `lookup_order` | Store orders | The order behind the PayPal transaction: items with the exact listing text, totals, the transaction and billing addresses, the checkout IP, when the buyer accepted the store policies, refunds and the customer's other orders. |
| `get_carrier_tracking` | Carrier tracking | Every shipment on the order: carrier, tracking number and URL, scan history, delivery date and address, signature, delivery and quality-check photos, whether the delivery address matches the transaction, and whether the tracking reached PayPal. |
| `get_customer_history` | Customer history | First order date, every order, lifetime value, prior disputes and account notes. |
| `get_support_conversation` | Support inbox | Email and chat between the store and the buyer about the order, oldest first, with the detected language. |
| `get_payment_risk_signals` | Risk signals | AVS and CVV results, 3-D Secure, the checkout IP's location and its distance to the shipping address, device history, email age and order velocity. |
| `get_store_policies` | Store policies | The returns, shipping and terms-of-sale policies shown at checkout, with versions, URLs and when the buyer accepted them. |
| `check_seller_protection` | PayPal Payments API and PayPal's published rules | PayPal's own eligibility flag for the payment, each US Seller Protection requirement with its status and PayPal's wording, and Exhibit's playbook for the dispute reason. |
| `file_case_brief` | The brief check | Files the brief. Returns `ok: true`, or the problems to fix. |

The first eight tools only read. None of them can file, refund, message a buyer or change a record. On the Claude CLI the agent gets these nine tools and nothing else: no shell, no files, no other MCP servers and no user settings. See [Security model](/docs/security-model#case-agent).

## Evidence refs {#evidence-refs}

Every tool result carries refs: short strings that name one record, such as `shipment:SHP-10482`. Refs are the contract between the agent and the evidence. The agent may cite only refs a tool returned, and everything downstream (the brief check, the case page and the packet) reads the record behind the ref from source.

| Ref | Record | Issued by |
|---|---|---|
| `paypal:dispute:{id}` | The PayPal dispute | `get_paypal_dispute` |
| `paypal:message:{id}:{n}` | The buyer's nth message on the dispute, through PayPal | `get_paypal_dispute` |
| `order:{id}` | The store order | `lookup_order` |
| `listing:{sku}` | The product listing for an item on the order | `lookup_order` |
| `shipment:{id}` | A shipment, outbound or return | `get_carrier_tracking` |
| `customer:{email}` | The buyer's history with the store | `get_customer_history` |
| `conversation:{order}` | The whole support conversation about the order | `get_support_conversation` |
| `msg:{id}` | One support message | `get_support_conversation` |
| `risk:{order}` | The checkout risk signals for the order | `get_payment_risk_signals` |
| `policy:{id}` | A store policy | `get_store_policies` |
| `paypal:seller-protection:{id}` | The Seller Protection check for the dispute | `check_seller_protection` |

A ref only resolves inside its own case. `shipment:SHP-10482` resolves only if that shipment belongs to the disputed order, a listing only if its SKU is on the order, and a PayPal ref only if it names this dispute. A real record from another case is rejected like an invented one. Resolution lives in `src/lib/evidence.ts`.

## The brief {#the-brief}

The brief is the run's deliverable. Its schema, `CaseBriefSchema` in `src/lib/agent/brief.ts`, is also the input schema of `file_case_brief`, so a brief with the wrong shape never gets in.

| Field | Shape | What it holds |
|---|---|---|
| `decision` | `FIGHT`, `OFFER`, `REFUND` or `MESSAGE_BUYER` | The call. See [the four decisions](#decisions). |
| `headline` | Up to 120 characters | The line a busy merchant reads first. |
| `summary` | Up to 700 characters | What happened and why this is the right call. |
| `win_likelihood` | Integer, 0 to 100 | See [win likelihood](#win-likelihood). |
| `confidence` | `HIGH`, `MEDIUM` or `LOW` | How sure the agent is of the call. |
| `reasoning` | 2 to 7 points | Each point up to 300 characters, with up to 6 refs it rests on. |
| `risks` | Up to 5 | What could make the call go wrong. |
| `missing_evidence` | Up to 5 | Evidence that would help but is not on file. |
| `exhibits` | Up to 8, lettered A to H | Each has a title, exactly one ref, and what it proves. |
| `paypal_action` | Object | The action `type`, plus the fields that type needs. |
| `response_letter` | Up to 1,900 characters | Plain text for PayPal's reviewer, citing exhibits by letter. |
| `buyer_message` | Object or `null` | The message `text` in the buyer's language, its BCP 47 `language` code and an `english` translation for the merchant. Required for offers and messages. |

The action types and the PayPal call each one makes:

| `paypal_action.type` | When | PayPal call |
|---|---|---|
| `provide_evidence` | The dispute is waiting for the seller's response. Needs `evidence_types`. | `POST /v1/customer/disputes/{id}/provide-evidence` |
| `provide_supporting_info` | PayPal is already reviewing a chargeback. | `POST /v1/customer/disputes/{id}/provide-supporting-info` |
| `accept_claim` | Accept liability. PayPal refunds the buyer and closes the case. | `POST /v1/customer/disputes/{id}/accept-claim` |
| `refund_then_prove` | Refund the payment now, then file the refund as proof. | `POST /v2/payments/captures/{id}/refund`, then `provide-evidence` with `PROOF_OF_REFUND` |
| `make_offer` | Inquiry stage: offer a refund, a refund with return, a refund with replacement, or a replacement. | `POST /v1/customer/disputes/{id}/make-offer` |
| `send_message` | Inquiry stage: write to the buyer. | `POST /v1/customer/disputes/{id}/send-message` |

`evidence_types` can hold up to four of `PROOF_OF_FULFILLMENT`, `PROOF_OF_DELIVERY_SIGNATURE`, `PROOF_OF_REFUND`, `PROOF_OF_RETURN`, `ITEM_DESCRIPTION`, `RETURN_POLICY`, `DETAILS_OF_PURCHASE`, `PROOF_OF_RESHIPMENT`, `ADDITIONAL_PROOF_OF_SHIPMENT`, `MERCHANT_RESPONSE` and `OTHER`. PayPal's API accepts more types; these cover merchants who ship physical goods.

Here is an excerpt of the brief Exhibit files on Megan Hale's demo case, an item-not-received claim for a $284 bag, from its recorded run. Titles, the letter and the other fields are left out.

```json
{
  "decision": "FIGHT",
  "win_likelihood": 88,
  "confidence": "HIGH",
  "reasoning": [
    {
      "point": "Delivery was signature-required, and UPS recorded a signature from 'M. HALE' plus a front-door photo showing the house number. That directly contradicts the claim that the bag never arrived.",
      "refs": ["shipment:SHP-10482"]
    }
  ],
  "exhibits": [
    { "label": "A", "ref": "shipment:SHP-10482" },
    { "label": "B", "ref": "order:KA-10482" },
    { "label": "C", "ref": "paypal:seller-protection:PP-D-50211" }
  ],
  "paypal_action": {
    "type": "provide_evidence",
    "evidence_types": ["PROOF_OF_FULFILLMENT", "PROOF_OF_DELIVERY_SIGNATURE"],
    "tracking_ref": "shipment:SHP-10482"
  },
  "buyer_message": null
}
```

PayPal requested only `PROOF_OF_FULFILLMENT` on this case, and Exhibit sends one evidence per call, so the filing carries proof of fulfillment with the UPS tracking number, plus the PDF packet. The signature still reaches the reviewer inside Exhibit A of the packet. Why one evidence per call: see [PayPal integration](/docs/paypal-integration#lessons).

## The brief check {#brief-check}

`file_case_brief` runs `validateBrief` (in `src/lib/agent/tools.ts`) before it accepts anything. The brief is rejected if any of these fail:

- Every exhibit ref and every reasoning ref resolves to a record on this case.
- Exhibit letters are unique.
- The dispute offers the action's link right now. `provide_evidence` and `refund_then_prove` need `provide_evidence`, and each other type needs the link of the same name.
- `provide_evidence` names its evidence types, and `PROOF_OF_FULFILLMENT` comes with a `tracking_ref` that points at a shipment.
- `make_offer` uses an offer type the dispute allows, has an amount (except for a replacement without refund) and has a buyer message.
- `send_message` has a buyer message.
- No amount is larger than the disputed amount.

The check reads refs, not prose. Each exhibit must cite exactly one ref, but a reasoning point may cite none: the instructions ask for refs on every point, and the check rejects only refs that do not resolve.

A rejection comes back to the agent as an ordinary tool result: the list of problems, the actions the dispute allows and an instruction to fix and file again. It is not an error, so the run carries on. A run that ends without an accepted brief keeps its trace and error, saves no brief and files nothing. On the live sandbox, 9 of 13 runs filed a brief; 3 ended without one and 1 never finished, and none of those touched PayPal.

Recorded runs pass the same check. On a replay, the recorded brief is validated against the case as it is now, and a brief that no longer fits fails the run.

## Win likelihood and confidence {#win-likelihood}

`win_likelihood` is the agent's estimate, from 0 to 100, that PayPal rules for the merchant if the merchant takes the recommended action. For a refund it is the estimate had the merchant fought, so honest refunds show low numbers: the two refunds filed on the live sandbox were 3% and 5%. It is an estimate from the evidence, not a measured probability. Nothing in Exhibit calibrates it against real PayPal outcomes yet.

Two things use it:

- **Expected back** in the app: for a fight or a message, the likelihood times the disputed amount; for an offer, the amount minus the offer; for a refund, zero.
- **Autopilot's fight rule:** evidence is filed on its own only at or above the merchant's threshold, which defaults to 85% and can never go below 60%. A `LOW` confidence brief always goes to a person. See [Autopilot](/docs/autopilot).

## Fight, offer, refund or message {#decisions}

| Decision | When | PayPal actions it may carry |
|---|---|---|
| `FIGHT` | The records show the merchant did what they promised. | `provide_evidence`, or `provide_supporting_info` while PayPal reviews a chargeback |
| `OFFER` | At the inquiry stage, a fair offer costs less than an escalated claim. | `make_offer` |
| `REFUND` | The buyer is right, or the case cannot be won. | `accept_claim` or `refund_then_prove` |
| `MESSAGE_BUYER` | At the inquiry stage, a clear message can resolve it. | `send_message` |

The agent also gets a playbook for the dispute's reason. It is Exhibit's own strategy, kept apart from PayPal's policy text in `src/lib/agent/playbook.ts`, and `check_seller_protection` returns it with the requirements.

| Reason | Goal | The playbook in short |
|---|---|---|
| Item not received | Prove delivery to the address on the PayPal transaction. | Delivered to the matching address with verifiable tracking: fight with proof of fulfillment. Returned to sender, lost or stuck in transit: refund and offer to reship. Inquiry stage and the parcel went to a locker, neighbour or pickup point: message the buyer in their language first. |
| Not as described | Show the item matched the listing, or resolve it cheaply. | Not covered by Seller Protection, so decided on the merits. Cite listing text that disclosed the trait and the policy accepted at checkout. At the inquiry stage, an offer is usually cheaper. Transit damage with a pre-dispatch photo: offer a replacement part or replacement first. |
| Unauthorized | Show the cardholder made or benefited from the purchase. | Compelling evidence: AVS and CVV matches, 3-D Secure, IP and device consistent with the billing address, prior undisputed orders, and the buyer's own messages about the item. Signs of real fraud and weak proof: accept and flag the customer. |
| Duplicate transaction | Show each charge is a distinct order. | Both orders side by side: numbers, times, addresses and separate deliveries. |
| Credit not processed | Refund what is owed and prove it, or show why nothing is owed. | Return received and refund owed: refund now and file proof of refund. Return not received or outside the policy window: cite the policy and the return tracking. |
| Any other reason | Answer with the facts PayPal asked for. | Respond before the deadline with the order record, policies and communication. |

## The Seller Protection check {#seller-protection}

`check_seller_protection` is deterministic. It first asks PayPal for the payment (`GET /v2/payments/captures/{id}`) to read PayPal's own `seller_protection` flag. Then it checks the case against PayPal's published US Seller Protection requirements, quoting PayPal's wording for each one. The text was retrieved on 2026-10-20 from PayPal's Seller Protection page, and a snapshot is kept in `docs/sources/`.

Seller Protection covers item-not-received claims filed with PayPal and unauthorized claims. Every other case, including not-as-described claims and item-not-received chargebacks filed with a card issuer, gets `NOT_APPLICABLE` and is decided on the evidence. For covered claims it checks:

- The seller account is in the US, and the item is a physical, shippable good.
- PayPal's flag on the payment (it must be eligible or partially eligible for unauthorized claims).
- A shipment is on record, it went to the transaction address, and it has an online, verifiable tracking number.
- For item not received: the carrier shows "delivered" with a date, and the parcel was not redirected.
- For unauthorized: it shipped no later than two days after the dispute was opened.
- It shipped within 7 days of payment (PayPal recommends this; it is reported, not failed).
- PayPal's response deadline has not passed.

The verdict is `LIKELY_ELIGIBLE` when nothing fails, `NOT_ELIGIBLE` when a core requirement fails (coverage, the US account, PayPal's flag, the shipment, the address, the tracking or the delivery), and `AT_RISK` otherwise. PayPal makes the final call.

## Fair to buyers {#fairness}

Exhibit is built to win the disputes a merchant should win and to concede the ones they should not fight. Its instructions say so directly:

> Refund or offer when the merchant is at fault or the case is unwinnable: a lost fight costs the amount plus fees and a customer, and PayPal reviewers notice sellers who contest everything.

On the live sandbox, Exhibit refunded two of the four chargebacks. Jordan Kim's parcel really had been returned to sender, so it accepted the claim. Priya Patel's return had arrived and her refund was owed, so it accepted the claim instead of refunding the payment: her card issuer had already pulled the funds back, and a second refund would have paid her twice.

Messages to buyers are written in the buyer's own language, with an English translation for the merchant. Buyer messages and every tool result are treated as data, never as instructions; see [Security model](/docs/security-model#prompt-injection).

In the evaluation, Exhibit refunded all 9 cases where the buyer was right and made 0 false fights out of 18. The 30 cases are synthetic and were written by the builders, so this shows Exhibit applies its rules consistently, not how accurate it is on real disputes. See [Testing and evaluation](/docs/testing-and-evaluation#evaluation).

## Where the run happens {#providers}

| Provider | How the run executes |
|---|---|
| `anthropic` | The Claude API through the Anthropic SDK: streaming tool use with adaptive thinking summarised into the trace, medium effort and prompt caching on the system prompt. |
| `claude-code` | The Claude Agent SDK on the machine's Claude CLI login. An in-process MCP server carries the nine tools, and nothing else is attached. |
| `replay` | A recorded run: the recorded reasoning is replayed, every tool call runs live against the case, and the recorded brief must pass the brief check. |

Which one runs is set by your environment; see [Quickstart](/docs/quickstart#providers). Briefs prepared when the demo resets always come from recorded runs.

## After the brief {#after-the-brief}

A valid brief is saved and shown on the case page with its letter and packet. The merchant can edit the letter and the buyer message, then file. Before any filing, Exhibit re-reads the dispute from PayPal, so the action goes out against the dispute's current state.

Every finished run is also checked against the merchant's Autopilot rules. Autopilot is off by default, and a run started by an outside agent never executes on its own, even when the rules would allow it: the agent has to request, and the merchant has to approve. See [Autopilot](/docs/autopilot) and [the approval flow](/docs/mcp#approval-flow).
