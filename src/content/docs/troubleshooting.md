---
title: Troubleshooting and FAQ
label: Troubleshooting
description: Fixes for the messages you are most likely to see, by area, and answers to common questions about keys, data, agents and PayPal.
section: Reference
order: 3
---

Find the message or symptom you see, then the fix. The messages are quoted exactly as Exhibit prints them.

## Quick checks

Three places answer most questions:

- `GET /api/status` shows the PayPal mode, the AI provider and the model in use. Add `?check=1` to test the PayPal connection, as **Settings → Test connection** does.
- **PayPal activity** (`/app/activity`) lists every PayPal call with its status, latency and PayPal debug id, and the request and response for each.
- The case page shows each tool call of the investigation, Autopilot's verdict and any error.

```bash
curl -s http://localhost:3000/api/status
```

## Setup

| Symptom | Cause and fix |
|---|---|
| Install or start fails on an older Node | Exhibit needs Node 24 or newer, and uses the built-in `node:sqlite`. `.nvmrc` says 24, so `nvm use` in the repository picks it. |
| A change to `.env.local` has no effect | Restart the dev server after editing it, then check `GET /api/status`. |
| Port 3000 is taken | Start on another port with `npx next dev -p 3100`. Set `EXHIBIT_APP_URL` to the new address if you seed the sandbox, and `EXHIBIT_URL` if you use the MCP server. |

## The agent

| Message or symptom | What it means and what to do |
|---|---|
| "The Claude CLI isn't available on this machine, so this is a recorded run." | Exhibit found a `~/.claude` folder and chose the Claude CLI, but the CLI could not start, so the case replayed its recorded run. Sign in to the Claude CLI, set `ANTHROPIC_API_KEY`, or set `EXHIBIT_ALLOW_CLAUDE_CODE=0` to use recorded runs on purpose. |
| Every run is a recorded run | There is no API key and no `~/.claude` folder, or `EXHIBIT_AI_PROVIDER=replay` is set. See [AI provider](/docs/configuration#ai-provider). |
| "The agent finished without filing a case brief." | The model stopped before it filed a valid brief. On the Claude API the same failure reads "The agent stopped without filing a case brief." or "The agent ran out of turns before filing a case brief." The run is saved as an error, nothing is acted on and the last good brief stays. Run Exhibit again. |
| "The model declined this request." | The Claude API refused the request. Nothing ran. |
| "Exhibit is already working on this dispute." | Exhibit runs one investigation per dispute at a time. Wait for the current run to finish. |
| "Run Exhibit on this dispute first." | The evidence packet and the filing button need a brief. |
| "PayPal has no dispute PP-D-…" | PayPal, or the simulator in demo mode, does not know that id. Nothing started. |

## PayPal sandbox

| Message or symptom | What it means and what to do |
|---|---|
| "Sandbox seeding needs PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET." | Seeding only works in sandbox mode. Set both in `.env.local` and restart. |
| **Test connection** fails | The credentials must come from a sandbox REST app (developer.paypal.com, Apps & Credentials, Sandbox). `paypalError` from `GET /api/status?check=1` carries PayPal's message. |
| `PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING` on order create (HTTP 422) | The sandbox business account cannot take direct card payments. Seeding then leaves each order for a buyer to pay in PayPal checkout. |
| A new chargeback only accepts supporting info | New chargebacks move from `OPEN` to `UNDER_REVIEW`, where only `provide-supporting-info` is open, then to `WAITING_FOR_SELLER_RESPONSE` about five minutes later. Exhibit files whichever response PayPal allows at that moment. |
| No offer or message option on a sandbox chargeback | PayPal allows `make-offer` and `send-message` only at the inquiry stage. Chargebacks opened with `process-chargeback` skip that stage, so those two actions are verified on the simulator only. |
| After paying in PayPal checkout, the browser lands on `localhost:3000` | The return links use `EXHIBIT_APP_URL`, which defaults to `http://localhost:3000`. Set it to the address the app runs on. |
| Checkout declines the test buyer | Guest-only payments were declined in testing. Pay by card and create a PayPal account on the way; the sandbox SMS code is `111111`. More tips are in the [Sandbox guide](/docs/sandbox). |
| "Accepting an offer as the buyer needs buyer credentials in the real sandbox." | The buyer's side can only be simulated in demo mode. |
| An action fails with PayPal's error | Exhibit records the failed attempt with PayPal's issue and debug id, and changes nothing else. Open **PayPal activity** to read the request and response. |

## Webhooks

| Message or symptom | What it means and what to do |
|---|---|
| "PAYPAL_WEBHOOK_ID is not set" (HTTP 500) | In sandbox mode the listener needs the webhook id to verify signatures. Copy it from your sandbox app's webhooks into `.env.local`. |
| "signature verification failed" (HTTP 400) | PayPal's signature check did not return `SUCCESS`. Make sure `PAYPAL_WEBHOOK_ID` belongs to the webhook that sent the event. |
| No webhooks arrive | PayPal only delivers to a public HTTPS URL. Subscribe `/api/webhooks/paypal` on that URL to `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.UPDATED` and `CUSTOMER.DISPUTE.RESOLVED`. |

> [!WARNING] A public URL exposes every route
> Exhibit has no sign-in yet. A deployment or a tunnel that PayPal can reach can also be reached by anyone else, including the routes that file and refund. Put authentication in front of it first. See [Security model](/docs/security-model#limits).

## Demo mode

| Message or symptom | What it means and what to do |
|---|---|
| "Demo controls are only available in demo mode. Sandbox data is never reset." | Reset, simulated disputes and the demo agent exist only in demo mode. |
| The demo changed while you were using it | Everyone on the same server shares the demo merchant, so another visitor's filing or fix shows up for you. The demo resets after 20 quiet minutes, and **Reset demo** resets it now. |
| "Every open case is already answered. Reset the demo to try the approval flow again." | The demo agent needs an open case with a brief that has not been answered yet. Reset the demo. |

## MCP and approvals

| Message or symptom | What it means and what to do |
|---|---|
| "Could not reach Exhibit at `http://localhost:3000` (…). Is the app running? Set EXHIBIT_URL to its address." | The MCP server cannot reach the app. Start it, and set `EXHIBIT_URL` in the client's config to the address it runs on. |
| "Refusing to run: … is in sandbox mode." | `npm run mcp:smoke` approves a filing, so it only runs against a demo-mode app. Point `EXHIBIT_URL` at one. |
| "Approvals are decided by the merchant in the Exhibit app." (HTTP 403) | Decisions come only from a same-origin browser request. Approve or reject in the app. |
| "The case brief changed after this request was made; nothing was filed." | The case was re-investigated after the agent asked. Ask the agent to request again. |
| "This request is already approved." (or rejected, failed or stale) | Each request is decided once. |
| The server does not appear in Claude Desktop | Use the absolute path to `mcp/server.ts`, check that the `node` Claude starts is version 22.18 or newer, and restart Claude Desktop after you edit `claude_desktop_config.json`. |

## Ask Exhibit

| Message or symptom | What it means and what to do |
|---|---|
| "The live agent is unavailable, so this is an offline answer." | The live model failed, so Ask answered with its offline router. |
| The palette reads "Offline answers · sign in to the Claude CLI for open questions" | There is no live provider, so Ask answers common questions offline. Sign in to the Claude CLI or set `ANTHROPIC_API_KEY` for open questions. |

## FAQ

### Do I need keys or a PayPal account?

No. With nothing configured, Exhibit runs on its PayPal simulator, which has the real API's request and response shapes, error codes and file limits, and the agent uses your Claude CLI login or recorded runs. See the [Quickstart](/docs/quickstart).

### Can I use my live PayPal account?

Not yet. Exhibit's PayPal client only calls the sandbox, `https://api-m.sandbox.paypal.com`.

### Does Exhibit act without me?

Only if you switch on [Autopilot](/docs/autopilot), and only for cases inside your rules and its hard limits: never above $1,000, never a fight below 60% win likelihood, never a low-confidence brief. Autopilot is off by default.

### Can an AI agent move money through Exhibit?

Not through the MCP server. Its tools can investigate and ask, and every request waits for your approval in the app. See [MCP server](/docs/mcp).

### Where is my data?

In SQLite files on the machine running Exhibit: `exhibit-demo.db` and `exhibit-sandbox.db` in `.data/`, or in `EXHIBIT_DATA_DIR`. Credentials stay in your environment and are never written there. See [Security model](/docs/security-model#data).

### Which model runs, and what does a case use?

`claude-opus-5-5` by default; set `EXHIBIT_MODEL` to change it. In the evaluation, a case took a median of 29 seconds, about 28k input tokens (most of them cache reads) and 2.5k output tokens.

### Does it connect to my store or carrier?

Not yet. Order, carrier, inbox and checkout records come from the built-in demo store, in sandbox mode too.

### Does the evaluation prove Exhibit is accurate?

No. The 30 cases are synthetic and the builders wrote them and their labels. The result shows that Exhibit applies its rules consistently, not how often it is right on real disputes. See [Testing and evaluation](/docs/testing-and-evaluation#evaluation).

### Is Exhibit a PayPal product?

No. Exhibit is an independent, open-source project, not affiliated with or endorsed by PayPal. Kora Atelier, the demo merchant, is fictional.
