---
title: Configuration
description: Every environment variable Exhibit reads, with defaults, and how it picks the PayPal mode and the AI provider.
section: Reference
order: 1
---

Everything is optional. With nothing set, Exhibit runs on its PayPal simulator and picks an AI provider on its own. To change that, copy the template to `.env.local`, set what you need and restart the server.

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored, like every `.env*` file except `.env.example`.

## PayPal mode {#paypal-mode}

| Mode | When | PayPal calls go to |
|---|---|---|
| `demo` | `PAYPAL_CLIENT_ID` or `PAYPAL_CLIENT_SECRET` is missing, or `EXHIBIT_PAYPAL_MODE=demo` | The in-process simulator. Nothing leaves your machine. |
| `sandbox` | Both `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are set | `https://api-m.sandbox.paypal.com` |

`EXHIBIT_PAYPAL_MODE=demo` wins over credentials. `demo` is the only value that has an effect: sandbox mode always needs both credentials. There is no live PayPal mode yet.

Each mode keeps its own SQLite file, `exhibit-demo.db` or `exhibit-sandbox.db`, so switching modes never mixes demo data with sandbox data.

## AI provider {#ai-provider}

The case agent picks its provider in this order:

1. `EXHIBIT_AI_PROVIDER` set to `anthropic`, `claude-code` or `replay` forces that provider. Any other value is ignored.
2. `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` is set: `anthropic`, the Claude API through the Anthropic SDK.
3. A Claude CLI login on this machine: `claude-code`, the Claude CLI through the Claude Agent SDK. Exhibit counts a `~/.claude` folder as a login. `EXHIBIT_ALLOW_CLAUDE_CODE=0` ignores it, and `EXHIBIT_ALLOW_CLAUDE_CODE=1` uses the CLI even without the folder.
4. Otherwise `replay`: recorded runs from `replays/`. The recorded reasoning is replayed, every tool call runs live against the case, and the brief must pass the same validation as a live one.

If the Claude CLI fails to start before the first tool call, a case that has a recorded run falls back to it, and the trace says so: "The Claude CLI isn't available on this machine, so this is a recorded run."

Ask Exhibit uses the same provider, with two differences. `replay` becomes offline answers, and `EXHIBIT_ASK_PROVIDER=offline` forces offline answers whatever the agent uses. When a live answer fails, Ask answers offline if the question allows it.

### Check the current setup

`GET /api/status` reports the mode, the provider and the model:

```json
{
  "paypalMode": "sandbox",
  "aiProvider": "claude-code",
  "model": "claude-opus-5-5",
  "paypalOk": null,
  "paypalError": null
}
```

`GET /api/status?check=1` also tests PayPal: it fetches an OAuth token and lists one dispute, then fills `paypalOk` and `paypalError`. **Settings → Test connection** runs the same check.

## Variables {#variables}

### PayPal

| Variable | Default | What it does |
|---|---|---|
| `PAYPAL_CLIENT_ID` | none | The client id of a sandbox REST app (developer.paypal.com, Apps & Credentials, Sandbox). With the secret, switches Exhibit to sandbox mode. |
| `PAYPAL_CLIENT_SECRET` | none | The sandbox app's secret. |
| `PAYPAL_WEBHOOK_ID` | none | The webhook id from the sandbox app's webhooks. In sandbox mode the webhook listener needs it to verify signatures, and answers 500 without it. |
| `EXHIBIT_PAYPAL_MODE` | unset | `demo` keeps Exhibit on the simulator even when credentials are set. |

### AI

| Variable | Default | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Runs the agent and Ask Exhibit on the Claude API. Takes precedence over a Claude CLI login. |
| `ANTHROPIC_AUTH_TOKEN` | none | Also selects the Claude API. The Anthropic SDK sends it as a bearer token. |
| `EXHIBIT_AI_PROVIDER` | automatic | Forces `anthropic`, `claude-code` or `replay`. |
| `EXHIBIT_ALLOW_CLAUDE_CODE` | automatic | `0` ignores the local Claude CLI login. `1` uses the CLI even without a `~/.claude` folder. |
| `EXHIBIT_MODEL` | `claude-opus-5-5` | The case agent's model, on the Claude API and the Claude CLI. |
| `EXHIBIT_ASK_MODEL` | the value of `EXHIBIT_MODEL` | Ask Exhibit's model, if you want a different one for quick questions. |
| `EXHIBIT_ASK_PROVIDER` | follows the agent | `offline` forces offline answers in Ask Exhibit. |

### App

| Variable | Default | What it does |
|---|---|---|
| `EXHIBIT_APP_URL` | `http://localhost:3000` | The app's public URL. Sandbox seeding uses it for the PayPal checkout return and cancel links (`/app/settings?seed=approved` and `?seed=cancelled`). Settings shows it under **Webhooks** when it differs from the address you opened the app on. |
| `EXHIBIT_DATA_DIR` | `.data` in the working folder | Where the SQLite files go. |
| `EXHIBIT_DIST_DIR` | `.next` | The Next.js build folder, so a second dev server can run beside the first. |
| `EXHIBIT_APP_HOST_ONLY` | unset | `1` builds a host that serves the app alone, like the hosted demo (`render.yaml`): `/` redirects to `/app`, and the site's paintings are served as they are. `next build` reads it. |
| `EXHIBIT_RECORD_REPLAYS` | unset | Development: `1` saves each live run on a demo case to `replays/`, to refresh the recorded runs. |

### MCP server and scripts

| Variable | Default | What it does |
|---|---|---|
| `EXHIBIT_URL` | `http://localhost:3000` | The app the MCP server calls. `mcp/smoke.ts` and `mcp/agent-demo.ts` default to `http://localhost:3101`. |
| `EXHIBIT_CLIENT_NAME` | the client's own name | The agent name the merchant sees on approval requests. |
| `DEMO_PROMPT` | "Triage my open PayPal disputes and get the strongest one ready to file." | The merchant's request in `mcp/agent-demo.ts`. |

> [!NOTE]
> The tests, CI and the evaluation pin their own environment. The test setup forces demo mode, recorded runs, offline Ask answers and a temporary data folder, and clears every credential. CI sets `EXHIBIT_PAYPAL_MODE=demo`, `EXHIBIT_AI_PROVIDER=replay` and `NEXT_TELEMETRY_DISABLED=1`. See [Testing and evaluation](/docs/testing-and-evaluation).

## Example setups {#examples}

:::tabs
```env title="Your PayPal sandbox"
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-client-secret
PAYPAL_WEBHOOK_ID=your-sandbox-webhook-id
```

```env title="Claude API"
ANTHROPIC_API_KEY=your-anthropic-api-key
EXHIBIT_MODEL=claude-opus-5-5
```

```env title="Recorded runs only"
EXHIBIT_AI_PROVIDER=replay
EXHIBIT_PAYPAL_MODE=demo
```
:::

With no file at all, you get demo mode and the Claude CLI if you are signed in, otherwise recorded runs. The [Sandbox guide](/docs/sandbox) walks through the PayPal side.

### Two servers side by side

You can run your sandbox and the demo at the same time. Each server needs its own build folder and port; each mode already has its own database file.

```bash
npx next dev -p 3100
```

```bash
EXHIBIT_DIST_DIR=.next-demo EXHIBIT_PAYPAL_MODE=demo EXHIBIT_AI_PROVIDER=replay \
  npx next dev -p 3101
```

The first server reads `.env.local`, so with sandbox credentials there it runs in sandbox mode. The second is pinned to demo mode and recorded runs. On any port other than 3000, set `EXHIBIT_APP_URL` to the address so that sandbox seeding returns from PayPal checkout to the right place.

## Secrets {#secrets}

`PAYPAL_CLIENT_SECRET`, `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are secrets. Treat `PAYPAL_CLIENT_ID` and `PAYPAL_WEBHOOK_ID` as private too. Exhibit reads them from the environment and never writes them to its database or its call log. If one is ever committed, rotate it first, then remove it from the git history. See [Security model](/docs/security-model#credentials).
