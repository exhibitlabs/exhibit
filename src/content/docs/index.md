---
title: Introduction
description: Exhibit is the dispute agent for PayPal merchants. These docs show how to run it, how it decides, and why you can trust what it files.
section: Get started
order: 1
---

Exhibit reads each PayPal dispute through the Disputes API and investigates it with Claude. It decides whether to fight, offer, refund or message the buyer, writes the response to PayPal's reviewer around lettered exhibits that each cite a real record, and builds a PDF of those exhibits from the records themselves. Nothing reaches PayPal until the merchant approves, unless the merchant has switched on Autopilot rules for that kind of case.

It is open source under the MIT licence, built for the PayPal AI Hackathon 2026 by Shivansh Dwivedi and Someet Shende.

## Who it is for

- **Merchants who sell through PayPal.** Small teams without a payments operations person, who lose disputes they could win and fight ones they should refund.
- **Their engineers.** Exhibit is a Next.js app you run yourself: one PayPal client, a typed agent, SQLite for its records and 300 tests.
- **People building AI agents.** Exhibit's MCP server lets Claude, ChatGPT or an agent built on PayPal's Agent Toolkit investigate disputes and ask the merchant to approve a filing.

## What it does

| Capability | In one line | Read more |
|---|---|---|
| Investigate | Claude reads the dispute, the order and listing, carrier scans, the buyer's history and messages, checkout signals, store policies and PayPal's Seller Protection rules. | [How Exhibit decides](/docs/how-exhibit-decides) |
| Decide | Fight, offer, refund or message the buyer, with a win likelihood and the reasoning behind it. | [How Exhibit decides](/docs/how-exhibit-decides#decisions) |
| Write the evidence | A response letter that cites lettered exhibits, and a PDF packet rendered from the records themselves. | [Evidence packets](/docs/evidence-packets) |
| File with PayPal | The action PayPal allows on the dispute right now, through the Disputes API. | [PayPal integration](/docs/paypal-integration) |
| Prevent | Scores recent orders for seven warning signs and fixes them before a buyer files. | [Prevention](/docs/prevention) |
| Answer questions | Ask Exhibit answers questions about the whole dispute book from read-only tools. | [Ask Exhibit](/docs/ask-exhibit) |
| Serve other agents | Nine MCP tools. Agents can investigate and request; only the merchant approves. | [MCP server](/docs/mcp) |
| Act on clear cases | Optional Autopilot rules inside hard limits no setting can raise. | [Autopilot](/docs/autopilot) |

## What it does not do

- **It does not invent evidence.** The agent's tools only read. Every exhibit cites a record a tool returned, a brief that cites anything else is rejected, and the packet re-reads each record from source. See [Evidence packets](/docs/evidence-packets#why-the-model-cannot-invent-evidence).
- **It does not move money on its own.** Filings, refunds and offers need the merchant's approval, or an Autopilot rule the merchant switched on. Outside agents can only ask.
- **It does not decide disputes.** PayPal does. Exhibit recommends and files; the win likelihood is the agent's estimate, not a promise.
- **It does not connect to your store or carrier yet.** Orders, shipments, messages and checkout signals come from a built-in demo store, also in sandbox mode. Shopify, WooCommerce and carrier connectors are not built.
- **It does not run against live PayPal.** Exhibit talks to its simulator or to the PayPal sandbox. There is no production mode.
- **It has no sign-in yet.** It is a single-merchant app. Do not expose a deployment with PayPal credentials until authentication sits in front of it. See [Security model](/docs/security-model#limits).

## How one dispute flows

1. PayPal opens a dispute. Exhibit learns about it from an inbox sync or a `CUSTOMER.DISPUTE.CREATED` webhook.
2. The agent investigates with nine tools: eight read the case, the ninth files the brief.
3. The brief check rejects any brief that cites a record that does not exist on the case, or picks an action the dispute does not offer right now. The agent fixes it and files again.
4. The merchant reviews the brief, the letter and the packet, edits if needed, and approves. Autopilot can approve clear cases inside its limits.
5. Exhibit re-reads the dispute from PayPal and calls the allowed action: `provide-evidence`, `provide-supporting-info`, `accept-claim`, `make-offer` or `send-message`, with the packet attached where PayPal takes files.
6. Every PayPal call is logged with its status, latency and PayPal debug id. Secrets never reach the log.

## Tested on the live sandbox

Exhibit has run end to end on `api-m.sandbox.paypal.com`: 244 API calls across 12 endpoints, 4 sandbox chargebacks, 13 agent runs and 7 dispute responses filed through the API, from Oct 20 to Nov 3, 2026. Two early filings failed, with a 400 and a 500, and taught Exhibit to send one evidence per call. The full record, with debug ids, is on [the proof page](/proof). What has not been tested live is listed in the [Sandbox guide](/docs/sandbox#not-testable-live).

## Start here

:::cards
- [Quickstart](/docs/quickstart): Run Exhibit locally in two minutes, with no keys.
- [Sandbox guide](/docs/sandbox): Use your own PayPal sandbox and open real chargebacks.
- [PayPal integration](/docs/paypal-integration): Every PayPal endpoint, the dispute lifecycle and the lessons from the live sandbox.
- [Security model](/docs/security-model): What the agent can touch, and how credentials and data are handled.
:::
