# Exhibit over MCP: a real agent run

Recorded 2026-10-20 23:41 UTC with `node mcp/agent-demo.ts`. Claude (claude-opus-5-5, via the Claude Agent SDK) had **only** the Exhibit MCP server attached (stdio, `EXHIBIT_URL=http://localhost:3101`, PayPal demo mode, Exhibit agent: replay). No other tools, no filesystem, no shell.

> **Merchant:** Triage my open PayPal disputes and get the strongest one ready to file.

**→ `list_disputes`** `{}`

<details><summary>Exhibit returned</summary>

```
{"count":8,"total_amount":1805,"disputes":[{"id":"PP-D-50219","buyer":"Daniel Reyes","item":"Atelier Briefcase — Espresso","reason":"Unauthorized","reason_code":"UNAUTHORISED","stage":"Chargeback","status":"PayPal reviewing","amount":420,"currency":"USD","response_due":"2026-10-21T23:59:00Z","hours_left":24,"exhibit_call":"FIGHT","win_likelihood":88,"headline":"Signed for by D REYES, 3DS-authenticated, buyer chatted about the item — fight","outcome":null,"investigated":true,"case_url":"http://localhost:3101/app/disputes/PP-D-50219"},{"id":"PP-D-50227","buyer":"Aaron Brooks","item":"Classic Belt — Cognac","reason":"Duplicate charge","reason_code":"DUPLICATE_TRANSACTION","stage":"Chargeback","status":"Needs response","amount":96,"currency":"USD","response_due":"2026-10-22T23:59:00Z","hours_left":48,"exhibit_call":null,"win_likelihood":null,"headline":null,"outcome":null,"investigated":false,"case_url":"http://localhost:3101/app/disputes/PP-D-50227"},{"id":"PP-D-50211","buyer":"Megan Hale","item":"The Weekender — Cognac","reason":"Item not received","reason_code":"MERCHANDISE_OR_SERVICE_NOT_RECEIVED","stage":"Chargeback","status":"Needs response","amount":284,"currency":"USD","response_due":"2026-10-28T23:59:00Z","hours_left":192,"exhibit_call":null,"win_likelihood":null,"headline":null,"outcome":null,"investigated":false,"case_url":"http://localhost:3101/app/disputes/PP-D-50211"}
… (2181 more characters)
```
</details>

**→ `get_case_brief`** `{"dispute_id":"PP-D-50219"}`

<details><summary>Exhibit returned</summary>

```
{"dispute_id":"PP-D-50219","buyer":"Daniel Reyes","amount":420,"currency":"USD","status":"UNDER_REVIEW","response_due":"2026-10-21T23:59:00Z","decision":"FIGHT","headline":"Signed for by D REYES, 3DS-authenticated, buyer chatted about the item — fight","summary":"The cardholder says this $420 briefcase order was unauthorized. Nothing in the records backs that up. Checkout passed 3-D Secure with AVS and CVV matches, from a device the customer has used since February and an IP 4 km from his address. UPS got a signature from \"D REYES\" at the transaction address, and the next day the buyer messaged the store to say the briefcase arrived and was beautiful. Seller Protection requirements all pass, so fight with the proof.","win_likelihood":88,"confidence":"HIGH","reasoning":[{"point":"Checkout was authenticated: 3-D Secure AUTHENTICATED, AVS Y, CVV M. The IP was in Columbus, OH, 4 km from the shipping address, on device dv_aa07, first seen 2026-02-02.","refs":["risk:KA-10503"]},{"point":"Shipped by UPS 2nd Day Air with signature required to the transaction address. Delivered 2026-09-28, signed by D REYES. Tracking is already synced to PayPal.","refs":["shipment:SHP-10503","order:KA-10503"]},{"point":"On 2026-09-29 the buyer wrote 'Briefcase arrived, it's beautiful' and asked about the combination lock. He received the item and used it.","refs":["msg:MSG-10503-1"]},{"point":"Establi
… (3913 more characters)
```
</details>

**→ `investigate_dispute`** `{"dispute_id":"PP-D-50227"}`

**→ `investigate_dispute`** `{"dispute_id":"PP-D-50211"}`

**→ `investigate_dispute`** `{"dispute_id":"PP-D-50240"}`

**→ `investigate_dispute`** `{"dispute_id":"PP-D-50214"}`

**→ `investigate_dispute`** `{"dispute_id":"PP-D-50223"}`

**→ `investigate_dispute`** `{"dispute_id":"PP-D-50231"}`

**→ `investigate_dispute`** `{"dispute_id":"PP-D-50236"}`

<details><summary>Exhibit returned</summary>

```
{"dispute_id":"PP-D-50227","buyer":"Aaron Brooks","amount":96,"currency":"USD","status":"WAITING_FOR_SELLER_RESPONSE","response_due":"2026-10-22T23:59:00Z","decision":"FIGHT","headline":"Not a duplicate: second belt was a gift to his brother in Denver, delivered — fight","summary":"The buyer says he was charged $96 twice for the same belt. Our records show two separate orders. This charge (KA-10519) was a gift shipped to Ethan Brooks in Denver and delivered by UPS on Oct 8. The buyer emailed us himself asking for a birthday gift note for his brother in Denver on this order. Each charge paid for its own belt, so we should fight.","win_likelihood":78,"confidence":"MEDIUM","reasoning":[{"point":"KA-10519 is its own order: one Cognac belt for $96, shipping to Ethan Brooks, 2650 Larimer St, Denver. The customer record shows the buyer's other order went to himself in Seattle, placed eleven minutes apart.","refs":["order:KA-10519","customer:aaron.brooks@example.com"]},{"point":"The buyer wrote to us that he had 'just ordered a second belt for my brother in Denver' and asked for a 'Happy 30th, E' gift note. The merchant confirmed the note was added to KA-10519. That shows he meant to place the second order.","refs":["msg:MSG-10519-1","msg:MSG-10519-2"]},{"point":"UPS delivered KA-10519 to the Denver address on the transaction on 2026-10-08. Tracking was synced to PayPal.","refs":["ship
… (3937 more characters)
```
</details>

<details><summary>Exhibit returned</summary>

```
{"dispute_id":"PP-D-50211","buyer":"Megan Hale","amount":284,"currency":"USD","status":"WAITING_FOR_SELLER_RESPONSE","response_due":"2026-10-28T23:59:00Z","decision":"FIGHT","headline":"Signed for by M. HALE at the matching Austin address — fight with UPS proof of delivery","summary":"Megan Hale says her Weekender bag ($284) never arrived. UPS tracking 1Z84V6A90392847516 shows it was shipped one day after payment and delivered on 2026-10-05 to the exact address on the PayPal transaction. The delivery was signed for by \"M. HALE\" and the carrier took a photo at the front door. Every Seller Protection requirement is met, so the merchant should fight with proof of fulfillment and the signature.","win_likelihood":88,"confidence":"HIGH","reasoning":[{"point":"UPS shows the parcel delivered 2026-10-05 16:52 to 2207 Cedar Bend Dr, Austin TX 78758, the same as the transaction shipping address. Tracking was already synced to PayPal.","refs":["shipment:SHP-10482","order:KA-10482"]},{"point":"Delivery was signature-required, and UPS recorded a signature from 'M. HALE' plus a front-door photo showing the house number. That directly contradicts the claim that the bag never arrived.","refs":["shipment:SHP-10482"]},{"point":"The Seller Protection check passes on every requirement: covered claim type, matching address, verifiable tracking, delivered status, no redirect, shipped within 1 day."
… (3444 more characters)
```
</details>

<details><summary>Exhibit returned</summary>

```
{"dispute_id":"PP-D-50240","buyer":"Sam Ortiz","amount":355,"currency":"USD","status":"WAITING_FOR_SELLER_RESPONSE","response_due":"2026-10-28T23:59:00Z","decision":"OFFER","headline":"Strap ring cracked in transit — offer a free replacement, don't fight","summary":"Sam Ortiz's $355 Chestnut Travel Duffle was delivered on Oct 16. The next day Sam emailed a photo showing one brass strap ring cracked through, and that email never got a reply. Our QC photo shows both rings were intact when we packed it, so the damage almost certainly happened in transit. That doesn't help us in a damaged-item claim, and our own returns policy promises to repair, replace or refund damaged items at our cost. The case is still at the inquiry stage, so offering a replacement now keeps the customer and should close it before it escalates.","win_likelihood":20,"confidence":"HIGH","reasoning":[{"point":"The buyer reports damage, not a listing mismatch. One brass strap ring is cracked, so the detachable strap can't be used. Sam told us first by email with a photo, the day after delivery.","refs":["paypal:message:PP-D-50240:0","msg:MSG-10529-1","listing:KA-DUF-CHS"]},{"point":"Our QC photo shows both rings intact at packing. The FedEx parcel went through the Memphis hub and was left at the front door with no signature or delivery photo. Damage in transit is the likeliest cause, and in a damaged-item claim 
… (4401 more characters)
```
</details>

<details><summary>Exhibit returned</summary>

```
{"dispute_id":"PP-D-50214","buyer":"Oliver Grant","amount":166,"currency":"USD","status":"WAITING_FOR_SELLER_RESPONSE","response_due":"2026-10-29T23:59:00Z","decision":"OFFER","headline":"Colour complaint, item as listed. Offer a full refund on return, as the 30-day policy allows","summary":"Oliver received the Tan Market Tote on 12 Oct and says it is darker and browner than the photos. The listing and Terms of Sale both warn that hide tone varies and that photos are taken in daylight, so the tote is not defective. The buyer is still inside the 30-day return window, though, and a SNAD claim usually ends in a refund with a return anyway. The cheapest fair outcome is to offer a refund with return now, at the inquiry stage. This follows the published policy, and the buyer pays return shipping because he is an international buyer.","win_likelihood":35,"confidence":"HIGH","reasoning":[{"point":"The listing states that tone varies from hide to hide and deepens with use, and that photos are taken in daylight. The Terms of Sale, accepted at checkout, say these variations are not defects.","refs":["listing:KA-TOT-TAN","policy:terms","order:KA-10497"]},{"point":"DHL Express delivered on 12 Oct to the transaction address, so delivery is not in question. Only the colour is disputed.","refs":["shipment:SHP-10497"]},{"point":"The returns policy gives a full refund for unused items returned w
… (4927 more characters)
```
</details>

<details><summary>Exhibit returned</summary>

```
{"dispute_id":"PP-D-50223","buyer":"Jordan Kim","amount":68,"currency":"USD","status":"WAITING_FOR_SELLER_RESPONSE","response_due":"2026-10-29T23:59:00Z","decision":"REFUND","headline":"USPS returned the wallet to us undelivered. Refund the $68; the wallet is back in stock","summary":"The wallet shipped on time to the address on the PayPal transaction. USPS marked it \"Undeliverable as addressed — no such number\" and returned it to Kora Atelier on Oct 6. The buyer emailed on Oct 8 and got no reply. We can't prove delivery, so Seller Protection fails and a fight would only add fees. Accept the claim and refund. Since the wallet is back with us, the only loss is shipping, and we can offer to reship once the buyer confirms a correct address.","win_likelihood":5,"confidence":"HIGH","reasoning":[{"point":"USPS tracking shows an exception on Sep 28 ('Undeliverable as addressed — no such number') and a return to sender in Brooklyn on Oct 6. There is no delivery to prove.","refs":["shipment:SHP-10511"]},{"point":"The Seller Protection check is NOT_ELIGIBLE: the carrier never showed 'delivered' with a date. The playbook says to refund, not fight, when a parcel is returned to sender.","refs":["paypal:seller-protection:PP-D-50223"]},{"point":"We shipped to the address on the transaction (77 Ridgewood Ct, Portland 97205), so the bad address likely came from the buyer. That still doesn't g
… (2769 more characters)
```
</details>

<details><summary>Exhibit returned</summary>

```
{"dispute_id":"PP-D-50231","buyer":"Priya Patel","amount":180,"currency":"USD","status":"WAITING_FOR_SELLER_RESPONSE","response_due":"2026-10-29T23:59:00Z","decision":"REFUND","headline":"Return arrived Oct 16 and no refund issued yet — accept and refund $180","summary":"Priya Patel, a repeat customer with 5 orders and no prior disputes, returned the clutch on our prepaid UPS label. UPS shows it was delivered to the studio on 2026-10-16, signed for by K. NAIR. The order shows no refund, so we have nothing to send in answer to PayPal's PROOF_OF_REFUND request. Our own policy promises a refund within 3 business days of arrival, so the buyer is owed $180. Accepting now refunds her once, avoids a lost chargeback and keeps a good customer.","win_likelihood":3,"confidence":"HIGH","reasoning":[{"point":"The buyer started the return on 2026-10-10, within 30 days of the 2026-09-19 delivery, and we sent her a prepaid label saying we refund within 3 business days of arrival.","refs":["msg:MSG-10466-1","msg:MSG-10466-2","shipment:SHP-10466"]},{"point":"UPS return tracking shows the parcel delivered to our Brooklyn studio on 2026-10-16, received by K. NAIR.","refs":["shipment:RTN-10466"]},{"point":"The order record has no refunds. PayPal is asking only for PROOF_OF_REFUND, and we cannot provide it.","refs":["order:KA-10466","paypal:dispute:PP-D-50231"]},{"point":"Our returns policy, accepte
… (2520 more characters)
```
</details>

<details><summary>Exhibit returned</summary>

```
{"dispute_id":"PP-D-50236","buyer":"Lena Vogel","amount":236,"currency":"USD","status":"WAITING_FOR_SELLER_RESPONSE","response_due":"2026-10-30T23:59:00Z","decision":"MESSAGE_BUYER","headline":"Waiting in Packstation 128 for pickup. Tell the buyer in German before the 7-day hold runs out","summary":"DHL delivered the satchel on 2026-10-18 into Packstation 128, Berlin, which is the exact address on the PayPal transaction. The pickup code went out by email/app and the hold is 7 days (about 2026-10-25). The buyer likely hasn't picked it up yet. The case is still at the inquiry stage, so a friendly German message with the tracking number and pickup steps should close it without a refund. Seller Protection checks all pass if it escalates.","win_likelihood":80,"confidence":"HIGH","reasoning":[{"point":"DHL shows the parcel delivered on 2026-10-18 16:52 into Packstation 128 (PostNummer 41827793, Berlin 10405), matching the transaction address exactly. Tracking is synced to PayPal.","refs":["shipment:SHP-10524","order:KA-10524"]},{"point":"The delivery scan says the pickup code was sent by email/app and the hold is 7 days. 'Delivered but not received' at a locker usually means the buyer hasn't collected it, and it may go back to sender after about 2026-10-25.","refs":["shipment:SHP-10524"]},{"point":"Every Seller Protection requirement passes: covered claim, shipped to the transaction 
… (4774 more characters)
```
</details>

**→ `request_dispute_action`** `{"dispute_id":"PP-D-50211","note":"Strongest open case: UPS delivered to the exact transaction address, signed by \"M. HALE\" with a front-door photo, and every Seller Protection check passes (88%, high confidence)."}`

<details><summary>Exhibit returned</summary>

```
{"approval_id":"apv_4e8074d6db","status":"pending","kind":"dispute_action","target":"PP-D-50211","action":"provide_evidence","title":"File evidence with PayPal","detail":"Exhibit files the response letter and a 3-exhibit PDF packet with PayPal, covering proof of fulfillment, proof of delivery signature. Win likelihood 88%.","amount":null,"currency":"USD","moves_money":false,"requested_by":"Claude Code","created_at":"2026-10-20T23:41:04.573Z","decided_at":null,"result":null,"approval_url":"http://localhost:3101/app/disputes/PP-D-50211?approval=apv_4e8074d6db","existing":false}
```
</details>

**Claude:** I've triaged all 8 open disputes ($1,805 total) and set up the strongest one for filing. Nothing has been filed yet. It goes to PayPal only once you approve it.

**Ready for your approval: PP-D-50211, Megan Hale, $284, item not received, 88% chance of winning (high confidence)**
- UPS delivered the bag on Oct 5 to the exact address on the PayPal transaction.
- The delivery was signed for by "M. HALE", and UPS took a photo at the front door.
- It meets every Seller Protection requirement.
- Approve here: http://localhost:3101/app/disputes/PP-D-50211?approval=apv_4e8074d6db
- If you can, download the UPS proof-of-delivery letter with the signature image and add it to the packet before approving. It's the one piece of evidence the case is missing.

**All open cases**

| Case | Amount | Due | Exhibit's call | Chance of winning | Why |
|---|---|---|---|---|---|
| PP-D-50219 Reyes | $420 | **today** | Fight | 88% | Evidence was already filed on Oct 20, and PayPal is reviewing it. Nothing more to do. |
| PP-D-50227 Brooks | $96 | **Oct 22** | Fight | 78% | Not a duplicate charge: the second belt was a gift he ordered for his brother in Denver, and it was delivered. Some records don't match, though (below). |
| PP-D-50211 Hale | $284 | Oct 28 | Fight | 88% | Waiting for your approval (above). |
| PP-D-50236 Vogel | $236 | Oct 30 | Message the buyer | 80% | The bag is waiting in a DHL pickup locker in Berlin. Message her in German before the 7-day hold ends around Oct 25. |
| PP-D-50240 Ortiz | $355 | Oct 28 | Offer a replacement | 20% | The strap ring cracked in shipping, and our own returns policy covers damage. |
| PP-D-50214 Grant | $166 | Oct 29 | Offer a refund on return | 35% | Colour complaint about a tote that matches the listing, but he's still within the 30-day return window. |
| PP-D-50223 Kim | $68 | Oct 29 | Refund | 5% | USPS couldn't deliver the wallet and returned it to you. There's no proof of delivery. |
| PP-D-50231 Patel | $180 | Oct 29 | Refund | 3% | Her return arrived Oct 16 and the refund was never issued. Don't also refund her manually, or she'll be paid twice. |

**Urgent: PP-D-50227 (Brooks) is due tomorrow, Oct 22 at 23:59 UTC.** It's worth fighting, but before filing, check two things:
- **The other order number:** his customer record says KA-10518 and the order list says KA-9619.
- **The timestamps:** his gift-note email is dated Oct 2, but this order shows as placed on Oct 3.

Do you want me to set up the approval for Brooks, and approvals for the other cases?

---

_Finished in 57s · 11 turns · 10 Exhibit tool calls · $0.27._

## After the run

Pending in Exhibit, waiting for the merchant (nothing has been sent to PayPal):

- `apv_4e8074d6db` · File evidence with PayPal · PP-D-50211 · requested by Claude Code

The merchant sees the request as a banner on the case page and in Settings → Connect an AI agent, and approves or rejects it there.
