# Live PayPal sandbox run

Every call below went from Exhibit, in sandbox mode, to `api-m.sandbox.paypal.com`. The tables are taken from Exhibit's own call log, exported read-only to [`proof.json`](../src/components/landing/records/proof.json) by [`export.mjs`](../src/components/landing/records/export.mjs). The same records render on the proof page (`/proof` when the app runs). Dispute ids and PayPal debug ids are as PayPal returned them. No credentials, request bodies or buyer emails are stored. The buyers and store records behind these cases belong to Kora Atelier, a demo merchant.

| API calls logged | Returned 2xx | Returned an error | Endpoints | Sandbox chargebacks | Agent runs |
| --- | --- | --- | --- | --- | --- |
| 244 | 240 | 4 | 12 | 4 | 13 |

Calls from Oct 20, 13:05 UTC to Nov 3, 02:39 UTC. 8 log rows that replayed a cached dispute read within seconds, with the same debug id and about 0 ms, are left out: they were not separate calls to PayPal.

## The four chargebacks

Opened on sandbox captures with PayPal's sandbox-only `process-chargeback` endpoint, then investigated by Exhibit's agent and answered through the Disputes API. "Exhibit's call" is the latest finished brief on the case.

| Dispute | Buyer (demo) | Claim | Capture | Exhibit's call | Filed through the API | PayPal status |
| --- | --- | --- | --- | --- | --- | --- |
| PP-R-EGO-10193744 | Daniel Reyes | Unauthorized, $420 | `2GW87112CH2430330` | Fight, 88% (7 runs) | `provide-evidence` 200, `f199340a434c8`<br>`provide-supporting-info` 200, `ca4d904350e86`<br>`provide-supporting-info` 200, `f6032251fbc7b`<br>`provide-supporting-info` 200, `f4652162f684d` | `UNDER_REVIEW`<br>checked Nov 3, 2026 |
| PP-R-KHB-10193747 | Jordan Kim | Item not received, $68 | `57002361HH0398920` | Refund, 3% (1 run) | `accept-claim` 200, `f229477d6e080` | `UNDER_REVIEW`<br>checked Oct 21, 2026 |
| PP-R-QJO-10193739 | Megan Hale | Item not received, $284 | `6KA23344L64978705` | Fight, 80% (4 runs) | `provide-supporting-info` 200, `f559160835614`<br>`adjudicate` 200, `f390262856e3a` | `RESOLVED`<br>`RESOLVED_WITH_PAYOUT` / `REPRESENTED_BY_PAYPAL` |
| PP-R-XTI-10193748 | Priya Patel | Credit not processed, $180 | `1P876401S2873814W` | Refund, 5% (1 run) | `accept-claim` 200, `f308851883563` | `UNDER_REVIEW`<br>checked Oct 29, 2026 |

PayPal's definitions for the resolved case's outcome codes (Disputes API reference): `RESOLVED_WITH_PAYOUT`, "PayPal provided the merchant or customer with protection and the case is resolved." `REPRESENTED_BY_PAYPAL`, "Paypal covered the cost of the case as decided by policy." It followed a sandbox-only `adjudicate` call, so it says nothing about how a real PayPal reviewer would rule.

## Every call that changed something

Filings, refunds and the sandbox setup behind them, oldest first. The two failed filings are why Exhibit now sends one evidence per call.

| Time (UTC) | What it did | Call | HTTP | Latency | PayPal-Debug-Id |
| --- | --- | --- | --- | --- | --- |
| Oct 20, 13:08 | Failed: filed evidence (letter, tracking, PDF packet), PP-R-QJO-10193739 | `POST …/disputes/{id}/provide-evidence` | 400 | 1,814 ms | `f193818fe828e` |
| Oct 20, 13:08 | Failed: filed evidence (letter, tracking, PDF packet), PP-R-QJO-10193739 | `POST …/disputes/{id}/provide-evidence` | 500 | 7,233 ms | `f637784337202` |
| Oct 20, 13:17 | Captured a buyer's payment | `POST /v2/checkout/orders/{id}/capture` | 201 | 2,005 ms | `f218581b7560f` |
| Oct 20, 13:17 | Opened a chargeback (sandbox-only call) | `POST /v2/customer-support/process-chargeback` | 201 | 1,658 ms | `f620451fd9632` |
| Oct 20, 13:34 | Filed evidence (letter, tracking, PDF packet), PP-R-EGO-10193744 | `POST …/disputes/{id}/provide-evidence` | 200 | 2,401 ms | `f199340a434c8` |
| Oct 20, 13:34 | Filed supporting info (letter, PDF packet), PP-R-QJO-10193739 | `POST …/disputes/{id}/provide-supporting-info` | 200 | 2,322 ms | `f559160835614` |
| Oct 20, 13:34 | Asked the sandbox to rule (sandbox-only call), PP-R-QJO-10193739 | `POST …/disputes/{id}/adjudicate` | 200 | 2,138 ms | `f390262856e3a` |
| Oct 20, 13:48 | Captured a buyer's payment | `POST /v2/checkout/orders/{id}/capture` | 201 | 1,961 ms | `f100286dda617` |
| Oct 20, 13:48 | Opened a chargeback (sandbox-only call) | `POST /v2/customer-support/process-chargeback` | 201 | 1,802 ms | `f7592393411b9` |
| Oct 20, 13:48 | Captured a buyer's payment | `POST /v2/checkout/orders/{id}/capture` | 201 | 1,935 ms | `f8541267be500` |
| Oct 20, 13:48 | Opened a chargeback (sandbox-only call) | `POST /v2/customer-support/process-chargeback` | 201 | 1,530 ms | `f192934bd638f` |
| Oct 20, 13:54 | Accepted the claim: refund to the buyer, PP-R-KHB-10193747 | `POST …/disputes/{id}/accept-claim` | 200 | 1,809 ms | `f229477d6e080` |
| Oct 20, 13:54 | Accepted the claim: refund to the buyer, PP-R-XTI-10193748 | `POST …/disputes/{id}/accept-claim` | 200 | 1,714 ms | `f308851883563` |
| Oct 20, 15:22 | Filed supporting info (letter, PDF packet), PP-R-EGO-10193744 | `POST …/disputes/{id}/provide-supporting-info` | 200 | 2,078 ms | `ca4d904350e86` |
| Oct 20, 15:57 | Filed supporting info (letter, PDF packet), PP-R-EGO-10193744 | `POST …/disputes/{id}/provide-supporting-info` | 200 | 2,425 ms | `f6032251fbc7b` |
| Nov 3, 02:39 | Filed supporting info (letter, PDF packet), PP-R-EGO-10193744, approved by the merchant after an AI agent asked through MCP | `POST …/disputes/{id}/provide-supporting-info` | 200 | 2,614 ms | `f4652162f684d` |

## Endpoints exercised live

12 PayPal endpoints across OAuth, Orders v2, Payments v2 and Disputes v1. Latency is the median of logged calls.

| Endpoint | Calls | 2xx | Errors | Median latency |
| --- | --- | --- | --- | --- |
| `GET /v1/customer/disputes/{id}` | 153 | 153 | 0 | 1,229 ms |
| `GET /v1/customer/disputes` | 28 | 28 | 0 | 1,070 ms |
| `GET /v2/checkout/orders/{id}` | 14 | 14 | 0 | 1,030 ms |
| `POST /v2/checkout/orders` | 13 | 11 | 2× 422 | 1,020 ms |
| `GET /v2/payments/captures/{id}` | 11 | 11 | 0 | 1,009 ms |
| `POST /v1/oauth2/token` | 9 | 9 | 0 | 1,131 ms |
| `POST /v1/customer/disputes/{id}/provide-supporting-info` | 4 | 4 | 0 | 2,374 ms |
| `POST /v1/customer/disputes/{id}/provide-evidence` | 3 | 1 | 1× 400, 1× 500 | 2,401 ms |
| `POST /v2/checkout/orders/{id}/capture` | 3 | 3 | 0 | 1,961 ms |
| `POST /v2/customer-support/process-chargeback` | 3 | 3 | 0 | 1,658 ms |
| `POST /v1/customer/disputes/{id}/accept-claim` | 2 | 2 | 0 | 1,762 ms |
| `POST /v1/customer/disputes/{id}/adjudicate` | 1 | 1 | 0 | 2,138 ms |

## Agent runs

13 runs, all Claude Opus 5.5 on the Claude CLI. 9 filed a brief, 3 ended without one and filed nothing, and 1 never finished. Every brief is validated before it is saved: citations must resolve and the action must be one PayPal allows.

| Started (UTC) | Dispute | Result | Duration |
| --- | --- | --- | --- |
| Oct 20, 13:07 | PP-R-QJO-10193739 | Fight, 80%, 4 exhibits | 32.4 s |
| Oct 20, 13:18 | PP-R-QJO-10193739 | No brief: the agent finished without filing a case brief | 56.5 s |
| Oct 20, 13:20 | PP-R-QJO-10193739 | No brief: the agent finished without filing a case brief | 56.1 s |
| Oct 20, 13:22 | PP-R-EGO-10193744 | Did not finish | |
| Oct 20, 13:33 | PP-R-EGO-10193744 | Fight, 90%, 6 exhibits | 34.0 s |
| Oct 20, 13:33 | PP-R-QJO-10193739 | Fight, 80%, 5 exhibits | 32.3 s |
| Oct 20, 13:34 | PP-R-EGO-10193744 | Fight, 88%, 6 exhibits | 43.2 s |
| Oct 20, 13:52 | PP-R-KHB-10193747 | Refund, 3%, 3 exhibits | 28.9 s |
| Oct 20, 13:52 | PP-R-XTI-10193748 | Refund, 5%, 4 exhibits | 83.4 s |
| Oct 20, 15:59 | PP-R-EGO-10193744 | No brief: the agent finished without filing a case brief | 3.2 s |
| Oct 20, 16:44 | PP-R-EGO-10193744 | Fight, 90%, 6 exhibits | 35.9 s |
| Oct 21, 00:35 | PP-R-EGO-10193744 | Fight, 88%, 6 exhibits | 35.6 s |
| Nov 3, 02:34 | PP-R-EGO-10193744 | Fight, 88%, 6 exhibits | 33.3 s |

## What the real API taught us

Each of these is now enforced by Exhibit's PayPal client and by the simulator the demo runs on.

- Chargebacks move from OPEN to UNDER_REVIEW, where only provide-supporting-info is open, then to WAITING_FOR_SELLER_RESPONSE about five minutes later.
- PayPal accepts only the evidence types it requested, and several evidences in one call need an item_id. A multi-evidence payload with a tracking URL returned a sandbox 500, so Exhibit now sends one evidence per call, with tracking and the PDF packet.
- This sandbox business account is not enabled for direct card processing (PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING, the two 422s on order create), so seeding uses PayPal checkout with buyer approval.
- On the credit-not-processed chargeback the agent chose accept-claim over refunding the capture: the issuer had already pulled the funds back, so a second refund would have paid the buyer twice.

## Not tested live yet

Honest gaps. Each one is implemented and runs against the simulator, which follows PayPal's documented request and response shapes.

- **Webhooks.** PayPal only delivers to a public HTTPS URL, and only the website is deployed so far, not the app. Signature checks use PayPal's verify-webhook-signature API and run in the simulator.
- **make-offer and send-message.** PayPal allows them only at the inquiry stage. Sandbox chargebacks from process-chargeback skip that stage, and opening a buyer-side inquiry needs PayPal partner consent.
- **Tracking push and capture refunds.** POST /v2/checkout/orders/{id}/track and POST /v2/payments/captures/{id}/refund are implemented and run against the simulator, but have not been called on the live sandbox.
- **A PayPal decision on the merits.** The one resolved case closed after a sandbox-only adjudicate call. Sandbox outcomes don't show how a real PayPal reviewer would rule.

## Tips for your own sandbox

- Seed through **Settings → Seed the sandbox** (see the [README](../README.md#use-your-own-paypal-sandbox)). If your sandbox business account can't take direct card payments, each order waits for a buyer to pay in PayPal checkout.
- In checkout, choose to pay by debit or credit card and create a PayPal account on the way. Guest-only payments were declined in our tests. The sandbox SMS code is `111111`. Sign out between buyers so each case gets its own buyer.
- Published test cards are shared across sandbox accounts and can be refused as "already added to another account". A Luhn-valid `4032…` number worked.
