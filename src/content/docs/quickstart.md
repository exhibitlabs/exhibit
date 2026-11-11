---
title: Quickstart
description: Run Exhibit on your machine in two minutes. No keys, no PayPal account: demo mode runs on a PayPal simulator.
section: Get started
order: 2
---

Exhibit is a Next.js app. You need Node.js 24 or newer and git. Nothing else is required: with no keys set, Exhibit runs every PayPal call against its built-in simulator, and the agent runs on your Claude CLI login or replays recorded runs.

To look around without installing anything, open the [hosted demo](https://app.exhibit.9to5code.com/app). It runs demo mode on recorded runs.

## Run it

:::steps
### Clone the repository

```bash
git clone https://github.com/exhibitlabs/exhibit.git
cd exhibit
```

### Install dependencies

```bash
npm install
```

### Start the dev server

```bash
npm run dev
```

The server starts on port 3000 with hot reload.

### Open the app

Open `http://localhost:3000/app`. The first visit seeds the demo merchant: eight open disputes, recent orders to watch and a 90-day history.
:::

> [!TIP]
> The marketing site is at `/`, the public record of the live sandbox run at `/proof`, the pitch deck at `/pitch` and these docs at `/docs`.

## Demo mode {#demo-mode}

With no PayPal credentials, Exhibit is in demo mode. Its PayPal client sends every request to a simulator that runs in the same process. The client code is the one that made the calls on the live sandbox; only the transport changes.

The simulator follows PayPal's Disputes v1, Orders v2 and Payments v2 shapes for the endpoints Exhibit uses. It returns PayPal's error format and codes, enforces the file rules (PDF, PNG, JPEG or GIF, 10 MB per file, 50 MB per call), accepts only the evidence types a dispute requested, and offers each action only in the dispute states where PayPal offers it. See [PayPal integration](/docs/paypal-integration) for the details.

The demo merchant is Kora Atelier, a fictional leather goods studio in Brooklyn. Its orders, buyers, carrier scans and messages are made up, and the app labels them as demo data. The banner at the top of the app says which PayPal and which AI you are on, and **What's real?** lists what is real, simulated or recorded.

Demo state is shared by everyone using the same server, and it resets itself after 20 quiet minutes. **Reset demo** in the **What's real?** dialog resets it now. To run against your own PayPal sandbox instead, follow the [Sandbox guide](/docs/sandbox).

## How the agent picks its provider {#providers}

The case agent and Ask Exhibit run on Claude. Exhibit takes the first option that works:

| Order | When | What runs |
|---|---|---|
| 1 | `EXHIBIT_AI_PROVIDER` is `anthropic`, `claude-code` or `replay` | That provider, no questions asked. |
| 2 | `ANTHROPIC_API_KEY` (or `ANTHROPIC_AUTH_TOKEN`) is set | The Claude API, through the Anthropic SDK. |
| 3 | You are signed in to the Claude CLI on this machine | The Claude CLI, through the Claude Agent SDK. No API key needed. |
| 4 | None of the above | Recorded runs from `replays/`. |

On a recorded run the reasoning text is a recording, but every tool call still runs live against the case, and the recorded brief has to pass the same checks as a live one. All eight demo cases have a recording. The model is `claude-opus-5-5` unless you set `EXHIBIT_MODEL`.

Exhibit counts a `~/.claude` folder as a Claude CLI login. If the CLI cannot start when a run begins, a case with a recording falls back to it, and the run's trace says so.

To use the Claude API, put the key in `.env.local` and restart:

```bash
cp .env.example .env.local
```

```env title=".env.local"
ANTHROPIC_API_KEY=your-anthropic-api-key
```

`EXHIBIT_ALLOW_CLAUDE_CODE=0` ignores the CLI login, so you get recorded runs without a key. Every variable is listed in [Configuration](/docs/configuration#ai-provider).

## A two-minute tour {#tour}

The demo guide walks the same path and ticks each step off when the real work behind it happens. It is the strip at the top of the overview (**Hide guide** removes it, and an **Undo** brings it back) and the **Guide** button in the top bar, which shows your progress as `n/6`.

:::steps
### Run Exhibit on a case

Open **Disputes**, pick **Megan Hale**, an item-not-received claim, and press **Run Exhibit**. The evidence graph lights up each source as the agent reads it: the PayPal dispute, the order, UPS tracking, the buyer's history and messages, and PayPal's Seller Protection rules. Then it wires the records it cites to the decision.

### Read the brief and the evidence

The brief gives the call (fight, offer, refund or message the buyer), a win likelihood, the reasoning with the records each point rests on, and the response letter to PayPal's reviewer. The **Evidence packet** tab shows the PDF of lettered exhibits that goes with the letter. [How Exhibit decides](/docs/how-exhibit-decides) explains each part.

### File with PayPal

File the response. Exhibit re-reads the dispute, calls the action PayPal allows right now (here `provide-evidence`, with the packet attached) and logs the request and response. The case page's simulator controls stand in for PayPal's reviewer, so you can rule on the case.

### Prevent a dispute

Open **Prevention**. Lena Hoffmann's parcel is stuck in customs and she has written, in German, that she will open a PayPal dispute. Send the drafted German reply before she does. See [Prevention](/docs/prevention).

### Ask a question

Press ⌘K (Ctrl+K on Windows and Linux), or click the search bar at the top of the app, and ask about the whole dispute book, for example "Which disputes need me today?". Answers come from read-only tools over your records. See [Ask Exhibit](/docs/ask-exhibit).

### Approve an agent request

Open **Agent requests** and send a request as a demo agent. It is what an outside AI agent does over MCP: it can ask, but nothing runs until you approve. See [MCP server](/docs/mcp).
:::

**PayPal activity** then shows every API call the tour made, with its request, response, status, latency and debug id.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the dev server on port 3000. |
| `npm run build` | Builds the app for production with `next build`. |
| `npm start` | Serves the production build. |
| `npm test` | Runs the test suite with Vitest. It needs no keys, network or Claude login. |
| `npm run lint` | Runs ESLint. |
| `npm run typecheck` | Runs `tsc --noEmit`. |
| `npm run mcp` | Starts the MCP server over stdio. Exhibit must be running. |
| `npm run mcp:smoke` | Calls every MCP tool against a running demo-mode server. |

## Next steps

:::cards
- [Sandbox guide](/docs/sandbox): Connect your own PayPal sandbox and open real chargebacks.
- [How Exhibit decides](/docs/how-exhibit-decides): The investigation, the tools, the brief and its checks.
- [MCP server](/docs/mcp): Give Claude Desktop or Claude Code Exhibit's nine tools.
- [Configuration](/docs/configuration): Every environment variable, with defaults.
:::
