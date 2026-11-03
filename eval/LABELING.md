# How the eval cases are labelled

These rules set the correct decision for every case in [`cases.ts`](cases.ts). They were written before any case existed, and every label was written, with its one-line rationale, at the same time as its case and before Exhibit ran on anything. A label is not changed after seeing Exhibit's output unless it is objectively wrong (it breaks these rules or misreads the case's own records). Any change is listed with its reason in [`RESULTS.md`](RESULTS.md).

**Who wrote them.** The builder wrote the cases, the labels and these rules: Claude Opus 5.5, an AI coding agent, working for Exhibit's founder. That is the same model family as the agent under test. See the limitations in `RESULTS.md`.

## The four decisions

These are the decision classes from the agent's brief schema (`src/lib/agent/brief.ts`), with the PayPal actions each one may carry (`ACTIONS_FOR` in `src/lib/autopilot-rules.ts`):

| Decision | Brief schema wording | PayPal actions |
| --- | --- | --- |
| `FIGHT` | "file evidence" | `provide_evidence`, `provide_supporting_info` |
| `OFFER` | "propose a resolution to the buyer" | `make_offer` |
| `REFUND` | "accept or refund now" | `accept_claim`, `refund_then_prove` |
| `MESSAGE_BUYER` | "resolve in conversation first" | `send_message` |

A label is the one decision a careful payments-operations lead at the merchant should take on the records in the case. The class follows the action:

- Filing proof of a refund already issued is `FIGHT`: it files evidence.
- Offering a full refund through `make_offer` is `OFFER`.
- Refunding now and then filing proof of the refund is `REFUND`.

## Rule 1: only what PayPal allows right now

PayPal lists the allowed responses as HATEOAS links on the dispute. The simulator mirrors them in `linksFor`.

| Dispute state | Links | Possible labels |
| --- | --- | --- |
| Inquiry, waiting for the seller | `provide_evidence`, `accept_claim`, `make_offer`, `send_message` | any of the four |
| Chargeback (claim) stage, waiting for the seller | `provide_evidence`, `accept_claim` | `FIGHT` or `REFUND` |
| Under PayPal review | `provide_supporting_info` only | `FIGHT` |

A label is never a decision PayPal would reject. The set only puts cases under review where the merchant has a case, since no other response exists there.

## Rule 2: decide on the records, in this order

1. **Is money owed?** Sometimes the records show the buyer is owed: nothing was delivered, the parcel was lost or came back, a refund is owed under the merchant's own policy or was promised in writing, a charge really was duplicated or too high, or the wrong item was sent. Then the merchant does not fight. The label is `REFUND`. At inquiry it is `OFFER` instead when the buyer asked for a lesser remedy, or the policy provides one (for example, a repair or replacement for a defect).
2. **Do the records answer the claim?** If the merchant holds the evidence that PayPal's rules (Rule 3) or plain proof of purchase call for, and nothing is owed, the merchant defends. At the chargeback stage or under review, the label is `FIGHT`. At inquiry:
   - `MESSAGE_BUYER` when the buyer is missing information the store can supply and has not been given yet: where the parcel is, that a return is still in transit, that two charges are two orders, or how a bank converted a charge.
   - `FIGHT` when the store already gave that information and the buyer rejected it.
3. **Is it genuinely arguable?** When both sides have a point, the label at inquiry is `OFFER` (partial refund, return, replacement). Examples: cosmetic damage in transit, a disclosed trait on an unused item still inside the return window, a return that came back used. At the chargeback stage no offer is possible, so steps 1 and 2 decide.

Never:

- keep the money for goods the merchant never delivered or has back on its shelf
- refund twice
- give money away for a claim the records refute
- pay to fight a refund the merchant owes

## Rule 3: PayPal's rules and the merchant's policy, by reason

PayPal quotes are from its Seller Protection program page (US, "Last updated on January 26, 2026"), snapshot in `docs/sources/paypal-us-seller-protection-2026-10-20.txt`. Merchant policy quotes are the demo merchant's checkout policies (`POLICIES` in `src/lib/store/scenarios.ts`), which every case uses.

### Item not received (`MERCHANDISE_OR_SERVICE_NOT_RECEIVED`)

PayPal:

> You must ship the item to the shipping address on the Transaction Details page in your PayPal account for the transaction. If you originally ship the item to the recipient's shipping address on the Transaction Details page but the item is later redirected to a different address, you will not be eligible for PayPal's Seller Protection program.

> Proof of delivery: Online or physical documentation from a shipping company that includes: An online and verifiable tracking number. Date of delivery and 'delivered' status. An address for the recipient that matches the shipping address on the Transaction Details page.

> Item Not Received claims filed by your buyer directly with their card issuer. (listed under "Ineligible Items and Transactions")

Labels:

- **Delivered with a date, a verifiable tracking number, and an address that matches the transaction:**
  - Chargeback stage or under review: `FIGHT`. The published requirements do not include a signature, so a signature strengthens the case but is not required.
  - Inquiry: `MESSAGE_BUYER` when the carrier left the parcel somewhere the buyer may not have looked (front desk, neighbour, locker, pickup point). `FIGHT` when the store already showed the buyer the proof and the buyer rejected it.
- **Not delivered:** lost, stuck behind a carrier exception, returned to sender, or delivered to an address that does not match the transaction. Label `REFUND`, or `MESSAGE_BUYER` at inquiry when the parcel is waiting for the buyer at a pickup point.
- **Not-received chargeback filed with the card issuer:** Seller Protection does not apply, but the issuer still decides on evidence. A signed delivery at the cardholder's address is `FIGHT`.

### Unauthorized (`UNAUTHORISED`)

PayPal:

> PayPal's Seller Protection program may also apply when a transaction is reversed because of a successful chargeback by a buyer because they did not authorize the card-funded payment

> In the case of Unauthorized Transaction claims, the payment must be marked "eligible" or "partially eligible" for PayPal's Seller Protection program on the Transaction Details page.

> In the case of Unauthorized Transaction claim, you must provide valid proof of shipment or proof of delivery that demonstrates that the item was shipped or provided to the buyer no later than two days after PayPal notified you of the dispute or reversal.

Labels:

- **Shipped and delivered to the transaction address, payment eligible, with proof:** `FIGHT`. For card chargebacks it is also `FIGHT` when checkout evidence ties the cardholder to the purchase: AVS and CVV match, 3-D Secure, a known device, prior undisputed orders, or contact after delivery.
- **Shipped somewhere other than the transaction address** (for example, re-routed on an emailed request) and the signals point to real fraud: protection is lost, so `REFUND`.
- **Nothing was delivered and the goods are back with the merchant:** `REFUND`, whatever the authentication signals say (Rule 2.1).

### Not as described (`MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED`)

PayPal:

> Items where the buyer claims (either with us or their card issuer) that the item you sent isn't what was ordered (referred to as a Significantly Not as Described claim) are not eligible.

So these cases are decided on the merits: the listing text, the terms accepted at checkout, the returns policy, and the store's own photos.

> Every piece is cut and stitched by hand from full-grain, vegetable-tanned leather. Natural leather varies in tone, grain and markings from hide to hide, and colors darken with light and use; product photos are taken in daylight and show a representative hide. These variations are not defects. (Terms of Sale, shown at checkout)

> Unused items in original condition can be returned within 30 days of delivery for a full refund. [...] Defective or damaged items are repaired, replaced, or refunded at our cost. (Returns & Refunds, shown at checkout)

Labels:

- **The store sent the wrong item, or a defective one, and holds no counter-evidence:** `REFUND` at the chargeback stage. At inquiry, `OFFER` when the buyer asked for a repair or replacement.
- **The complaint is a trait the listing or terms disclosed, and the item is used or outside the 30-day window:** `FIGHT`.
- **A disclosed trait, but the item is unused and inside the window:** `OFFER`, since the policy would take it back anyway.
- **Cosmetic damage in transit that the buyer wants to keep:** `OFFER` (partial refund).

### Credit not processed (`CREDIT_NOT_PROCESSED`)

This is not a Seller Protection reason. The policy:

> Refunds are issued to the original payment method within 3 business days of the return arriving at our studio.

Labels:

- **Return arrived and the refund is owed but not issued:** `REFUND` (refund now, then prove it).
- **Refund already issued:** `FIGHT`. File the proof of refund; never refund twice.
- **No return was started or received, and the window had closed:** `FIGHT`.
- **Return still in transit, at inquiry:** `MESSAGE_BUYER`.
- **Return arrived, but not in the condition the policy requires, at inquiry:** `OFFER`.

### Duplicate charge (`DUPLICATE_TRANSACTION`)

- **Two orders the buyer placed** (different times or recipients, or the buyer's own words): `FIGHT` at the chargeback stage, `MESSAGE_BUYER` at inquiry.
- **The same cart paid twice with one fulfilment:** `REFUND`.

### Incorrect amount (`INCORRECT_AMOUNT`)

- **Charged more than agreed, by the store's own records:** `REFUND` the difference.
- **Charged exactly the listed price the buyer accepted at checkout:** `FIGHT` at the chargeback stage. At inquiry, `MESSAGE_BUYER` when the gap is a currency conversion or bank fee the store neither sets nor receives.

### Paid by other means (`PAYMENT_BY_OTHER_MEANS`)

- **The same order was paid twice, once outside PayPal:** `REFUND` the PayPal payment.
- **The other payment was for a different purchase:** `FIGHT` at the chargeback stage.

### Reasons left out

`CANCELED_RECURRING_BILLING`, `PROBLEM_WITH_REMITTANCE` and `OTHER` are not in the set. The demo merchant sells physical goods and has no subscriptions.

## What a case contains, and what the agent sees

Each case uses the demo store's scenario format (`ScenarioRecords` in `src/lib/store/scenarios.ts`):

- one PayPal dispute, served by the simulator
- the order, with its listing
- shipments, outbound and return
- the buyer's history
- the support thread
- checkout risk signals

Store policies and products are the demo merchant's. The eval only adds new disputes and records. Dates are relative to the moment of seeding, as in the demo.

The label, the rationale and the case title are never written to the store, so the agent cannot see them. It runs with only Exhibit's nine tools: no file, shell or web access.
