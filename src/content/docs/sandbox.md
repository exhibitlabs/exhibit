---
title: Sandbox guide
description: Connect your own PayPal sandbox app, open real chargebacks step by step, and know what the sandbox cannot test.
section: Get started
order: 3
---

With a PayPal sandbox app, Exhibit runs the same code as in demo mode against `api-m.sandbox.paypal.com`: real OAuth, real disputes, real filings and real PayPal debug ids. This guide connects your app, opens chargebacks you can investigate and answer, and lists what the sandbox cannot exercise.

## Before you start {#before-you-start}

- A PayPal developer account at [developer.paypal.com](https://developer.paypal.com/). It comes with a sandbox business account.
- Exhibit running locally. See [Quickstart](/docs/quickstart).
- A private browser window for paying as the buyer.

You do not need a store or carrier account. In sandbox mode, the orders, shipments, messages and checkout signals the agent reads come from Exhibit's built-in scenarios, written under the real PayPal ids when you seed.

## Connect your sandbox app {#connect}

:::steps
### Create a REST app

At developer.paypal.com, open **Apps & Credentials**, choose **Sandbox**, and create a REST app for your sandbox business account. Copy its client id and secret.

### Add the credentials

```bash
cp .env.example .env.local
```

```env title=".env.local"
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-client-secret
```

If the app does not run on port 3000, also set `EXHIBIT_APP_URL` to its address, for example `http://localhost:3100`. PayPal checkout returns the buyer there after they pay a seeded order.

### Restart and check the connection

Stop the dev server and run `npm run dev` again. With both credentials set, Exhibit is in sandbox mode: the app says it is on the live sandbox, and **Settings** shows your client id.

In **Settings**, press **Test connection**. It fetches an OAuth token and lists one dispute, the same check as `GET /api/status?check=1`.
:::

> [!NOTE]
> Sandbox mode keeps its own database, `.data/exhibit-sandbox.db`. The demo merchant's disputes and history are never mixed in, and the demo controls (reset, simulated disputes, demo agent requests) refuse to run in sandbox mode.

## Seed real disputes {#seed}

A sandbox dispute needs a real, captured payment. **Settings → Seed the sandbox** makes one per demo scenario, eight in all, and opens a chargeback on each.

:::steps
### Create sandbox orders

Press **Create sandbox orders**. Exhibit creates one Orders v2 order per scenario (`POST /v2/checkout/orders`), with the scenario's item, amount and shipping address.

It first tries to pay with a PayPal test card. If your business account can take card payments directly, the order is captured at once and its chargeback opens in the same step. If PayPal answers `PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING`, as it did for ours, every order is created for PayPal checkout instead and waits for a buyer.

### Pay each order as the buyer

Each waiting order shows **Open PayPal checkout as the buyer**. Open it in a private window and pay with a [sandbox test card](https://developer.paypal.com/tools/sandbox/card-testing/).

- Choose to pay by debit or credit card, and create a PayPal account on the way. Guest-only payments were declined in our tests.
- The sandbox SMS code is `111111`.
- Sign out between buyers, so each case gets its own buyer.
- The published test cards are shared by every sandbox account and can be refused as "already added to another account". A Luhn-valid number starting `4032` worked for us.

### Capture and open the chargebacks

Back in **Settings**, press **Capture approved and open chargebacks**. For every order the buyer approved, Exhibit:

1. Captures it (`POST /v2/checkout/orders/{id}/capture`).
2. Opens a chargeback on the capture with the sandbox-only `POST /v2/customer-support/process-chargeback`.
3. Writes the scenario's store records (order, shipment, customer, messages and risk signals) under the real PayPal order, capture and dispute ids, and the buyer's PayPal email.

Each row in the seed table then links to its dispute. Run the step again for orders you approve later.
:::

New chargebacks can take a moment to appear in PayPal's dispute list. Exhibit syncs after each seeding step, and **Sync PayPal** on the **Disputes** page picks up any that arrive later.

## Work the disputes {#work}

Open a seeded dispute and press **Run Exhibit**. The agent reads the live dispute from PayPal, so its choice of action follows what PayPal allows at that moment. On our sandbox, new chargebacks moved from `OPEN` to `UNDER_REVIEW`, then to `WAITING_FOR_SELLER_RESPONSE` about five minutes later:

| Status on PayPal | What Exhibit filed there |
|---|---|
| `UNDER_REVIEW` | `provide-supporting-info`: the letter and the PDF packet go to PayPal's review. |
| `WAITING_FOR_SELLER_RESPONSE` | `provide-evidence`, or `accept-claim` when the buyer is right. |

If a filing fails, the case page shows PayPal's HTTP status, issue code and debug id, and **PayPal activity** has the full request and response.

While a case is `UNDER_REVIEW`, the case page's **Sandbox controls** stand in for PayPal's reviewer: **Rule for the merchant** and **Rule for the buyer** call the sandbox-only `adjudicate` endpoint. A ruling there is the sandbox closing the case on request. It is not a decision on the merits.

## Webhooks {#webhooks}

PayPal only delivers webhooks to a public HTTPS URL. To try them, expose the app through a deployment or a tunnel, add a webhook in your sandbox app that points at `https://your-host/api/webhooks/paypal`, subscribe it to `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.UPDATED` and `CUSTOMER.DISPUTE.RESOLVED`, and set `PAYPAL_WEBHOOK_ID` to the webhook's id. **Settings → Webhooks** shows the listener address. How events are verified is in [PayPal integration](/docs/paypal-integration#webhooks).

> [!WARNING] Exposing the app
> Exhibit has no sign-in yet. Anyone who can reach a public URL can use the app with your sandbox credentials. Keep tunnels short-lived. See [Security model](/docs/security-model#limits).

## What is not testable live {#not-testable-live}

Each of these is implemented and runs against the simulator, which follows PayPal's documented request and response shapes. None has been called on the live sandbox.

| What | Why not live | Covered by |
|---|---|---|
| `make-offer` and `send-message` | PayPal allows them only at the inquiry stage. Chargebacks from `process-chargeback` skip that stage, and opening a buyer-side inquiry needs PayPal partner consent. | The simulator and the filing tests |
| Tracking push and capture refunds | `POST /v2/checkout/orders/{id}/track` and `POST /v2/payments/captures/{id}/refund` are implemented but have not been called on the live sandbox yet. | The simulator and the Prevention tests |
| Webhooks | PayPal only delivers to a public HTTPS URL, and only the website is deployed so far, not the app. | Signature checks through `verify-webhook-signature`, which the simulator implements |
| `require-evidence` | A sandbox-only call Exhibit has not needed on the live sandbox. | The simulator |
| A buyer accepting an offer | Needs buyer credentials. | A demo-only simulator control |
| A PayPal decision on the merits | The one resolved sandbox case closed after a sandbox-only `adjudicate` call. Sandbox outcomes do not show how a real PayPal reviewer would rule. | Nothing can stand in for it |
| Your own store data | There are no store or carrier connectors yet, so the agent reads the built-in scenario records, also in sandbox mode. | Nothing yet |

What has been tested live, call by call with debug ids, is on [the proof page](/proof).
