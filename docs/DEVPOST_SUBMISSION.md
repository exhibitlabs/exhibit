# Devpost submission: copy and paste

Submit at https://paypalaihackathon.devpost.com/ before **Nov 12, 2026, 12:00 PM PT (1:30 AM IST, Nov 13)**.

## Project name
Exhibit

## Elevator pitch (tagline, 200 characters max)
The AI dispute agent for PayPal merchants: it investigates every dispute, builds a cited evidence packet, and files the response through PayPal's API, or tells you honestly to refund.

## Inspiration
Small merchants lose PayPal disputes they should win. The evidence almost always exists: a signed UPS scan, a policy the buyer accepted, a return that arrived four days ago. But it is scattered across PayPal, the store, the carrier and the inbox, and the response deadline arrives first. So merchants either fight everything badly or refund everything. Mastercard and Datos Insights expect about 261 million chargebacks worldwide in 2025. We wanted an agent that works a case the way an experienced payments ops lead would, and is honest enough to say "don't fight this one."

## What it does
Exhibit connects to a merchant's PayPal account and store. When a dispute opens (via the `CUSTOMER.DISPUTE.CREATED` webhook, or a sync), it:

1. **Investigates.** A Claude agent pulls the live dispute from the PayPal Disputes API (reason, stage, deadline, buyer messages, requested evidence, allowed actions), then the order and product listing, carrier scans and signature, the buyer's history and messages, checkout risk signals and store policies. It checks the case against PayPal's published Seller Protection requirements, quoted word for word.
2. **Decides.** Fight, offer, refund, or message the buyer. It gives a win likelihood, cited reasoning, risks and missing evidence. A returned-to-sender parcel gets a refund. A return that already arrived gets "refund now, then file proof of refund". A German buyer whose parcel is in her Packstation gets a warm German message with the pickup details.
3. **Builds the case.** It drafts a response letter for PayPal's reviewer and an evidence packet PDF with labelled exhibits (A, B, C…) rendered directly from source records.
4. **Acts through PayPal.** One click (or Autopilot, within the merchant's limits) calls `provide-evidence` (multipart with the PDF and tracking info), `make-offer`, `accept-claim`, `send-message`, or refunds the capture first and then files `PROOF_OF_REFUND`.

Every case opens with an **evidence graph**: the claim in the centre, eight sources around it. Sources light up as the agent queries them, then cited records become lettered exhibits wired to the verdict, so a merchant (or a PayPal reviewer) can see at a glance what the decision rests on and what the agent skipped.

It also **prevents** disputes: Protection finds shipments whose tracking never reached PayPal and pushes them with the Orders v2 tracking API.

## How we built it
- **Next.js 16** (App Router, TypeScript), **SQLite** via `node:sqlite`, **AG Grid** for the disputes inbox and Protection tables, **react-pdf** for evidence packets.
- **PayPal:** OAuth client credentials; Disputes v1 (list, get, provide-evidence, provide-supporting-info, make-offer, accept-claim, send-message, adjudicate, require-evidence); Orders v2 (create, capture, track); Payments v2 (capture lookup with PayPal's `seller_protection` flag, refund); Webhooks (verify signature); sandbox `process-chargeback` to create real test disputes. Every call is logged with method, path, status, latency and `debug_id`.
- **Verified live in the PayPal sandbox:** real orders paid through PayPal checkout and captured, chargebacks opened with `process-chargeback`, the agent's brief filed with `provide-evidence` (PROOF_OF_FULFILLMENT with UPS tracking, the response letter and the PDF packet) and with `provide-supporting-info` on a chargeback PayPal was already reviewing, then `adjudicate`. PayPal stored the evidence packet on both disputes.
- **A PayPal simulator** that implements the same endpoints, shapes, errors and limits (file types, 10 MB per file, 50 MB per call, 2,000-character notes), behind the same `fetch()` interface. Judges can run the full product with no credentials; adding two env vars switches to the real sandbox.
- **AI:** Claude (`claude-opus-5-5`) with adaptive thinking streamed to the UI, nine typed tools, and a structured `file_case_brief` deliverable. The live provider uses the Anthropic SDK with a streaming tool loop and server-side refusal fallback. A replay provider re-runs recorded investigations with live tool calls when no key is configured.
- **Guardrails:** evidence refs (the agent can only cite records its tools returned, and the PDF re-reads every ref from source data); action validation against the dispute's current HATEOAS links and allowed offer types; Autopilot thresholds; full audit trail.

## Challenges we ran into
- **Making the AI incapable of inventing evidence.** We separated *choosing* evidence (the model) from *writing* it (deterministic rendering from refs), and reject any brief whose refs don't resolve.
- **Testing the whole lifecycle.** Creating disputes as a buyer needs partner consent, and our sandbox account couldn't take direct card payments (`PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING`). So Exhibit seeds real orders, a buyer approves them in PayPal's sandbox checkout, and Exhibit captures them and opens chargebacks with the sandbox `process-chargeback` endpoint. The real API also taught us rules the docs don't spell out: file only the evidence types PayPal requested, one per call, and answer with `provide-supporting-info` while PayPal is already reviewing a chargeback.
- **Policy accuracy.** We pulled PayPal's current US Seller Protection page and encoded each requirement with its exact text, instead of relying on remembered rules (for example, the old $750 signature rule is no longer on the current page).

## Accomplishments that we're proud of
- On the eight demo cases the agent makes the call an experienced ops lead would, including the three where the right answer is *not* to fight.
- A 30-second investigation produces a reviewer-ready letter and a multi-page evidence packet.
- The product runs end to end with zero setup, and the same code path runs against PayPal's sandbox.

## Exhibit over MCP (for any AI agent)
Exhibit is also an MCP server (`node mcp/server.ts`), so Claude Desktop, Claude Code, ChatGPT or an agent built on PayPal's Agent Toolkit can list disputes, run investigations, fetch evidence packets and check prevention risk. PayPal's toolkit lets agents act on disputes; Exhibit lets them win them. Every money-moving or customer-facing step (filing, offers, refunds, buyer messages, prevention fixes) is only a *request*: the merchant approves it in Exhibit, which then executes it through the same audited PayPal code path. `docs/MCP_DEMO.md` is a real transcript of Claude triaging eight disputes and queuing the strongest for approval.

## What we learned
The hard part of an AI agent for money isn't the model call. It's the contract around it: what the agent may cite, which actions are legal right now, when a human must approve, and how every step is audited.

## What's next for Exhibit
Shopify and WooCommerce connectors, carrier APIs for signature images and proof-of-delivery letters, Braintree and Venmo disputes, pre-dispute buyer outreach, and a pilot with 20 PayPal merchants to measure win rate by reason code.

## Built with
nextjs, typescript, react, tailwindcss, paypal-disputes-api, paypal-orders-api, paypal-payments-api, paypal-webhooks, anthropic, claude, ag-grid, react-pdf, sqlite, zod

## Try it out
- Code: `https://github.com/shvuuuu/exhibit` (public, MIT)
- Demo video: `https://youtu.be/<video-id>`

## Testing instructions for judges
```
git clone https://github.com/shvuuuu/exhibit && cd exhibit
npm install
npm run dev   # open http://localhost:3000
```
No keys needed: PayPal calls go to the built-in simulator and the agent replays recorded runs while executing every tool call live. Set `ANTHROPIC_API_KEY` to run the agent live, and `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` (sandbox) to use your own PayPal sandbox; then **Settings → Create sandbox disputes**.

## Tools used (required field)
- **Claude (Anthropic API, `claude-opus-5-5`)**: the investigation agent. It calls nine tools (PayPal Disputes API, store orders, carrier tracking, customer history, support inbox, risk signals, store policies, Seller Protection check) and files a structured case brief. Adaptive thinking is streamed to the case page.
- **PayPal developer platform**: Disputes v1, Orders v2, Payments v2, Webhooks, sandbox lifecycle endpoints.
- **AG Grid**: disputes inbox and Protection tables with custom cell renderers.

## Prize categories to tick
Grand prize, honorable mentions (Most Impactful, Best Use of PayPal + AI, Best Demo Delivery), and **Best Use of AG Grid**.
