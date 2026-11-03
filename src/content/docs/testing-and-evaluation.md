---
title: Testing and evaluation
description: The 300 tests behind Exhibit's guarantees, the CI that runs them, and how the agent's decisions were evaluated, with the caveat.
section: Trust
order: 2
---

Exhibit has 300 automated tests in 16 files, organised around the guarantees it makes rather than around its source files. They need no credentials, no network and no Claude login. A separate evaluation ran the real agent on 30 labelled disputes; read its caveat before its numbers.

## Run the tests

```bash
npm test            # 300 tests with Vitest
npm run test:watch  # re-run on every change
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run build       # next build
```

To run one file:

```bash
npx vitest run tests/autopilot.test.ts
```

## Hermetic by design {#hermetic}

`tests/support/setup.ts` runs before every test file and pins the environment instead of trusting the machine:

- It clears the credentials (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`) and `EXHIBIT_MODEL`, `EXHIBIT_ASK_MODEL`, `EXHIBIT_APP_URL`, `EXHIBIT_RECORD_REPLAYS` and `EXHIBIT_URL`.
- It forces `EXHIBIT_PAYPAL_MODE=demo` (the simulator), `EXHIBIT_AI_PROVIDER=replay` (never the Claude CLI or the Claude API), `EXHIBIT_ASK_PROVIDER=offline` and `EXHIBIT_ALLOW_CLAUDE_CODE=0`.
- Each test file gets its own temporary data folder, deleted when the file finishes.
- It replaces `fetch` so that only loopback addresses are reachable. A test that tries to reach PayPal, or anything else, fails with "Tests must not use the network".

## What the tests cover {#coverage}

| File | Tests | What it checks |
|---|---:|---|
| `simulator` | 48 | The simulator keeps PayPal's contract: OAuth and error shapes, the actions open in each state, evidence rules (requested types, `item_id`, 2,000-character notes, PDF, PNG, JPEG or GIF only, 10 MB per file and 50 MB per call), the dispute lifecycle, and the Orders and Payments endpoints. |
| `prevention` | 27 | Which orders the radar watches, all seven signals, scoring and exposure, and each fix. |
| `approvals` | 26 | A request executes nothing, flags money movement, is pinned to its brief, expires when the brief changes, runs once on approval and records who asked and who decided. |
| `autopilot` | 26 | Off by default, low confidence always to a person, each rule's inclusive limits, the hard limits, the match between decision and action, saved settings and the settings endpoint. |
| `playbook` | 26 | Seller Protection checks against PayPal's published US rules for each claim type, address matching, and a playbook that recommends only evidence types PayPal accepts and does not fight what it cannot win. |
| `action-guardrail` | 22 | A brief's action must be one the dispute allows now, in every state. Offer types and amounts. The brief schema refuses values the model should never send. |
| `approvals-api` | 19 | Only a same-origin browser request can decide an approval, and an agent can only create and read requests. |
| `filing` | 18 | Filings call PayPal correctly: requested evidence types, tracking from the carrier record, supporting info under review, refunds, offers, messages, PayPal's errors, and an evidence packet built from source records. |
| `ask-grounding` | 17 | Ask Exhibit sends back chart values and ids no tool returned, its tools change nothing, and six offline answers work. |
| `citation-guardrail` | 15 | Every ref resolves to a stored record on the same case. A brief with an invented ref goes back to the model and nothing is filed. |
| `api-bad-input` | 13 | Unknown dispute ids, malformed batch bodies and malformed webhooks get a 404 or 400 and start nothing. |
| `agent-run` | 12 | A run stores its brief and trace, lets Autopilot act only on manual, webhook and batch runs, never on agent or seed runs, and never overlaps another run on the same dispute. |
| `config` | 12 | The test environment itself, the PayPal mode, the AI provider order and the data folder. |
| `mcp-server` | 9 | The MCP tools are an allow-list, the request tools cannot choose the action or the amount, the only writes are requests and investigations, and agent runs never trigger Autopilot. |
| `agent-tools` | 7 | The agent has eight lookups and the brief filer, a full investigation changes nothing, bad input is refused, and on the Claude CLI the agent and Ask Exhibit get only their own tools. |
| `replays` | 3 | Recorded runs replay on every demo case and pass validation. |

The [Security model](/docs/security-model#guarantees) maps each guarantee to these files.

## Continuous integration {#ci}

[`.github/workflows/ci.yml`](https://github.com/exhibitlabs/exhibit/blob/main/.github/workflows/ci.yml) runs on every push and pull request to `main`:

| Step | Command |
|---|---|
| Install | `npm ci` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Test | `npm test` |
| Build | `npm run build` |

It is one job on `ubuntu-latest`, with Node from `.nvmrc` (24), a 20-minute timeout and read-only repository permissions. It uses no secrets: it sets `EXHIBIT_PAYPAL_MODE=demo`, `EXHIBIT_AI_PROVIDER=replay` and `NEXT_TELEMETRY_DISABLED=1`. A newer push to the same branch cancels the run in progress.

Two more checks run by hand: `npm run mcp:smoke` drives the MCP server against a demo-mode app (see [MCP server](/docs/mcp#smoke-test)), and `node eval/run.ts --check` seeds the evaluation cases and runs every lookup tool with no model calls.

## Evaluation {#evaluation}

> [!IMPORTANT] Read this first
> The 30 cases are synthetic. The builders wrote the cases and their labels, with Claude, the same model family as the agent. A perfect score here shows that Exhibit applies its rules consistently. It does not measure accuracy on real disputes.

### Method

- **Cases:** 30 synthetic PayPal disputes for the demo merchant, across seven reasons and three stages: inquiry, chargeback, and chargeback under PayPal review.
- **Labels:** each is the decision a careful payments-operations lead should take: `FIGHT`, `OFFER`, `REFUND` or `MESSAGE_BUYER`. The rules in [`eval/LABELING.md`](https://github.com/exhibitlabs/exhibit/blob/main/eval/LABELING.md) came first; every label was written before Exhibit ran on anything.
- **Frozen before the run:** the SHA-256 of every case's id, label and rationale (`96a8f744c95636ef…`) is recorded. `node eval/run.ts --check` prints the current digest and says whether it still matches.
- **One live run per case** on Nov 3, 2026, from 00:28 to 00:36 UTC: Claude Opus 5.5 on the Claude CLI, through `runAgent`, the Run button's code path, with the production prompt, tools, brief schema and validation. Two cases ran at a time.
- **Nothing executed:** Autopilot was off and PayPal was the in-process simulator.

### Results

| Measure | Result | 95% interval |
|---|---|---|
| Exact decision agreement | 30/30 (100%) | 89% to 100% |
| Fight versus don't-fight agreement | 30/30 (100%) | 89% to 100% |
| Refunded when the buyer was right | 9/9 (100%) | 70% to 100% |
| False fights | 0/18 (0%) | 0% to 18% |
| Missed fights | 0/12 (0%) | 0% to 24% |
| Briefs that passed the citation and action guardrails | 30/30 | |
| Briefs accepted on the first filing | 29/30 | |
| Time from start to a validated brief | median 29 s, range 23 s to 51 s | |

Every case landed on its label: 12 `FIGHT`, 4 `OFFER`, 9 `REFUND` and 5 `MESSAGE_BUYER`. That includes the cases built as traps: a signed delivery at the buyer's old address, a refund already issued, a pickup point that fails PayPal's address match, a card-issuer chargeback outside Seller Protection, a parcel that came back despite 3-D Secure, and a buyer who had already been shown the proof.

### Limitations

- **Small n.** One case moves exact agreement by 3.3 points. At 30/30 the set has no headroom to tell a good agent from a better one.
- **Written by the builders.** The cases cover situations the builders thought of, in one merchant's catalogue and policies. The agent's prompt and playbook come from the same team, so agreement partly measures whether the agent follows its own playbook.
- **Same model family.** Claude wrote the labels and Claude is the agent, so shared blind spots would inflate agreement. No independent human reviewed the labels before the run.
- **Decisions, not outcomes.** A label is the decision the labelling rules call for, not what PayPal would rule. Win likelihoods are not scored.
- **One model, one run per case.** A rerun can flip a close call; run-to-run variance is not measured.
- **Simulator limits.** The simulator always reports PayPal's Seller Protection flag as eligible, and offers and messages never reach a real buyer.

The evaluation also found a bug it left unfixed: for Claude CLI runs, Exhibit's own token count double-counts input and misses most output. No screen shows that number and no decision depends on it.

The next version needs cases written and labelled independently, for example by a payments-operations lead, or a merchant's closed disputes scored against PayPal's actual rulings. Full results: [`eval/RESULTS.md`](https://github.com/exhibitlabs/exhibit/blob/main/eval/RESULTS.md).

### Reproduce

```bash
node eval/run.ts --check    # free: seeds the cases and runs every lookup tool
node eval/run.ts            # live: one agent run per case on your Claude CLI login
node eval/run.ts --report   # rebuild eval/RESULTS.md from eval/results.json
```

| Flag | What it does |
|---|---|
| `--only inr-01,dup-02` | Runs a subset. Results go to the run's `/tmp` folder, not `eval/`. |
| `--smoke` | Runs one demo-merchant case that is not in the set, to test the plumbing. |
| `--concurrency 2` | Cases run at the same time (default 2). |

The live run needs Node 24 or newer and a signed-in Claude CLI. Each case spends your Claude plan, roughly 30 to 60 seconds per case, and the harness stops at the first rate limit and reports the real n. It rewrites `eval/results.json` and `eval/RESULTS.md`.

The harness is safe to run next to a dev server: it always uses the simulator and a fresh `/tmp/exhibit-eval-<timestamp>` data folder, blocks fetches to paypal.com and localhost, and never reads or writes `.data/`.
