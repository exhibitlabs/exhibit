---
title: Evidence packets
description: How the response letter and the lettered exhibits are rendered from records, and why the model cannot invent evidence.
section: How it works
order: 2
---

Every brief comes with an evidence packet: a PDF for PayPal's reviewer, with a cover page that holds the response letter and one page per exhibit. Exhibit attaches it to every filing that takes files. The model chooses the exhibits and explains them, but the facts on each exhibit page are read from the record itself when the PDF is rendered.

## What is in a packet {#contents}

The packet is rendered on the server with `@react-pdf/renderer`, in US Letter size, by `src/lib/packet/`. The file is named `exhibit-{dispute id}-evidence-packet.pdf`.

The cover page holds:

- The merchant's name, address, email and website, the dispute id and the date.
- The brief's headline.
- The case facts from PayPal and the order: reason, stage and PayPal's external reason code if there is one, amount, response deadline, transaction id, order id, buyer and the date the dispute opened.
- **Merchant's response**: the response letter.
- **Exhibits**: an index of every exhibit, with its letter, title and what it proves.

Then each exhibit gets its own page: the letter in a black tag, the title, what it proves, the line `Source record:` with the ref it cites, and the record itself. Every page carries a footer with the merchant's legal name and the dispute id ("Kora Atelier LLC · Response to PayPal dispute …" in the demo) and the words "Prepared with Exhibit".

## How each exhibit is rendered {#exhibit-pages}

The exhibit page depends on the kind of record behind the ref:

| Ref | The exhibit page shows |
|---|---|
| `shipment:` | Carrier and service, tracking number, shipped and delivered times, status, signature, delivery address, the tracking URL to verify online, the carrier's delivery photo note and the pre-dispatch quality-check note, and the full scan history. |
| `order:` | Order id and time, the PayPal capture id, how it was paid, the ship-to address from the transaction, the bill-to address, the shipping method, when the buyer accepted the store policies and which version, the line items and total, and any refunds. |
| `listing:` | Product name and description, material, dimensions and listed colour, what the product page disclosed, and the listing photos with their captions. |
| `customer:` | Customer since, order count and ids, lifetime value, prior disputes and any account note. |
| `msg:`, `conversation:` | The messages, word for word, with sender, channel, time and subject. |
| `risk:` | AVS, CVV and 3-D Secure results, the checkout IP and its location, the distance to the ship-to address, the device, email age and orders in the last 24 hours. |
| `policy:` | Title, version, when the buyer accepted it, the full policy text and its URL. |
| `paypal:seller-protection:` | The verdict and each requirement, passed or failed, with the detail and PayPal's own wording. |
| `paypal:dispute:` | Dispute id, reason, stage and amount. |
| `paypal:message:` | The buyer's message through PayPal, with its time. |

The demo store keeps photo descriptions rather than image files, so a packet prints the carrier's description of a delivery photo, and listing photos print as colour swatches with their captions.

## Why the model cannot invent evidence {#why-the-model-cannot-invent-evidence}

The model never writes a fact into an exhibit. Four rules, each enforced in code and each covered by tests, make sure of it:

1. **The tools only read.** The agent has no tool that writes a record. Whatever it learns, it learns from a tool result, and every result names its records with refs. See [How Exhibit decides](/docs/how-exhibit-decides#tools).
2. **An exhibit is a ref, not a description.** Each exhibit in the brief is a letter, a title, a line on what it proves, and exactly one ref.
3. **Refs must resolve on this case.** The brief check rejects any exhibit or reasoning point whose ref does not resolve to a record on this dispute. A real record from another case fails like an invented one. See [the brief check](/docs/how-exhibit-decides#brief-check).
4. **The packet re-reads every record from source.** When the PDF is rendered, each exhibit's ref is resolved again and its page is drawn from the record, not from anything the model wrote. A ref that no longer resolves leaves its page out.

So the split is:

| Written by the model | Read from records |
|---|---|
| The decision and the headline | The case facts on the cover page |
| The response letter | Every fact on every exhibit page |
| Each exhibit's letter, title and the line on what it proves | Tracking numbers, scans, signatures and addresses |
| Which ref each exhibit cites | Order lines, listing text, messages, policies and risk signals |

The letter is the one place where the model's own sentences reach PayPal. The agent is told to cite exhibits by letter, and every exhibit must resolve, but the wording is the agent's and no check reads it. That is why the merchant reads it, and can edit it, before anything is filed.

## The response letter {#letter}

The agent writes the letter as the merchant, for PayPal's reviewer. Its instructions set the form: plain text, under 1,900 characters, no greeting fluff, no placeholders and no em dashes. It opens with the merchant's position in one sentence, then gives the facts in order, citing exhibits by letter, for example "(Exhibit A)".

On the case page the merchant can edit the letter before filing. Exhibit cuts it at 1,990 characters before it goes out, because PayPal's limit for the notes field is 2,000. The packet's cover page always prints the letter that is actually filed.

## How the packet reaches PayPal {#filing}

| Action | What PayPal receives |
|---|---|
| `provide_evidence` | A multipart request: an `input` part with one evidence (the letter as its notes, plus the tracking number for proof of fulfillment or the refund id for proof of refund) and the packet as an `evidence-file` part. |
| `provide_supporting_info` | A multipart request: an `input` part with the letter as `notes`, and the packet as a `supporting-document` part. |
| `refund_then_prove` | A refund of the payment first, then `provide-evidence` with `PROOF_OF_REFUND`, the refund id and the packet. |
| `accept_claim`, `make_offer`, `send_message` | JSON requests without files. The letter, or the buyer message, goes in the note. |

Files follow PayPal's rules: PDF, PNG, JPEG or GIF, at most 10 MB per file and 50 MB per call. The simulator enforces the same limits in demo mode.

On the live sandbox, Daniel Reyes's $420 unauthorized chargeback, `PP-R-EGO-10193744`, was answered with a six-exhibit packet, Exhibits A to F. The first filing went through `provide-evidence` (HTTP 200, debug id `f199340a434c8`). Three more went through `provide-supporting-info` while PayPal reviewed the case, the last one approved by the merchant after an AI agent asked over MCP (HTTP 200, debug id `f4652162f684d`). The full record is on [the proof page](/proof).

## Get a packet {#get-a-packet}

- **In the app:** the **Evidence packet** tab on the case page shows the PDF.
- **Over HTTP:** `GET /api/disputes/{id}/packet` returns the PDF inline. Add `download=1` to download it, or `letter=` with your own text to preview an edited letter. Without a brief it answers 404 with "Run Exhibit on this dispute first."
- **Over MCP:** `get_evidence_packet` returns the packet's URL, a download URL, its size and the list of exhibits. See [MCP server](/docs/mcp#tools).

```bash
curl -o packet.pdf "http://localhost:3000/api/disputes/PP-D-50211/packet?download=1"
```

`PP-D-50211` is Megan Hale's dispute in the demo. Run Exhibit on it first.
