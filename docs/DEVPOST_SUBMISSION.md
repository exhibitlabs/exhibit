# Devpost submission: copy and paste

The fields below follow the order of Devpost's submission form. Paste the text inside each block as is. Slots the founders must fill are marked **`[[LIKE THIS]]`**; search for `[[` before submitting.

- Submit at https://paypalaihackathon.devpost.com/ before **Thu Nov 12, 2026, 12:00 PM PT (Fri Nov 13, 1:30 AM IST)**. Submissions lock at the deadline.
- Devpost's review team checks entries submitted early for eligibility, and you can keep editing until the deadline.
- Every number below comes from Exhibit's sandbox call log ([`proof.json`](../src/components/landing/records/proof.json)), its recorded runs, the evaluation ([`eval/RESULTS.md`](../eval/RESULTS.md)) or a cited source, and matches the landing page and `/proof`. Wherever the evaluation's numbers appear, keep its caveat: the builder wrote the cases and labels, with Claude.

Before you paste, commit and push this branch: the copy links to files on GitHub (`docs/SANDBOX_E2E.md`, `docs/MCP_DEMO.md`, the README sections) that must match what is on `main`.

---

## 1. Project overview

### Project name

```
Exhibit: the dispute agent for PayPal merchants
```

If the field is shorter than 47 characters, use `Exhibit`. The long form matches the site title and keeps the entry from being confused with other projects named Exhibit.

### Elevator pitch (tagline, 200 characters max)

192 characters:

```
PayPal's agent tools can list, read and accept a dispute. Exhibit does the rest: Claude investigates, cites every claim and files through the Disputes API. When the buyer is right, it refunds.
```

### Thumbnail

Upload [`docs/submission/thumbnail.png`](submission/thumbnail.png): 1500 x 1000 PNG, 3:2 as Devpost recommends (JPG, PNG or GIF, 5 MB max).

---

## 2. Project details

### About the project

Paste everything between the two rules.

---

Exhibit is a dispute agent for PayPal merchants. It reads each dispute and chargeback from **PayPal's Disputes API**, investigates it with **Claude Opus 5.5** across eight sources, and files the response back through the Disputes API when the merchant approves: `provide-evidence`, `provide-supporting-info` and `accept-claim`, all verified live on the PayPal sandbox, plus `make-offer` and `send-message`, verified on the simulator. It also uses **Orders v2** (tracking, sandbox orders), **Payments v2** (PayPal's Seller Protection flag on the capture, and refunds) and **webhook signature verification**. Every claim in a response cites a real record, every action is checked against what PayPal allows on the case right now, and when the buyer is right, Exhibit refunds. Other AI agents can use it over MCP, but they can only ask. Built from scratch during the submission period by its two co-founders, Shivansh Dwivedi and Someet Shende; the first commit is Oct 20, 2026.

**For judges: Exhibit against the five criteria**

- **Technological Implementation.** Disputes API write endpoints called live: 7 dispute responses filed on the PayPal sandbox, 244 logged calls across 12 endpoints, each with HTTP status and PayPal-Debug-Id ([sandbox run](https://github.com/exhibitlabs/exhibit/blob/main/docs/SANDBOX_E2E.md)). A Claude Opus 5.5 agent whose brief is rejected unless every citation resolves and the action is one PayPal allows right now ([guardrails](https://github.com/exhibitlabs/exhibit#guardrails)). 300 tests run with `npm test` and no keys.
- **Design.** A complete product: a command center, an inbox with saved views, a case page with a live evidence graph, lifecycle stepper, cited letter and evidence packet, a prevention radar, an Autopilot simulation, agent approvals, a PayPal API inspector and a ⌘K "Ask Exhibit" palette. See the gallery.
- **Potential Impact.** Every dispute can carry a PayPal fee: $15, $30 for high-volume sellers, $20 per card chargeback. Exhibit fights what the records support, refunds what they don't, and stops disputes before they are filed. On 30 synthetic disputes labelled before the run, Exhibit's decision matched the label in all 30, it refunded all 9 cases where the buyer was right instead of fighting them, and it made 0 false fights out of 18, in a median of 29 s per case. The builder wrote the cases and labels, with Claude, so this shows Exhibit applies its rules consistently, not real-world accuracy ([evaluation](https://github.com/exhibitlabs/exhibit/blob/main/eval/RESULTS.md)).
- **Innovation/Idea.** PayPal's agent tools can list, read and accept a dispute. Exhibit adds the investigation, the evidence and the filing, as an MCP server where agents request and merchants approve, the rule PayPal applies to its own MCP gateway ([MCP run](https://github.com/exhibitlabs/exhibit/blob/main/docs/MCP_DEMO.md)).
- **Presentation.** The demo video: [[VIDEO: YouTube URL]]. The repo runs with `npm install` and `npm run dev`, with no keys, and the proof page lists every live PayPal call.

**Verified live on the PayPal sandbox**

From Exhibit's own call log to `api-m.sandbox.paypal.com`, Oct 20 to Nov 3, 2026: 244 calls (240 returned 2xx, 4 returned an error) across 12 endpoints, 4 sandbox chargebacks and 13 agent runs. The dispute responses it filed:

- **PP-R-EGO-10193744**, unauthorized, $420. Exhibit's call: fight, 88%. `POST /v1/customer/disputes/{id}/provide-evidence` returned 200 (PayPal-Debug-Id `f199340a434c8`), then `provide-supporting-info` returned 200 twice (`ca4d904350e86`, `f6032251fbc7b`). On Nov 3 an outside AI agent (Claude Code, through Exhibit's MCP server) asked to file again; the merchant approved, and `provide-supporting-info` returned 200 (`f4652162f684d`). That moment is in the demo video. PayPal status: `UNDER_REVIEW`.
- **PP-R-QJO-10193739**, item not received, $284. Fight, 80%. `provide-supporting-info` returned 200 (`f559160835614`). After a sandbox-only `adjudicate` call (200, `f390262856e3a`), PayPal shows it `RESOLVED` (`RESOLVED_WITH_PAYOUT` / `REPRESENTED_BY_PAYPAL`).
- **PP-R-KHB-10193747**, item not received, $68: the parcel came back to the store undelivered. Refund, 3%. `accept-claim` returned 200 (`f229477d6e080`).
- **PP-R-XTI-10193748**, credit not processed, $180: the return arrived and was never refunded. Refund, 5%. `accept-claim` returned 200 (`f308851883563`).

Two earlier `provide-evidence` attempts failed (400, `f193818fe828e`; 500, `f637784337202`). They are why Exhibit now sends one evidence per call. Not tested live yet: webhooks (they need a public URL), `make-offer` and `send-message` (PayPal allows them only at the inquiry stage, which sandbox chargebacks skip), tracking push and capture refunds. Each of these is implemented and runs on the simulator.

## Inspiration

A small merchant can lose a PayPal dispute it should have won just by answering late, or without the right evidence. The evidence usually exists: a signed delivery scan, a policy the buyer accepted at checkout, a return that arrived last week. But it sits in four places (PayPal, the store, the carrier and the inbox), and the deadline comes first. Every dispute can also carry a fee. PayPal's published US fees are $15 per dispute on PayPal checkout payments, $30 for high-volume sellers, and $20 per card chargeback: "We may charge a Dispute Fee when a buyer files a dispute claim or chargeback …" ([PayPal business fees](https://www.paypal.com/us/business/paypal-business-fees), updated Oct 1, 2026, checked Nov 3, 2026).

Then we read PayPal's [agent tools reference](https://developer.paypal.com/ai-tools/agent-tools/). Its dispute tools are `list_disputes`, `get_dispute` and `accept_dispute_claim`, which resolves the case "in favor of the buyer." An agent can concede a dispute, but it cannot answer one. We wanted an agent that works a case the way a careful payments lead would, shows where every claim comes from, and says plainly when the buyer is right.

## What it does

- **Investigates.** One click, or PayPal's `CUSTOMER.DISPUTE.CREATED` webhook, starts a Claude agent with nine tools. It reads the live dispute from PayPal (reason, stage, deadline, requested evidence and the actions PayPal allows now), the order and listing, carrier scans and signature, the buyer's history and messages, checkout signals and store policies, and checks the case against PayPal's published US Seller Protection requirements, quoted word for word. The evidence graph on the case page lights up each source as the agent reads it.
- **Decides.** Fight, offer, refund or message the buyer, with a win likelihood and cited reasoning. On the demo merchant's 8 open cases it chose to fight 3. For the rest it offered a fix, wrote to the buyer, or refunded.
- **Builds the case.** A letter for PayPal's reviewer with every claim cited, and a PDF of lettered exhibits rendered from the merchant's records, never from the model's text.
- **Files through PayPal, when the merchant approves.** `provide-evidence`, `provide-supporting-info`, `accept-claim`, `make-offer` or `send-message`, whichever PayPal allows at that moment. Autopilot is off by default. When it is on, it acts only inside the merchant's limits and never on a low-confidence brief.
- **Is fair to buyers.** When the records say the buyer is right, Exhibit refunds and writes to them. On the sandbox it refused to fight two chargebacks: a wallet USPS returned to the store undelivered ($68), and a return that arrived but was never refunded ($180). The buyer gets their money back sooner, and the merchant skips a fight they would lose.
- **Prevents disputes.** A radar scores recent orders for seven warning signs, such as tracking that never reached PayPal, a stalled parcel or a buyer waiting on a reply, and fixes them: tracking pushed to PayPal, refunds, replies in the buyer's language. In the demo, Lena Hoffmann wrote that she would open a PayPal dispute. Exhibit replied in German first, and her order's risk score went from 84 to 0.
- **Answers questions.** Ask Exhibit (⌘K) answers from read-only tools, and checks every case id and chart value against what the tools returned. A live answer on the sandbox account: "$668 is at stake across 3 open PayPal disputes."
- **Works for other AI agents.** An MCP server with nine tools. Agents can investigate and request; only the merchant approves. In a recorded run, Claude Opus 5.5 with only Exhibit's MCP server attached triaged 8 open disputes in 57 seconds and queued the strongest for approval. Nothing was filed until the merchant said yes.
- **Keeps the record.** Every PayPal call is logged with its request, response, latency and debug id, beside every decision by the agent, the merchant and PayPal's webhooks.

## How we built it

- **App:** Next.js 16 (App Router, TypeScript, React 19), Tailwind CSS 4, SQLite through `node:sqlite`, AG Grid and AG Charts Community for the inbox, order tables and charts, react-pdf for the evidence packet, Zod for every schema, and Vitest.
- **AI:** Claude Opus 5.5 with adaptive thinking, behind one tool interface with three providers. By default the agent runs on the local Claude CLI login through the Claude Agent SDK, with Exhibit's tools and nothing else: no shell, no files, no other MCP servers. With `ANTHROPIC_API_KEY` set, it runs on the Claude API through the Anthropic SDK in a streaming tool loop. With neither, recorded Claude runs replay and every tool call still executes live.
- **PayPal:** one REST client for OAuth, Disputes v1, Orders v2, Payments v2 and webhook verification. It logs status, latency and debug id for every call and never logs a secret. A simulator implements the same endpoints with PayPal's request and response shapes, error codes and limits (file types, 10 MB per file, 50 MB per call, 2,000-character notes), so the product runs with no credentials, and two environment variables switch it to the real sandbox.
- **Guardrails in code, not in the prompt:** evidence refs that must resolve, action checks against the dispute's current HATEOAS links, an approval queue for agent requests, and Autopilot limits that no saved setting can raise. 300 tests, organised by guarantee.
- **MCP:** a stdio server on the official MCP SDK (`mcp/server.ts`) that can only reach Exhibit's read and request endpoints.

The flow: a merchant or an MCP agent → Exhibit (Next.js) → the Claude agent with read-only tools → the brief check (citations resolve, action allowed) → the merchant's approval → the PayPal client → the PayPal sandbox, or the simulator in demo mode. The [README](https://github.com/exhibitlabs/exhibit#architecture) has the diagram.

## Challenges we ran into

- **Making the model unable to invent evidence.** We split choosing evidence (the model) from writing it (rendering straight from the records), and reject any brief whose refs don't resolve.
- **Running the whole lifecycle on the real sandbox.** Our sandbox business account couldn't take direct card payments (`PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING`), so Exhibit seeds real orders, a buyer pays in PayPal's sandbox checkout, and Exhibit captures them and opens chargebacks with the sandbox `process-chargeback` endpoint. The real API then taught us rules the docs don't spell out: file only the evidence types PayPal requested, one per call, and use `provide-supporting-info` while PayPal is already reviewing a chargeback.
- **Letting other agents in safely.** An agent's request expires if the case is re-investigated before the merchant approves, a decision is accepted only from the Exhibit app itself, and a run an outside agent started never auto-files, even with Autopilot on.
- **Policy accuracy.** We encoded PayPal's current US Seller Protection page (last updated Jan 26, 2026) requirement by requirement, with its exact text, instead of rules from memory. The current page no longer contains the old $750 signature rule.

## Accomplishments that we're proud of

- Seven dispute responses filed live through PayPal's Disputes API, each with a PayPal debug id, including the honest path: two claims accepted because the buyer was right.
- A brief cannot be saved unless every citation resolves to a real record and the action is one PayPal allows on the case right now.
- The full product runs with no setup, and the same PayPal client runs against the live sandbox.
- 300 tests that need no keys and no network.
- An evaluation on 30 synthetic disputes across seven reasons, labelled and hashed before one live run: 30 of 30 decisions matched the label, 9 of 9 buyer-right cases were refunded rather than fought, 0 of 18 were false fights, and all 30 briefs passed the citation and action guardrails. The builder wrote the cases and labels, with Claude, so it shows consistency, not real-world accuracy.

## What we learned

The hard part of an agent that touches money isn't the model call. It's the contract around it: what the agent may cite, which actions are legal right now, who must approve, and how every step is recorded. We also learned that "refund" is part of the product. An agent PayPal's merchants can trust has to say when the buyer is right.

## What's next for Exhibit

- A hosted demo, and live webhooks once there is a public URL.
- Store and carrier connectors (Shopify, WooCommerce, carrier proof-of-delivery) in place of the demo store.
- `make-offer` and `send-message` on live inquiry-stage cases.
- A pilot with PayPal merchants to measure win rate by reason code.

## Known limitations

- The demo merchant is shared by everyone on a server until it resets (after 20 quiet minutes).
- Order, carrier and inbox records come from a built-in demo store, also in sandbox mode.
- **Simulate new dispute** copies an existing demo case, so on recorded runs its brief reuses that case's recorded text.
- Sandbox outcomes are not PayPal decisions on the merits.

Exhibit is an independent project. It is not affiliated with or endorsed by PayPal.

---

### Built with (25 tags max; 23 used)

```
paypal, paypal-disputes-api, paypal-orders-api, paypal-payments-api, paypal-webhooks, paypal-sandbox, claude, claude-opus-5.5, anthropic, claude-agent-sdk, claude-code, model-context-protocol, next.js, react, typescript, node.js, tailwindcss, sqlite, ag-grid, ag-charts, react-pdf, zod, vitest
```

Every tag is in the code: the PayPal APIs in `src/lib/paypal/client.ts`, Claude through the Anthropic SDK and the Claude Agent SDK (which runs on the Claude Code CLI login), the MCP SDK in `mcp/server.ts`, and the rest in `package.json`.

### Try it out (links)

```
https://github.com/exhibitlabs/exhibit
```

```
[[HOSTED DEMO: the deployed URL, once it exists. Until then, leave only the GitHub link; the README's Quick start is the run path.]]
```

### Image gallery

Upload in this order (2880 x 1800 PNGs, captured at 1440 x 900 by [`docs/submission/capture.mjs`](submission/capture.mjs)). Each caption says where the image comes from.

| File | Caption |
| --- | --- |
| `gallery-01-landing.png` | The landing page: Exhibit's case page for a PayPal sandbox chargeback, set into Harnett's 1879 letter-rack painting. Kora Atelier is a demo merchant. |
| `gallery-02-proof.png` | The homepage's proof board: Exhibit's own log of 244 PayPal sandbox calls, one dot each, the 7 responses it filed with debug ids, and the 4 failures. |
| `gallery-03-command-center.png` | Command center on the demo merchant (fictional store, PayPal simulator, generated 90-day history): recovered, at risk and the cases due next. |
| `gallery-04-case.png` | A case: the evidence graph, Exhibit's brief (fight, 88%) and the response to PayPal, every claim cited to a lettered exhibit. Demo merchant, recorded run. |
| `gallery-05-prevention.png` | Prevention: a buyer warns in German that she will open a PayPal dispute; Exhibit flags the order and drafts the reply in German first. Demo merchant. |
| `gallery-06-ask.png` | Ask Exhibit (⌘K): "What's our win rate by dispute reason?" answered from read-only tools, with its chart. Demo merchant, offline answers. |
| `gallery-07-agent-approval.png` | An outside AI agent (Claude Code, over MCP) asks to file evidence with PayPal. Nothing is sent until the merchant approves. Demo merchant. |
| `gallery-08-paypal-activity.png` | PayPal activity with the API inspector open: status, latency, debug id, redacted request, response and a sandbox curl. Demo merchant, PayPal simulator. |

### Video demo link

```
[[VIDEO: YouTube URL of the v5 cut. Public (not unlisted), marked Not made for kids, under 3:00.]]
```

---

## 3. Additional details

These fields vary by hackathon; paste each answer where the form asks for it.

### Testing instructions for judges

```
No keys, accounts or credentials are needed.

1. Install Node.js 24 or newer.
2. git clone https://github.com/exhibitlabs/exhibit && cd exhibit
3. npm install
4. npm run dev
5. Open http://localhost:3000/app

You start in demo mode, the offline judge mode: a fictional store (Kora Atelier) on a built-in PayPal simulator with the real API's request and response shapes, error codes and file limits. The banner's "What's real?" link says exactly what is real, simulated or recorded. The demo guide (**Guide** in the top bar, also shown on the overview) walks you through six steps: run Exhibit on a case, review the evidence packet, file with PayPal, prevent a dispute, ask a question, and approve an agent request.

The AI: if you are signed in to the Claude CLI on your machine, the agent runs live on Claude Opus 5.5 automatically. Set ANTHROPIC_API_KEY in .env.local to use the Claude API instead. With neither, Exhibit replays recorded Claude runs, and every tool call, check and filing still runs live.

To use your own PayPal sandbox: create a REST app under Apps & Credentials (Sandbox) at developer.paypal.com, copy .env.example to .env.local, set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET, and restart. Settings > Test connection checks OAuth and the Disputes API. Settings > Seed the sandbox opens real sandbox chargebacks in three steps; the README explains each one.

The live sandbox record (244 calls with PayPal debug ids) is at /proof in the running app and in docs/SANDBOX_E2E.md. Tests: npm test (300 tests, no keys, no network).
```

### Tools used (required)

```
AI in the product
- Claude Opus 5.5 (model id claude-opus-5-5) is the case agent. It calls nine tools (the PayPal Disputes API, the order, carrier tracking, buyer history, the support inbox, checkout risk signals, store policies, a Seller Protection check, and file_case_brief) and files a structured brief: the decision, win likelihood, cited reasoning, lettered exhibits, the PayPal action and the response letter. Code checks every brief before it is saved: each citation must resolve to a record, and the action must be one PayPal allows on the case right now.
- It runs three ways: on the local Claude CLI login through the Claude Agent SDK (the default when you are signed in), on the Claude API through the Anthropic SDK when ANTHROPIC_API_KEY is set, or from recorded Claude runs when neither is available. Recorded runs replay the model's reasoning, but every tool call, check and filing executes live.
- Ask Exhibit, the question palette, uses the same model and providers with read-only tools. With no Claude login or key it falls back to a fixed set of offline answers, and says so.
- The MCP demo (docs/MCP_DEMO.md) is Claude Opus 5.5, through the Claude Agent SDK, using Exhibit's MCP server as its only tool.

PayPal developer platform
- Disputes v1, Orders v2, Payments v2, OAuth 2.0 and webhook signature verification, on the PayPal sandbox.

Other tools
- AG Grid and AG Charts Community for the tables and charts; react-pdf for the evidence packet.

How it was built
- Exhibit was built by its co-founders, Shivansh Dwivedi and Someet Shende, with help from Claude Code as a coding assistant.
- [[VIDEO TOOLS: name any AI voice, music or image tools used in the v5 video, or delete this line]]
```

### URL to your code repository

```
https://github.com/exhibitlabs/exhibit
```

Public, MIT licensed. GitHub shows the license in the repo's About section.

### Opt-in prizes

- **Grand prizes and the main awards** (1st, 2nd and 3rd place, Most Creative, Most Impactful, Best Demo Delivery, Best Use of PayPal + AI, Best Use of Agentic Commerce) are judged across all eligible projects. Nothing to tick.
- **Tick: Best Use of AG Grid.** Exhibit uses AG Grid Community for the disputes inbox, the command center's "Needs you" grid and the watched-orders table, and AG Charts Community for the command center and Ask Exhibit charts. Be aware that the sponsor page asks for more: "custom widgets, theming, and layout tools, not just AG Grid or AG Charts on their own," and it suggests AG Studio and its Studio Agent Framework, which Exhibit does not use.
- **Don't tick** Render, Bryntum, APIMatic or Channel3. Exhibit doesn't use them.

### Other fields

- **Submitter type:** [[FOUNDER: Individual, or Organization. Prize payment needs identity forms and, for an individual outside the US, a W-8BEN, so decide before submitting.]]
- **Country of residence:** [[FOUNDER: India]]
- **If asked how the project was improved during the hackathon:** "Built from scratch during the submission period. The first commit is Oct 20, 2026, and the whole history is public on GitHub."
- **If asked for a PayPal developer account or app id:** [[FOUNDER: only if the form asks]]

---

## Before you press submit

- [ ] Commit and push, so GitHub matches this copy and the video.
- [ ] Add Someet Shende as a teammate on the Devpost project (Manage team → invite; he needs a Devpost account and must accept), so the entry is credited to both co-founders. Both must meet the eligibility rules.
- [ ] Fill every `[[` slot: `VIDEO` (twice), `HOSTED DEMO`, `VIDEO TOOLS`, submitter type and country.
- [ ] The YouTube video is Public, marked Not made for kids and under 3:00. Ideally PayPal and Claude are both on screen in the first 25 seconds.
- [ ] Upload the thumbnail and the eight gallery images, with the captions above.
- [ ] On GitHub, set the repo's About website and topics.
- [ ] GitHub Actions is locked by a billing issue on the account, so CI cannot run. Unlock billing, re-run the workflow, and only then mention a CI badge. Until then the copy points to `npm test`.
- [ ] Open the submitted page while logged out and click every link.
