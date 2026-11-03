# Contributing to Exhibit

Thanks for helping. Exhibit is an AI dispute agent for PayPal merchants; the code is TypeScript on Next.js, with a small MCP server for other AI agents.

## Set up

You need Node.js 24 or newer (`nvm use` reads [`.nvmrc`](.nvmrc)).

```bash
git clone https://github.com/exhibitlabs/exhibit.git
cd exhibit
npm ci
npm run dev   # http://localhost:3000
```

Nothing needs a key. With no configuration Exhibit runs on a built-in PayPal simulator and replays recorded agent runs. To go further, copy [`.env.example`](.env.example) to `.env.local`: add PayPal sandbox credentials for the real sandbox, and either sign in to the Claude CLI or set `ANTHROPIC_API_KEY` to run the agent live. Never commit `.env.local`.

## Before you open a pull request

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest
npm run build       # next build
```

CI runs the same four steps on every push and pull request to `main`, with no secrets.

## Tests

`npm test` runs the suite in `tests/` with [Vitest](https://vitest.dev). It is hermetic: it forces demo mode and the recorded-run AI provider, uses a temporary data directory, and blocks outbound network calls, so it needs no credentials, no network and no Claude login. `npm run test:watch` re-runs on change.

The tests are organised around Exhibit's guarantees, not its files:

| Guarantee | Tests |
| --- | --- |
| Every claim cites a record that exists | `citation-guardrail` |
| Only PayPal actions the dispute allows, within bounds | `action-guardrail` |
| An agent can ask, never do | `approvals`, `approvals-api`, `mcp-server` |
| The simulator behaves like PayPal | `simulator` |
| Filings call PayPal's APIs correctly | `filing` |
| Autopilot stays inside its limits | `autopilot`, `agent-run` |
| Prevention scoring and fixes | `prevention` |
| Ask Exhibit only shows what the data says | `ask-grounding` |
| Seller Protection checks and the playbook | `playbook` |
| The agent can look, not touch | `agent-tools` |
| The no-key demo path works | `replays`, `config` |

If you change behaviour a guardrail depends on, change or add the test that covers it in the same pull request. A change that makes a guardrail weaker needs a very good reason in the description.

To try the MCP server against a running demo (it refuses anything but demo mode):

```bash
npm run dev
EXHIBIT_URL=http://localhost:3000 npm run mcp:smoke
```

## Commits and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`, in the imperative and lower case.

```
feat(prevention): score orders before they are disputed
fix(approvals): expire a request when the brief changes
docs: explain the MCP approval flow
test(simulator): cover file size limits
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`. Keep pull requests small and focused, fill in the template, and link the issue it closes.

## Code style

[`.editorconfig`](.editorconfig) sets the basics (UTF-8, LF, two-space indent). TypeScript runs in strict mode and ESLint uses the Next.js config; follow the patterns around you. Prefer comments that explain why. Keep user-facing text plain and specific.

## Reporting problems

Use the issue templates for bugs and feature requests. For anything that lets an AI agent act without the merchant's approval, or otherwise weakens a guardrail, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
