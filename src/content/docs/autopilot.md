---
title: Autopilot
description: Let Exhibit act on clear cases inside limits you set. Off by default, with hard limits that no saved setting can raise.
section: How it works
order: 5
---

Autopilot lets Exhibit carry out a brief's PayPal action on its own when the case fits a rule you set: file evidence on a strong case, refund a small claim the buyer is right about, send a fair offer or message the buyer. It is off by default. Anything outside an explicit rule waits for a person.

The rules live in `src/lib/autopilot-rules.ts`, a pure module shared by the server, which acts, and the **Autopilot** page, which previews and simulates.

## When Autopilot acts {#when}

Autopilot runs at the end of an investigation, after the brief has passed validation. Exhibit records a verdict on the run, `AUTO` or `REVIEW`, with the rule that decided and the reason. On `AUTO` it runs the brief's PayPal action through the same code as the merchant's own button on the case page, logged with the actor `autopilot`.

Whether a verdict can act depends on what started the run:

| Run started by | `trigger` | Can Autopilot act? |
|---|---|---|
| **Run Exhibit** on a case | `manual` | Yes |
| A PayPal `CUSTOMER.DISPUTE.CREATED` webhook, or **Simulate new dispute** in demo mode | `webhook` | Yes |
| **Investigate** on the Disputes page, for new cases or a selection | `batch` | Yes |
| An AI agent over MCP (`investigate_dispute`) | `agent` | Never. The agent can only request; the merchant approves. |
| A demo reset preparing briefs from recorded runs | `seed` | Never. The visitor decides. |

> [!CAUTION] Real calls in sandbox mode
> With PayPal credentials set, an `AUTO` verdict calls PayPal without asking you. A refund rule refunds the buyer through PayPal on its own. Read the simulation on the Autopilot page before you switch it on.

## The rules {#rules}

Each rule matches one decision in the brief. The main switch sits above them.

| Rule | On the Autopilot page | Default | Acts when |
|---|---|---|---|
| Main switch | **Autopilot** | Off | Nothing acts until it is on. |
| Fight | **File evidence on strong cases** | On, at least 85%, up to $300 | The win likelihood is at or above the threshold and the disputed amount is at or below the limit. |
| Refund | **Refund when the buyer is right** | On, up to $75 | The disputed amount is at or below the limit. The win likelihood does not count: an unwinnable case is the reason to refund. |
| Offers | **Send fair offers** | Off, up to $60 | The amount offered, not the disputed amount, is at or below the limit. |
| Messages | **Message buyers in the inquiry stage** | On | Always, while the rule is on. |

Every rule also passes the checks in [How a verdict is reached](/docs/autopilot#verdict): the main switch, low confidence and the $1,000 ceiling come first.

Both ends of every limit are inclusive: with the defaults, a case at exactly 85% and exactly $300 is filed automatically. Limits compare amounts as plain numbers, whatever the dispute's currency; the page shows them in dollars.

## How a verdict is reached {#verdict}

Exhibit checks in this order and stops at the first answer:

1. Autopilot is off: `REVIEW`, "Autopilot is off: every response waits for your approval."
2. The brief's confidence is `LOW`: `REVIEW`, "Low-confidence briefs always go to a person."
3. The disputed amount is above $1,000: `REVIEW`, whatever the rules say.
4. The rule for the brief's decision is off, or the case is outside its limits: `REVIEW`. Inside them: `AUTO`.
5. An `AUTO` verdict is checked once more: the PayPal action in the brief must belong to its decision. If not, the verdict becomes `REVIEW`, and a person decides.

The last check exists because Exhibit runs the brief's PayPal action, while the rules judge its decision. A brief that says "message the buyer" but would accept the claim would otherwise refund with no dollar limit checked.

| Decision | PayPal actions Autopilot may run for it |
|---|---|
| `FIGHT` | `provide_evidence`, `provide_supporting_info` |
| `REFUND` | `accept_claim`, `refund_then_prove` |
| `OFFER` | `make_offer` |
| `MESSAGE_BUYER` | `send_message` |

## Hard limits {#hard-limits}

These are `AUTOPILOT_LIMITS` in `src/lib/autopilot-rules.ts`. A rule can be stricter, never looser.

- Nothing above $1,000 is ever automatic. Every dollar limit is held between $0 and $1,000.
- Evidence is never filed automatically below 60% win likelihood. The fight threshold is held between 60% and 100%.
- Low-confidence briefs always go to a person.
- Runs started by an AI agent, and briefs prepared by a demo reset, never act.

Settings are clamped and rounded to whole numbers every time they are saved or read: from the page, from a `PUT /api/autopilot` request or from the database. A missing or malformed value takes its default. For example, this request asks for a 10% threshold and a $5,000 limit (and also switches Autopilot on):

```http
PUT /api/autopilot
Content-Type: application/json

{"enabled": true, "fight": {"enabled": true, "minLikelihood": 10, "maxAmount": 5000}}
```

Exhibit stores, and answers with, the nearest settings inside the limits:

```json
{
  "enabled": true,
  "fight": { "enabled": true, "minLikelihood": 60, "maxAmount": 1000 },
  "refund": { "enabled": true, "maxAmount": 75 },
  "offers": { "enabled": false, "maxAmount": 60 },
  "messages": { "enabled": true }
}
```

## What always goes to a person {#always-a-person}

- Every brief while Autopilot is off, which is the default.
- Low-confidence briefs, for every kind of decision.
- Disputes above $1,000.
- Fights below 60% win likelihood, or below your threshold if it is higher.
- Amounts above your limits.
- Offers, until you switch the offers rule on.
- A brief whose PayPal action does not belong to its decision.
- Investigations an AI agent started over MCP. Its requests wait on **Agent requests** for you. See [MCP server](/docs/mcp#approval-flow).
- Briefs a demo reset prepared from recorded runs.
- A run that ends without a valid brief. There is nothing to act on, and the last good brief stays as it was.

## Preview before you switch it on

The **Autopilot** page (`/app/autopilot`) shows what your rules would do before you save them:

- **What these rules would have done** replays the rules, as if Autopilot were on, over resolved cases from the last 90 days. It shows how many cases Exhibit would have handled alone, what it would have recovered and refunded, how many it would have asked you about, and any automatic fights that were then lost. In demo mode this history is demo data for the fictional merchant. In sandbox mode there is no resolved history to replay yet.
- **Your open cases under these rules** applies the rules to every open case that has a brief.

Changes stay on the page until you press **Save rules**, which sends `PUT /api/autopilot`. The audit log records every save with the new rules.

## Settings reference

The settings are stored per PayPal mode, so demo and sandbox keep separate rules.

| Field | Type | Default | Allowed values |
|---|---|---|---|
| `enabled` | boolean | `false` | |
| `fight.enabled` | boolean | `true` | |
| `fight.minLikelihood` | integer, percent | `85` | 60 to 100 |
| `fight.maxAmount` | integer | `300` | 0 to 1,000 |
| `refund.enabled` | boolean | `true` | |
| `refund.maxAmount` | integer | `75` | 0 to 1,000 |
| `offers.enabled` | boolean | `false` | |
| `offers.maxAmount` | integer | `60` | 0 to 1,000 |
| `messages.enabled` | boolean | `true` | |

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/autopilot` | Returns the current settings. |
| `PUT` | `/api/autopilot` | Saves the settings, clamped to the hard limits, and returns what was stored. A body that is not JSON gets a 400 and the old settings stay. |

## Audit trail

Each automatic action is recorded with the actor `autopilot`, in the case's history and in **PayPal activity** (`/app/activity`) with the PayPal call it made. The run keeps the verdict, its rule and its reason next to the brief that justified it.

`tests/autopilot.test.ts` covers the rules and limits, including a sweep across amounts, likelihoods, confidence levels and switches. `tests/agent-run.test.ts` covers when a run may act. See [Testing and evaluation](/docs/testing-and-evaluation).
