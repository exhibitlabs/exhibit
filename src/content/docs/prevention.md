---
title: Prevention
description: Seven warning signs, a risk score per order, and fixes through PayPal's APIs or the support inbox, before a buyer files.
section: How it works
order: 3
---

The cheapest dispute is the one that never opens. Prevention watches recent orders that have no dispute yet, scores each one for seven warning signs, and offers a fix for each sign: through PayPal's APIs where one exists, and through the merchant's support inbox for messages, since PayPal has no messaging API before a dispute exists.

Prevention is deterministic. The scoring in `src/lib/prevention.ts` uses no model, so the same records always give the same score. It feeds the **Prevention** page in the app, `/api/prevention`, Ask Exhibit and the MCP server.

## What it watches {#watched-orders}

Every order placed in the last 45 days that has no dispute. When a dispute opens on an order, the order leaves the radar and the case agent takes over. Orders refunded in full with nothing left to protect drop off too, unless Exhibit made the refund.

## The seven signals {#signals}

| Signal | Fires when | Weight | Leads to | Fixes |
|---|---|---|---|---|
| Tracking not on PayPal | The order shipped, but its tracking number never reached PayPal. | 40 while in transit, 30 once delivered | Item not received | Push tracking |
| Tracking stalled | The parcel is not delivered or returned, and the carrier reported an exception, or there has been no scan for 4 or more days, or the promised delivery date has passed. | 55 for an exception. Otherwise 30, plus 6 per quiet day past the fourth, plus 15 if late, up to 70. | Item not received | Message buyer |
| No signature | Delivered without a signature on an order above the signature threshold, $250 by default, as the shipping policy promises. | 40 above $350, otherwise 30 | Item not received | Message buyer, and require signatures over the threshold until that rule is on |
| Address mismatch | Delivered to an address other than the PayPal transaction address, which voids Seller Protection. | 45 | Item not received | Message buyer |
| Refund overdue | The return arrived 3 or more days ago and the refund owed (the order total less shipping) has not gone out. | 60, plus 4 per extra day, up to 85 | Credit not processed | Refund |
| Buyer waiting | The last message is the buyer's, and it is 24 or more hours old, or it mentions a dispute or a chargeback, or it asks where the order is. | 20, plus 8 per extra day, plus 45 for dispute words, or 20 for where-is-my-order words, plus 15 for an unhappy tone, up to 85 | Depends on the order: not as described, credit not processed or item not received | Message buyer, plus a refund when a return is owed |
| Weak checkout | A first order of $200 or more with at least two of: AVS mismatch, CVV mismatch, a card payment without 3-D Secure, an IP in another country or more than 1,500 km away, an email under 14 days old, 3 or more orders in 24 hours, different billing and shipping addresses. | 15 plus 12 per flag, up to 85 | Unauthorized | Hold and verify, or cancel and refund, before it ships. Message buyer or refund after. |

Dispute words and where-is-my-order words are matched in English, German, French, Italian and Spanish, the languages the demo store sells to.

## How an order is scored {#scoring}

Each signal's weight is treated as an independent chance that the order becomes a dispute, capped at 95. The order's score combines them:

```text
score = 100 × (1 − (1 − w1/100) × (1 − w2/100) × …), rounded
```

| Band | Score |
|---|---|
| High | 65 and up |
| Elevated | 40 to 64 |
| Watch | 15 to 39 |
| Clear | Below 15 |

Each order also gets an exposure: what a dispute would cost. That is the order total, less anything already refunded, plus PayPal's dispute fee: $15 for PayPal checkout payments and $20 for card payments, from PayPal's US merchant fees page as retrieved on 2026-10-21. PayPal's $30 high-volume fee is not modelled. The radar's expected disputes figure is the sum of the at-risk orders' scores divided by 100.

## The fixes {#fixes}

| Fix | What Exhibit does | Through |
|---|---|---|
| Push tracking to PayPal | Adds the carrier and tracking number to the PayPal order, so proof of shipment is on file before any claim. | `POST /v2/checkout/orders/{id}/track` |
| Refund (the button shows the amount, for example "Refund $54.00") | Refunds what is owed (the order total less shipping and earlier refunds) and tells the buyer if they were waiting. | `POST /v2/payments/captures/{id}/refund` |
| Cancel & refund | For a weak checkout: cancels before anything ships and refunds the full payment. | `POST /v2/payments/captures/{id}/refund` |
| Message buyer | Sends a status update in the buyer's language. | The support inbox |
| Hold & verify buyer | Holds fulfilment and asks the buyer to confirm their billing details. | The support inbox |
| Require signature over threshold | Turns on a store rule: every label above the threshold needs signature confirmation. | A store setting |
| Not a risk | Takes the order off the radar until something new happens. | Nothing is sent |

Fixes that leave proof on PayPal's side come first: refund, then push tracking, then hold and verify, then the message. For a weak checkout, hold and verify leads. The tracking push sends the capture id, the tracking number and the carrier, with `notify_payer` set to `false`.

A fix recorded after a signal began clears that signal, and **Not a risk** clears everything up to that moment. A new event, such as another buyer message, raises a new signal. Each fix records the score before and after, and when an order leaves the radar its exposure counts as saved: the whole exposure, or only the dispute fee when the fix was a refund the buyer was owed anyway.

## Messages in the buyer's language {#messages}

Message drafts are written per language, not machine-translated at send time, so they work with no model at all. There are templates in English, German and French for each situation: a stalled parcel, a delivery exception, a delivered parcel the buyer cannot find, an item that is not what they expected, a redirected parcel, a receipt check, a refund issued, a verification request and a general reply. The language comes from the buyer's last message, or else from their country. Other languages fall back to English. A draft in another language carries an English translation for the merchant, and the merchant can edit it before it goes.

## An example from the demo {#example}

Lena Hoffmann in Berlin ordered a $379 Travel Duffle. Her DHL Express parcel has been sitting in customs at the Leipzig hub with no scan for days, and she wrote in German that she will open a PayPal dispute (*"eröffne ich einen Konflikt bei PayPal"*) if she hears nothing by the end of the week.

When we checked the demo, two signals fired: **Buyer waiting** at 73 (dispute words, unanswered for two days) and **Tracking stalled** at 57 (six quiet days, past the promised date). Weights move with time, so your numbers may differ. They combine to 1 − 0.27 × 0.43 ≈ 0.88, a score of 88, in the high band. The exposure is $394: the $379 order plus the $15 dispute fee. The fix is **Message buyer**, with a German reply drafted and an English translation beside it. Lena, her order and her parcel are demo data.

## Use it from code {#api}

| Route | What it does |
|---|---|
| `GET /api/prevention` | The full report: at-risk and resolved orders, totals, signals by kind and the dispute fee schedule. |
| `GET /api/prevention?orderId=KA-10561` | One order and the message Exhibit would send for it. |
| `POST /api/prevention` | Runs a fix. Send `{ "orderId": "KA-10561", "action": "message_buyer" }`, optionally with `message: { subject, body }` to replace the draft. |

The actions are `push_tracking`, `refund`, `message_buyer`, `hold_and_verify`, `require_signature` and `dismiss`. A fix that does not apply to the order right now is refused with 422.

Outside agents use the MCP tools `get_prevention_report`, which reads, and `request_prevention_fix`, which only queues the fix for the merchant's approval. When the merchant approves, Exhibit runs the same fix as the button in the app. See [MCP server](/docs/mcp#tools). Ask Exhibit reads the same report through its `at_risk_orders` tool.
