---
title: API routes
description: Every HTTP route the app serves, with method, path and purpose, plus the request bodies and streams worth knowing.
section: Reference
order: 2
---

The app's screens, the [MCP server](/docs/mcp) and PayPal's webhooks all talk to Exhibit through these routes. They live in `src/app/api/`, sit under `/api`, and return JSON unless noted. They serve the app itself: there is no version prefix and no stability promise.

> [!WARNING] No authentication
> The routes have no sign-in. Anyone who can reach the server can call them, including the routes that file, refund and message. Only the approval decision checks for a same-origin browser request. Keep Exhibit on your own machine or behind your own authentication. See [Security model](/docs/security-model#limits).

## Disputes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/disputes` | The inbox: one row per dispute with Exhibit's decision, win likelihood and deadline, plus summary stats. |
| `POST` | `/api/disputes/sync` | Lists disputes from PayPal again and returns the refreshed inbox. |
| `POST` | `/api/disputes/{id}/run` | Runs the agent on one dispute and streams the run as server-sent events. See [Streams](/docs/api#streams). |
| `GET` | `/api/disputes/{id}/state` | The case: the dispute as last read, the latest run with its brief and events, whether a run is in progress, actions taken, the case's last 60 PayPal calls and its history. |
| `GET` | `/api/disputes/{id}/packet` | The evidence packet PDF, shown inline. `?download=1` downloads it; `?letter=` renders it with an edited letter. 404 until the dispute has a brief. |
| `POST` | `/api/disputes/{id}/act` | Carries out the brief's PayPal action as the merchant. See [the request body](/docs/api#act). |
| `POST` | `/api/disputes/{id}/sandbox` | Test controls that stand in for PayPal's reviewer and the buyer. |
| `POST` | `/api/batch` | Investigates in the background, two at a time, and returns the `queued` dispute ids. See [the request body](/docs/api#batch-body). |

## Approvals

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/approvals` | Requests from AI agents, pending first, each with the `reviewPath` where the merchant reviews it. Filter with `?status=pending` or `?target=PP-D-50211`. |
| `POST` | `/api/approvals` | Creates a request and executes nothing. 201 when new, 200 when the same request already exists. |
| `GET` | `/api/approvals/{id}` | One request. Agents poll it for the merchant's decision. |
| `POST` | `/api/approvals/{id}` | The merchant's decision, from a same-origin browser request only. Anything else gets a 403. |

## Prevention

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/prevention` | The prevention report: orders at risk with scores, signals, fixes and totals. `?orderId=KA-10561` returns one order and the buyer message Exhibit would send. |
| `POST` | `/api/prevention` | Runs a fix on an order. Returns the result and the updated report: 200 if it worked, 422 if not. |
| `POST` | `/api/protection` | Pushes tracking that PayPal does not have yet to Orders v2, for every outbound shipment or only the listed `shipmentIds`. |

## Ask Exhibit

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/ask` | The palette's index: cases and at-risk orders for quick navigation, suggested questions and the provider label. |
| `POST` | `/api/ask` | Streams one answer as server-sent events. The body holds the `question` and an optional `history`. Answers are not stored. |

## Settings, status and activity

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/status` | PayPal mode, AI provider and model. `?check=1` also tests the PayPal connection. |
| `GET` | `/api/autopilot` | The Autopilot rules. |
| `PUT` | `/api/autopilot` | Saves the rules, clamped to the hard limits, and returns what was stored. |
| `GET` | `/api/overview` | Data for the **Overview** page: recovered, at risk, win rate by reason, the deadline queue, dispute-rate health and recent activity. |
| `GET` | `/api/activity` | The audit timeline: PayPal calls, agent and merchant actions and webhooks, without bodies. |
| `GET` | `/api/activity/{id}` | One PayPal call with its redacted request and response bodies. |
| `GET` | `/api/nav` | Sidebar badges (cases that need a response, orders at risk, agent requests) and notifications. |

## Webhooks

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/webhooks/paypal` | PayPal's webhook listener for `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.UPDATED` and `CUSTOMER.DISPUTE.RESOLVED`. |

In sandbox mode, the listener verifies each event's signature with PayPal before anything runs, and needs `PAYPAL_WEBHOOK_ID`. Every `CUSTOMER.DISPUTE.*` event refreshes its dispute. `CUSTOMER.DISPUTE.CREATED` also starts an investigation, and the event is acknowledged without waiting for it. A body that is not a PayPal event gets a 400.

## Demo and sandbox setup

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/demo` | The demo's clock (when it was seeded, the last activity, the next reset) and the demo guide's progress. |
| `POST` | `/api/demo` | Demo-mode controls, chosen by `op`. Answers 400 in sandbox mode, where data is never reset. |
| `GET` | `/api/sandbox/seed` | The sandbox seed orders and their status. |
| `POST` | `/api/sandbox/seed` | Opens real sandbox chargebacks in steps, chosen by `op`. Needs sandbox mode. |

| Route | `op` | What it does |
|---|---|---|
| `POST /api/demo` | `reset` | Re-seeds the demo merchant with fresh dates and prepares briefs from recorded runs. |
| `POST /api/demo` | `incoming` | A new dispute arrives as a `CUSTOMER.DISPUTE.CREATED` webhook would deliver it, and Exhibit investigates it. |
| `POST /api/demo` | `agent_request` | Queues an approval request the way an outside agent would. Nothing executes. |
| `POST /api/demo` | `touch` | Marks the demo as in use, so it does not reset under you. |
| `POST /api/sandbox/seed` | `start` | Creates one PayPal order per scenario, captured at once where the account allows it, otherwise left for the buyer to approve in checkout. |
| `POST /api/sandbox/seed` | `finalize` | Captures approved orders and opens a chargeback on each. |
| `POST /api/sandbox/seed` | `adopt` | Registers an order created elsewhere, given its scenario `key` and its `order_id`. |
| `POST /api/disputes/{id}/sandbox` | `decide` | Asks PayPal's sandbox to rule, with `outcome` `SELLER_FAVOR` (the default) or `BUYER_FAVOR`. |
| `POST /api/disputes/{id}/sandbox` | `require_evidence` | Moves a case under review back to waiting for the seller's evidence. |
| `POST /api/disputes/{id}/sandbox` | `buyer_accepts_offer` | The buyer accepts an open offer. Demo mode only. |

The [Sandbox guide](/docs/sandbox) walks through seeding from **Settings**.

## Streams {#streams}

`POST /api/disputes/{id}/run` and `POST /api/ask` answer with `text/event-stream`. Each event is one `data:` line of JSON followed by a blank line, and a `: ping` comment arrives every 15 seconds to keep the connection open.

```bash
curl -N -X POST http://localhost:3000/api/disputes/PP-D-50211/run
```

```text
data: {"t":"start","run_id":"run_…","provider":"replay","model":"recorded run",…}

data: {"t":"tool_call","id":"…","name":"get_paypal_dispute","kind":"paypal",…}
```

This starts a real investigation, and in sandbox mode it reads from PayPal. A dispute PayPal does not know gets a 404 before anything starts. If a run on the same dispute is already in progress, you get one `error` event: "Exhibit is already working on this dispute." Closing the stream does not stop the run: it continues on the server and saves its events.

Add `?trigger=agent` for runs that an AI agent starts. Autopilot never acts on those; the MCP server always sets it.

| Run event `t` | What it carries |
|---|---|
| `start` | `run_id`, `provider`, `model`, `dispute_id` and `trigger` |
| `thinking`, `text` | The model's streamed text |
| `tool_call` | The tool, the source it queries and its input |
| `tool_result` | Success or failure, a summary, the output and the time taken |
| `brief` | The validated case brief |
| `done` | Total time and token usage |
| `autopilot` | Autopilot's verdict, `AUTO` or `REVIEW`, with the rule and the reason |
| `action` | The result of an action Autopilot ran |
| `error` | What went wrong |

Ask Exhibit's stream sends `start`, `step` and `step_done` for each tool, `text` as the answer is written, then `answer` with the structured answer, and `done`. It can also send `notice` (for example, when it falls back to an offline answer), `text_reset` and `error`. The question must be 1 to 500 characters. `history` holds up to six earlier turns, each with a question `q` and an answer `a`.

## Request bodies

### Create an approval request {#approvals-body}

```json title="POST /api/approvals"
{
  "kind": "dispute_action",
  "disputeId": "PP-D-50211",
  "note": "Signed delivery at the transaction address.",
  "client": "Claude Code"
}
```

For a prevention fix, send `"kind": "prevention_fix"` with `orderId` and an optional `action`. The response holds the `approval`, `existing` (true when the same request was already pending) and the `reviewPath` where the merchant decides. Errors: 400 for any other `kind`, 404 for an unknown dispute or order, 409 for a resolved dispute, one with no brief yet or an order no longer at risk, and 422 for a fix that does not apply to the order.

### Decide an approval {#decision-body}

```json title="POST /api/approvals/{id}"
{ "decision": "reject", "reason": "Not this one" }
```

`decision` is `approve` or `reject`. Errors: 403 when the request is not same-origin, 404 for an unknown id, 409 when the request was already decided or its brief has changed (nothing is filed), and 422 when the approved action failed.

### File as the merchant {#act}

```json title="POST /api/disputes/{id}/act"
{
  "letter": "…",
  "buyerMessage": "…",
  "amount": 60
}
```

Every field is optional and overrides the brief: `letter` replaces the response letter, `buyerMessage` the message to the buyer and `amount` the offer or refund amount. On success the answer has `ok: true`, the action's `kind`, a one-line `detail` and PayPal's `response`. When PayPal refuses, it is HTTP 422 with `ok: false`, the `error`, and PayPal's `issue`, `debugId` and `status`.

### Run a prevention fix {#prevention-body}

```json title="POST /api/prevention"
{
  "orderId": "KA-10561",
  "action": "message_buyer",
  "message": { "subject": "…", "body": "…" }
}
```

`action` is one of `push_tracking`, `refund`, `message_buyer`, `hold_and_verify`, `require_signature` or `dismiss`. `message` is optional and replaces the drafted buyer message.

### Investigate in bulk {#batch-body}

```json title="POST /api/batch"
{ "ids": ["PP-D-50211", "PP-D-50227"] }
```

With no body, Exhibit investigates every open dispute that has no brief. With `ids`, it investigates exactly those open disputes, up to 50, even if they have a brief. An `ids` value that is not a list gets a 400 instead of falling back to every case.
