# Security policy

Exhibit works with money and with customers, so a way around its guardrails is a security bug, not a quirk.

## Reporting a vulnerability

Please do not open a public issue with the details.

1. Preferred: use GitHub's private vulnerability reporting. On the repository, open the **Security** tab and choose **Report a vulnerability** (https://github.com/shvuuuu/exhibit/security/advisories/new).
2. If that page is not available, open an issue titled **Security contact request** that says nothing about the problem itself. The maintainer will reply with a private way to send it.

Include what you did, what you expected, what happened, and the commit you tested. A report that reproduces in demo mode (no credentials) is the easiest to confirm. The maintainer reads every report and aims to reply within a few days. Exhibit is a hackathon project at version 0.1, so only `main` is supported.

## What Exhibit promises

These are the guardrails to try to break. Each one has automated tests in [`tests/`](tests).

- **An AI agent can ask, never do.** The MCP server can investigate disputes and request an action. A request only creates a pending approval and executes nothing. The merchant approves in the Exhibit app, which accepts the decision only from a same-origin browser request. No MCP tool reaches that route, or any route that files, refunds or messages.
- **Approval is pinned to the brief.** If the case is re-investigated after an agent asks, the request expires instead of filing something the merchant never saw.
- **The model cannot invent evidence.** Every exhibit and every reasoning point must cite a ref returned by a tool (`order:`, `shipment:`, `msg:` and so on). A brief is rejected unless each ref resolves to a record on that case, and the evidence packet re-reads those records from source.
- **Only actions PayPal allows right now.** A brief is rejected if its action is not among the dispute's current HATEOAS links, or if its offer type or amount is outside what the dispute allows.
- **Autopilot stays inside explicit limits.** It is off by default, sends low-confidence briefs to a person, has hard limits that no saved setting can raise, and never acts on a run started by an external agent.
- **The agent can look, not touch.** Its tools only read. On the Claude CLI it gets Exhibit's tools and nothing else: no shell, no file access, no other MCP servers, no user settings.
- **Ask Exhibit is read-only and grounded.** It cannot change anything, and it rejects answers that cite a dispute or order that does not exist or chart a number no tool returned.
- **Demo mode never calls PayPal.** Without credentials, or with `EXHIBIT_PAYPAL_MODE=demo`, every PayPal call goes to an in-process simulator.

## Scope

In scope: executing or approving an action without the merchant, evidence or citations the model could forge, actions outside the allowed set or Autopilot's limits, leaked credentials, and prompt injection through a buyer message or tool result that leads to an action.

Out of scope: the demo merchant's fictional data, differences between the simulator and PayPal's real API, and vulnerabilities in dependencies (please report those upstream).

Exhibit is a single-merchant app with no sign-in yet. Do not expose a deployment to the internet with live PayPal credentials until authentication sits in front of it.

## Never commit keys

- Put credentials in `.env.local`. Every `.env*` file except `.env.example` is git-ignored, and nothing needs a key to run, test or build.
- The tests run with no secrets and refuse outbound network calls, and CI needs no secrets either.
- If a PayPal client secret, webhook ID or Anthropic key is ever committed, rotate it immediately and then remove it from history. Deleting the file in a later commit does not remove it.
