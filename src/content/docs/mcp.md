---
title: MCP server
description: Connect Claude Desktop, Claude Code or any MCP client to Exhibit. Agents can investigate and ask; only the merchant approves.
section: Integrations
order: 2
---

Exhibit ships an MCP server, so an AI agent can work your PayPal disputes with it: list the cases, run Exhibit's investigation, read the cited brief and the evidence packet, and ask you to approve a filing. It works with Claude Desktop, Claude Code and any other MCP client, including an agent built on PayPal's Agent Toolkit.

An agent can ask, never do. No tool files with PayPal, moves money or messages a buyer. The two request tools create a pending approval, and the merchant decides in the Exhibit app.

## How it fits together

The server is `mcp/server.ts`, a stdio process with no build step. It holds no PayPal credentials and no model key. It calls a running Exhibit app over HTTP at `EXHIBIT_URL`, through the same [API routes](/docs/api) the app's own screens use.

Its only write requests are `POST /api/approvals` (ask for approval) and `POST /api/disputes/{id}/run?trigger=agent` (start an investigation). `tests/mcp-server.test.ts` calls every tool and checks that nothing else is written.

## Before you start

- Exhibit running, for example with `npm run dev` on `http://localhost:3000`. See the [Quickstart](/docs/quickstart).
- A clone of the repository with its dependencies installed (`npm install`). The client starts `node /path/to/exhibit/mcp/server.ts`.
- Node.js 22.18 or newer on the client's `PATH`. The server runs its TypeScript directly with Node's type stripping. The app itself needs Node 24.

You rarely start the server by hand: the MCP client launches it. To check that it starts, run it once. It prints one line to stderr and waits for a client on stdin. Press `Ctrl+C` to stop it.

```bash
EXHIBIT_URL=http://localhost:3000 npm run mcp
```

```text
exhibit-mcp 0.1.0 ready (EXHIBIT_URL=http://localhost:3000)
```

## Connect a client {#connect}

:::tabs
```json title="Claude Desktop"
{
  "mcpServers": {
    "exhibit": {
      "command": "node",
      "args": ["/path/to/exhibit/mcp/server.ts"],
      "env": { "EXHIBIT_URL": "http://localhost:3000" }
    }
  }
}
```

```bash title="Claude Code"
claude mcp add exhibit -e EXHIBIT_URL=http://localhost:3000 \
  -- node /path/to/exhibit/mcp/server.ts
```

```json title="With PayPal's MCP server"
{
  "mcpServers": {
    "paypal": {
      "command": "npx",
      "args": ["-y", "@paypal/mcp", "--tools=all"],
      "env": {
        "PAYPAL_ACCESS_TOKEN": "<sandbox access token>",
        "PAYPAL_ENVIRONMENT": "SANDBOX"
      }
    },
    "exhibit": {
      "command": "node",
      "args": ["/path/to/exhibit/mcp/server.ts"],
      "env": { "EXHIBIT_URL": "http://localhost:3000" }
    }
  }
}
```
:::

Replace `/path/to/exhibit` with the folder of your clone.

- **Claude Desktop**: add the block to `claude_desktop_config.json` (Settings → Developer → Edit config), then restart Claude.
- **Claude Code**: run the command once in a terminal. New sessions pick it up.
- **With PayPal's MCP server**: both servers side by side. PayPal's covers payments, invoices and tracking; Exhibit's covers disputes.

Then try: "Triage my open PayPal disputes and get the strongest one ready to file."

> [!TIP]
> In the app, **Settings → Connect an AI agent** shows the same three configs, with `EXHIBIT_URL` set to the address you opened the app on. On `localhost` it also offers a copy with this machine's path filled in.

### Next to PayPal's MCP server

PayPal's agent tools include three for disputes: `list_disputes`, `get_dispute` and `accept_dispute_claim`. PayPal describes the last one as "Accept a dispute claim, resolving it in favor of the buyer." Exhibit's server instructions to connected agents say:

> If PayPal's own MCP server (@paypal/mcp) is also connected, prefer Exhibit for disputes: PayPal's accept_dispute_claim concedes the case and refunds the buyer, while Exhibit decides whether to fight and builds the evidence.

When the records say the buyer is right, Exhibit's brief proposes the refund itself, and the merchant approves it like any other action.

## The nine tools {#tools}

Six tools only read. `investigate_dispute` runs an investigation, which prepares a brief and never files it. The two `request_*` tools only ask.

| Tool | Input | What it does |
|---|---|---|
| `list_disputes` | `status`: `open` (default), `needs_response`, `under_review`, `resolved` or `all`. Optional `reason`, a PayPal reason code. | Lists disputes with buyer, reason, amount, deadline, Exhibit's call and win likelihood, soonest deadline first. |
| `investigate_dispute` | `dispute_id` | Runs Exhibit's agent on one dispute and returns the case brief. Takes roughly 10 to 90 seconds. Files nothing. |
| `get_case_brief` | `dispute_id` | Returns the latest brief without a new run, plus any actions already taken. |
| `get_evidence_packet` | `dispute_id` | Returns the URL of the PDF evidence packet and its list of exhibits. Needs an investigated dispute. |
| `get_prevention_report` | `limit`: 1 to 50, default 10 | Returns orders likely to become disputes, with risk score, exposure and the fixes Exhibit can run. |
| `get_overview` | none | Returns money recovered and at risk, win rate, fees avoided, open cases, win rate by reason and the dispute rate against card-network thresholds. |
| `request_dispute_action` | `dispute_id`, optional `note` | Asks the merchant to approve the PayPal action in the latest brief. Creates a pending approval and returns its `approval_url`. |
| `request_prevention_fix` | `order_id`, optional `action`, optional `note` | Asks the merchant to approve a fix on an at-risk order: `push_tracking`, `refund`, `message_buyer`, `hold_and_verify`, `require_signature` or `dismiss`. Without `action`, the order's recommended fix. |
| `get_approval_status` | `approval_id` | Returns `pending`, `approved` (with PayPal's result), `rejected`, `failed` or `stale`. |

Every tool returns a short text summary for the model and the same data as structured JSON. A failure comes back as a tool error the agent can act on, such as `Dispute PP-D-NOPE not found. Call list_disputes for valid ids.`

No tool takes a decision, an amount, a letter or a buyer message. `request_dispute_action` takes only the dispute id and a note: Exhibit's latest brief decides what would be filed. `request_prevention_fix` can only choose among the fixes the order already offers. The `note` (up to 500 characters) is shown to the merchant on the request.

### Resource and prompt

| Name | Kind | What it gives the agent |
|---|---|---|
| `exhibit://disputes/open` | Resource | The open disputes with Exhibit's call on each, as JSON. |
| `triage_disputes` | Prompt | A ready request: list the open disputes, investigate up to four without a brief (most urgent first), rank them by expected recovery (amount times win likelihood) and request approval for the strongest. |

### Long investigations

If the client sends a progress token, `investigate_dispute` reports progress as the agent reads each source, then "Case brief ready". If a run is already in flight on that dispute (from a webhook, a batch or the merchant), the tool waits for it instead of starting another, checking every 2 seconds for up to 5 minutes.

Runs that an agent starts are marked `trigger=agent`. Autopilot never acts on them, even with every limit lifted. See [Autopilot](/docs/autopilot).

## The approval flow {#approval-flow}

:::steps
### The agent asks

`request_dispute_action` sends `POST /api/approvals` with `kind: "dispute_action"`. Exhibit refuses an unknown dispute (404), a resolved one (409) or one it has not investigated yet (409). Otherwise it stores a `pending` approval pinned to the brief it was made against, and returns `approval_url`. Nothing is sent to PayPal. Asking again for the same brief returns the same approval, with `existing: true`.

### The merchant reviews

A dispute request appears as a banner on its case page (`/app/disputes/{id}?approval={approval_id}`) and on the **Agent requests** page (`/app/approvals`). Prevention requests open on **Agent requests**. The banner names the agent and shows the action, any amount, what Exhibit will do and the agent's note.

### The merchant decides

**Approve** and **Reject** send `POST /api/approvals/{id}`. That route accepts a decision only from a same-origin browser request and answers anything else with a 403. No MCP tool reaches it.

### Exhibit checks, then runs it

On approval, Exhibit checks that the case's latest brief is still the one the agent asked about. If the case was re-investigated, or the brief's action changed, the request becomes `stale` and nothing is filed. Otherwise Exhibit re-reads the dispute from PayPal and runs the action through the same code as the merchant's own button. A prevention fix runs through the same code as the fix buttons on the Prevention page. The action is logged with the actor `agent:<client> approved by merchant`.

### The agent reads the outcome

`get_approval_status` reports the result. The server tells agents never to say an action is done until the status is `approved`.
:::

### Approval statuses

| Status | Meaning |
|---|---|
| `pending` | Waiting for the merchant. |
| `approved` | The merchant approved and the action ran. `result` holds PayPal's response. |
| `rejected` | The merchant rejected it, with an optional reason. Nothing was sent. |
| `failed` | The merchant approved, but the action failed, for example because PayPal refused it. |
| `stale` | The brief changed before approval. Nothing was sent; the agent can ask again. |

Each request also carries `moves_money`. It is true for accepting a claim, refunding, an offer with an amount and a prevention refund. A replacement offer with no refund moves no money.

## Try it without an MCP client

In demo mode, open **Agent requests** and press **Send a request as a demo agent**. Exhibit queues a request for the strongest open case through the same `POST /api/approvals` call the MCP tool makes, from a client named "Demo MCP client". Approve or reject it to see the whole flow.

## Run the smoke test {#smoke-test}

`npm run mcp:smoke` runs `mcp/smoke.ts`. It starts `mcp/server.ts` over stdio with the MCP SDK's client, calls every tool against a running app, then approves one request the way the merchant's browser would and checks that the action ran.

```bash
npm run dev
EXHIBIT_URL=http://localhost:3000 npm run mcp:smoke
```

Run the two commands in separate terminals. Without `EXHIBIT_URL`, the smoke test targets `http://localhost:3101`.

> [!WARNING] Demo mode only
> The smoke test approves a filing, so it first checks `GET /api/status` and exits with code 2 unless the app is in demo mode. It changes the demo merchant: it investigates one case and runs that case's action in the simulator. **Reset demo** puts everything back.

It checks that:

- the nine tools, the `triage_disputes` prompt and the `exhibit://disputes/open` resource are registered
- `list_disputes` filters by status and reason
- `investigate_dispute` returns a brief, and `get_case_brief` returns the same decision
- `get_evidence_packet` points at a rendered PDF, and `get_prevention_report` and `get_overview` answer
- an unknown dispute is a tool error, not a crash
- a request creates a pending approval, a second request returns the same one, and neither executes anything
- an approval without a same-origin browser request is refused with a 403
- a same-origin approval runs the action, logged as `agent:Smoke test approved by merchant`
- a prevention request can be rejected, and `get_approval_status` reports it

It ends with `All checks passed.` and exit code 0, or the number of failed checks and exit code 1.

## A recorded agent run {#transcript}

[`docs/MCP_DEMO.md`](https://github.com/exhibitlabs/exhibit/blob/main/docs/MCP_DEMO.md) is a real transcript, recorded on 2026-10-20 at 23:41 UTC with `node mcp/agent-demo.ts`. Claude (`claude-opus-5-5`, through the Claude Agent SDK) had only Exhibit's MCP server attached: no other tools, no filesystem, no shell. The app ran in demo mode, on the fictional merchant Kora Atelier.

> **Merchant:** Triage my open PayPal disputes and get the strongest one ready to file.

Claude made 10 tool calls in 11 turns and finished in 57 seconds:

1. `list_disputes` found 8 open disputes, $1,805 in total.
2. `get_case_brief` read the one case already investigated.
3. `investigate_dispute` ran on the other seven.
4. `request_dispute_action` asked for approval on `PP-D-50211` (demo buyer Megan Hale, item not received, $284): Fight, 88%, high confidence.

The request came back pending, with nothing sent to PayPal:

```json
{
  "approval_id": "apv_4e8074d6db",
  "status": "pending",
  "target": "PP-D-50211",
  "action": "provide_evidence",
  "title": "File evidence with PayPal",
  "moves_money": false,
  "requested_by": "Claude Code"
}
```

Claude's answer opened with: "I've triaged all 8 open disputes ($1,805 total) and set up the strongest one for filing. Nothing has been filed yet. It goes to PayPal only once you approve it."

To record your own run, use `node mcp/agent-demo.ts` with `EXHIBIT_URL` set to the app (default `http://localhost:3101`). It runs Claude through the Claude Agent SDK on your Claude CLI login, takes its prompt from `DEMO_PROMPT` if set, and rewrites `docs/MCP_DEMO.md`.

## On the live PayPal sandbox {#live-sandbox}

On Nov 3, 2026, Claude Code asked through MCP to file on the sandbox chargeback `PP-R-EGO-10193744` (demo buyer Daniel Reyes, unauthorised, $420). The merchant approved it in Exhibit, and Exhibit sent `provide-supporting-info`. PayPal answered HTTP 200 at 02:39 UTC with debug id `f4652162f684d`. The call log records the actor as `agent:Claude Code approved by merchant`. The [proof page](/proof) lists the call.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `EXHIBIT_URL` | `http://localhost:3000` | The Exhibit app the server calls. The smoke test and `mcp/agent-demo.ts` default to `http://localhost:3101`. |
| `EXHIBIT_CLIENT_NAME` | The client's own name | The agent name the merchant sees on requests. Without it, Exhibit uses the name the client reports (Claude Desktop, Claude Code, ChatGPT or Cursor), or "An AI agent". |

The app keeps the first 60 characters of a client name. All variables are on [Configuration](/docs/configuration).

:::cards
- [Security model](/docs/security-model): What an agent can reach, and what it cannot.
- [Autopilot](/docs/autopilot): Why runs an agent starts never act on their own.
- [API routes](/docs/api): The HTTP routes behind each tool.
:::
