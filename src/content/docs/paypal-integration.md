---
title: PayPal integration
description: Every PayPal API Exhibit calls, OAuth, the dispute lifecycle and the action PayPal allows at each step, what the live sandbox taught us, and webhooks.
section: Integrations
order: 1
---

Every PayPal call goes through one client, `src/lib/paypal/client.ts`. In sandbox mode it calls `https://api-m.sandbox.paypal.com`. In demo mode the same client, with the same requests, talks to a simulator that runs in the app's process. Exhibit has no live PayPal mode yet: the sandbox is as far as it goes.

## Modes {#modes}

| Mode | When | Where calls go |
|---|---|---|
| Demo | `PAYPAL_CLIENT_ID` or `PAYPAL_CLIENT_SECRET` is missing, or `EXHIBIT_PAYPAL_MODE=demo` | The simulator in `src/lib/paypal/simulator.ts` |
| Sandbox | Both credentials are set | `api-m.sandbox.paypal.com` |

The simulator follows PayPal's Disputes v1, Orders v2 and Payments v2 shapes for the endpoints Exhibit uses: the same request and response bodies, PayPal's error format and issue codes, the file rules, and actions that only work in the dispute states where PayPal offers them. Each mode keeps its own SQLite file, so demo data never mixes with sandbox data. See [Configuration](/docs/configuration#paypal-mode).

## Every PayPal API Exhibit calls {#endpoints}

| Endpoint | What Exhibit uses it for | Live sandbox |
|---|---|---|
| `POST /v1/oauth2/token` | Client-credentials OAuth. | Yes |
| `GET /v1/customer/disputes` | Inbox sync: the first page of up to 50 disputes. | Yes |
| `GET /v1/customer/disputes/{id}` | Case facts, deadline, requested evidence and the actions PayPal allows right now. Read again before every filing. | Yes |
| `POST /v1/customer/disputes/{id}/provide-evidence` | Evidence, tracking and the PDF packet, as multipart. | Yes |
| `POST /v1/customer/disputes/{id}/provide-supporting-info` | The letter and the PDF packet while PayPal reviews a chargeback, as multipart. | Yes |
| `POST /v1/customer/disputes/{id}/accept-claim` | Refund the buyer when the records say they are right. | Yes |
| `POST /v1/customer/disputes/{id}/make-offer` | Refund, return or replacement offers at the inquiry stage. | Not yet |
| `POST /v1/customer/disputes/{id}/send-message` | Messages to the buyer at the inquiry stage. | Not yet |
| `GET /v2/payments/captures/{id}` | The payment, with PayPal's own Seller Protection flag. | Yes |
| `POST /v2/payments/captures/{id}/refund` | Refund first, then file the refund as proof; refunds from Prevention. | Not yet |
| `POST /v2/checkout/orders/{id}/track` | Push missing tracking to PayPal before a claim (Prevention). | Not yet |
| `POST /v1/notifications/verify-webhook-signature` | Verify `CUSTOMER.DISPUTE.*` webhooks. | Not yet |
| `POST /v2/checkout/orders` | Seed real sandbox orders. | Yes |
| `GET /v2/checkout/orders/{id}` | Check whether the buyer approved a seeded order. | Yes |
| `POST /v2/checkout/orders/{id}/capture` | Capture a seeded order. | Yes |
| `POST /v2/customer-support/process-chargeback` | Open a chargeback on a captured sandbox payment. Sandbox only. | Yes |
| `POST /v1/customer/disputes/{id}/adjudicate` | Ask the sandbox to rule for the merchant or the buyer. Sandbox only. | Yes |
| `POST /v1/customer/disputes/{id}/require-evidence` | Move a sandbox case back to waiting for evidence. Sandbox only. | Not yet |

Twelve of these were called on the live sandbox between Oct 20 and Nov 3, 2026. The six marked "Not yet" are implemented and tested against the simulator; why they have not run live is in the [Sandbox guide](/docs/sandbox#not-testable-live).

## OAuth {#oauth}

Exhibit uses OAuth 2.0 client credentials. It posts `grant_type=client_credentials` to `/v1/oauth2/token` with HTTP Basic authentication built from the client id and secret, and sends the access token as `Authorization: Bearer` on every other call.

- The token is cached in memory, per mode and client id, until a minute before it expires.
- In demo mode the simulator issues a token too, so the token code path runs in both modes.
- The `Authorization` header, Basic or Bearer, is never stored. The logged token request shows only its content type and grant type.

Credentials come from `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in the environment and are never written to the database. See [Security model](/docs/security-model#credentials).

## The call log {#call-log}

The client logs every call: method, path, HTTP status, latency, mode, the PayPal debug id (from the `PayPal-Debug-Id` header or the error body) and the `PayPal-Request-Id` if one was sent. Request and response bodies are stored for the **PayPal activity** inspector after redaction:

- Fields named like tokens, secrets, passwords, authorization or card security codes are replaced with `[redacted]`.
- Card numbers keep only their last four digits.
- Very long strings and very large bodies are shortened, and a long dispute list keeps its first items.
- Multipart bodies are logged as their parts: the JSON input in full, after redaction, and files by name, type and size.
- Of the request headers, only `Content-Type`, `Accept`, `PayPal-Request-Id` and `Prefer` are shown.

The proof page's table of 244 sandbox calls is an export of this log, without credentials, request bodies or buyer emails.

## The dispute lifecycle {#lifecycle}

A PayPal dispute has a stage (`INQUIRY`, `CHARGEBACK`, `PRE_ARBITRATION` or `ARBITRATION`) and a status (`OPEN`, `WAITING_FOR_SELLER_RESPONSE`, `WAITING_FOR_BUYER_RESPONSE`, `UNDER_REVIEW`, `RESOLVED` or `OTHER`). What the merchant may do at any moment is in the dispute's own HATEOAS links: `GET /v1/customer/disputes/{id}` returns a `links` array, and each `rel` other than `self` names an action that is open now.

Exhibit never hard-codes the lifecycle. The agent reads `allowed_actions` from those links, and the brief check rejects any action whose link is missing. The simulator offers actions like this, and the simulator tests pin the table down:

| Status | Stage | Actions offered (`rel`) |
|---|---|---|
| `WAITING_FOR_SELLER_RESPONSE` | Inquiry | `provide_evidence`, `accept_claim`, `make_offer`, `send_message` |
| `WAITING_FOR_SELLER_RESPONSE` | Chargeback or later | `provide_evidence`, `accept_claim` |
| `UNDER_REVIEW` | Chargeback or later | `provide_supporting_info`, plus the sandbox-only `adjudicate` and `require_evidence` |
| `UNDER_REVIEW` | Inquiry | The sandbox-only `adjudicate` and `require_evidence` |
| `WAITING_FOR_BUYER_RESPONSE` | Inquiry | `send_message` |
| `WAITING_FOR_BUYER_RESPONSE` | Chargeback or later | None |
| `OPEN`, `RESOLVED` | Any | None |

And moves the dispute on like this:

| Action | The dispute afterwards |
|---|---|
| `provide-evidence` | `UNDER_REVIEW`, with the evidence marked as submitted by the seller |
| `provide-supporting-info` | Same status, with the supporting info added |
| `accept-claim` | `RESOLVED` in the buyer's favour, with the refund amount |
| `make-offer` | `WAITING_FOR_BUYER_RESPONSE`, with the offer and its note |
| `send-message` | Same status, with the message added |
| `adjudicate` | `RESOLVED` for the side chosen |
| `require-evidence` | `WAITING_FOR_SELLER_RESPONSE` |

On the live sandbox, new chargebacks went from `OPEN` to `UNDER_REVIEW`, where only `provide_supporting_info` was open, and to `WAITING_FOR_SELLER_RESPONSE` about five minutes later. Exhibit files whichever response PayPal allows at that moment.

## How Exhibit files {#filing}

`src/lib/actions.ts` turns a brief's `paypal_action` into PayPal calls. Before any of them it re-reads the dispute, and every result, success or failure, is recorded with the actor: the merchant, Autopilot, or an approved agent request.

For `provide_evidence`, PayPal gets exactly one evidence per call:

- Only evidence types PayPal requested are kept. If none of the brief's types was requested, Exhibit files `OTHER` when PayPal asked for it, or else the first type PayPal asked for.
- Of what is left, `PROOF_OF_FULFILLMENT` wins, then `PROOF_OF_REFUND`, then the first type.
- The evidence's notes hold the response letter, cut at 1,990 characters.
- Proof of fulfillment carries the carrier and tracking number, copied from the shipment record the brief points at. Proof of refund carries the refund ids.
- The PDF packet rides along as an `evidence-file` part. Anything PayPal did not request, such as a signature, reaches the reviewer inside the packet.

The `input` part of a proof-of-fulfillment filing looks like this:

```json
{
  "evidences": [
    {
      "evidence_type": "PROOF_OF_FULFILLMENT",
      "notes": "The response letter, up to 1,990 characters.",
      "evidence_info": {
        "tracking_info": [{ "carrier_name": "UPS", "tracking_number": "1Z84V6A90392847516" }]
      }
    }
  ]
}
```

The other actions:

- `provide_supporting_info` sends the letter as `notes` and the packet as a `supporting-document` part.
- `accept_claim` sends the letter as the note, with `accept_claim_type` set to `REFUND`.
- `make_offer` sends the buyer message (or the letter) as the note, the offer type, the amount unless it is a replacement without refund, and the merchant's return address for a refund with return.
- `send_message` sends the buyer message.
- `refund_then_prove` refunds the capture first, then files `PROOF_OF_REFUND` with the new refund id.

Orders and refunds send a `PayPal-Request-Id` header. A failed call comes back as an error with PayPal's HTTP status, issue code and debug id, and the case page shows it.

## Lessons from the live sandbox {#lessons}

Each of these is now enforced by Exhibit's client and copied into the simulator.

- **Chargebacks start under review.** They moved from `OPEN` to `UNDER_REVIEW`, where only `provide-supporting-info` was open, then to `WAITING_FOR_SELLER_RESPONSE` about five minutes later. So the agent reads the allowed actions every time and uses supporting info while PayPal reviews.
- **One evidence per call.** PayPal accepts only the evidence types it requested, and several evidences in one call each need an `item_id`. On Oct 20 two multi-evidence filings on `PP-R-QJO-10193739` failed: HTTP 400 (debug id `f193818fe828e`), then HTTP 500 with a tracking URL in the payload (debug id `f637784337202`). Exhibit now sends one evidence per call, with tracking, and puts everything else in the packet.
- **Not every sandbox account takes cards.** The business account was not enabled for direct card processing: two order creates failed with HTTP 422 and `PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING`. Seeding now falls back to PayPal checkout with buyer approval.
- **Do not refund twice.** On the credit-not-processed chargeback the agent chose `accept-claim` over refunding the capture: the card issuer had already pulled the funds back, so a second refund would have paid the buyer twice.

The full run, call by call, is in `docs/SANDBOX_E2E.md` and on [the proof page](/proof).

## Webhooks {#webhooks}

The listener is `POST /api/webhooks/paypal`. In your sandbox app's webhook settings, point a webhook at `https://your-host/api/webhooks/paypal` and subscribe it to `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.UPDATED` and `CUSTOMER.DISPUTE.RESOLVED`. Then set `PAYPAL_WEBHOOK_ID` to that webhook's id.

In sandbox mode, every event is verified with PayPal before anything runs. Exhibit sends PayPal's transmission headers, your webhook id and the event itself:

```http
POST /v1/notifications/verify-webhook-signature
Content-Type: application/json

{
  "auth_algo": "value of the PAYPAL-AUTH-ALGO header",
  "cert_url": "value of the PAYPAL-CERT-URL header",
  "transmission_id": "value of the PAYPAL-TRANSMISSION-ID header",
  "transmission_sig": "value of the PAYPAL-TRANSMISSION-SIG header",
  "transmission_time": "value of the PAYPAL-TRANSMISSION-TIME header",
  "webhook_id": "PAYPAL_WEBHOOK_ID",
  "webhook_event": { "event_type": "CUSTOMER.DISPUTE.CREATED", "resource": { "dispute_id": "…" } }
}
```

`webhook_event` is the whole event body as Exhibit received it, shortened here.

| Case | Response |
|---|---|
| The body is not a webhook event | 400, `Send a PayPal webhook event.` |
| `PAYPAL_WEBHOOK_ID` is not set | 500, `PAYPAL_WEBHOOK_ID is not set` |
| PayPal does not answer `SUCCESS` | 400, `signature verification failed`, and the rejection is logged |
| Verified | 200, `{ "received": true }` |

A verified `CUSTOMER.DISPUTE.*` event refreshes the dispute from PayPal. `CUSTOMER.DISPUTE.CREATED` also starts an investigation, and the webhook is answered without waiting for it.

In demo mode there is no PayPal to sign events, so the listener skips verification. The simulator implements the verify endpoint (it always answers `SUCCESS`) so the client call is tested. PayPal only delivers webhooks to a public HTTPS URL, and Exhibit is not deployed yet, so no real PayPal webhook has reached it.

> [!WARNING] No sign-in yet
> Exhibit has no authentication. If you expose it to receive webhooks, through a deployment or a tunnel, anyone who can reach it can use the app with your sandbox credentials. See [Security model](/docs/security-model#limits).
