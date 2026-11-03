# Docs content format

Every page under `/docs` is one Markdown file in this folder. A small renderer in
`src/components/site/docs/` turns each file into a statically rendered page with the sidebar,
the "On this page" table of contents, previous and next links, and search. There is no MDX
and no raw HTML: write plain Markdown in the subset below and the layout does the rest.

This file is the spec. It is not a page (the loader skips `README.md`).

## Files and URLs

- One file per page: `src/content/docs/<slug>.md`. The file name is the URL:
  `quickstart.md` is served at `/docs/quickstart`.
- `index.md` is the Introduction, served at `/docs`.
- Slugs are lowercase words joined by hyphens. Do not rename a file once other pages link to it.
- Preview with hot reload at `http://localhost:3101/docs/<slug>` (demo server). Refresh the
  browser after creating a new file.

## Frontmatter

Each file starts with a frontmatter block. One `key: value` per line, no nesting, no lists.
Quotes around values are optional and are stripped.

```md
---
title: Quickstart
description: Run Exhibit locally in two minutes, with no keys and no PayPal account.
section: Get started
order: 2
---
```

| Field | Required | Meaning |
|---|---|---|
| `title` | yes | The page title. Rendered as the page's only `h1`, used in the sidebar, the browser tab and search. |
| `description` | yes | One sentence, under 160 characters. Rendered as the lead under the title and used for the meta description, search results and link cards. |
| `section` | yes | The sidebar section. Must be one of the five section names below, spelled exactly. |
| `order` | yes | An integer: the page's position inside its section (1 is first). |
| `label` | no | A shorter sidebar label if the title is long. Defaults to `title`. |
| `toc` | no | `false` hides the "On this page" table of contents. Defaults to `true`. |

Do not repeat the title as a `#` heading in the body: the layout renders it.

## Sidebar: sections and order (all sixteen pages)

The section order is fixed in code. Use these exact `section` and `order` values.

| Section | Order | Title | File | URL | Owner |
|---|---|---|---|---|---|
| Get started | 1 | Introduction | `index.md` | `/docs` | docs agent A |
| Get started | 2 | Quickstart | `quickstart.md` | `/docs/quickstart` | docs agent A |
| Get started | 3 | Sandbox guide | `sandbox.md` | `/docs/sandbox` | docs agent A |
| How it works | 1 | How Exhibit decides | `how-exhibit-decides.md` | `/docs/how-exhibit-decides` | docs agent A |
| How it works | 2 | Evidence packets | `evidence-packets.md` | `/docs/evidence-packets` | docs agent A |
| How it works | 3 | Prevention | `prevention.md` | `/docs/prevention` | docs agent A |
| How it works | 4 | Ask Exhibit | `ask-exhibit.md` | `/docs/ask-exhibit` | docs agent A |
| How it works | 5 | Autopilot | `autopilot.md` | `/docs/autopilot` | docs agent B |
| Integrations | 1 | PayPal integration | `paypal-integration.md` | `/docs/paypal-integration` | docs agent A |
| Integrations | 2 | MCP server | `mcp.md` | `/docs/mcp` | docs agent B |
| Trust | 1 | Security model | `security-model.md` | `/docs/security-model` | docs agent B |
| Trust | 2 | Testing and evaluation | `testing-and-evaluation.md` | `/docs/testing-and-evaluation` | docs agent B |
| Reference | 1 | Configuration | `configuration.md` | `/docs/configuration` | docs agent B |
| Reference | 2 | API routes | `api.md` | `/docs/api` | docs agent B |
| Reference | 3 | Troubleshooting and FAQ | `troubleshooting.md` | `/docs/troubleshooting` | docs agent B |
| Reference | 4 | Changelog | `changelog.md` | `/docs/changelog` | docs agent B |

Previous and next links follow this order across sections.

`/docs/sandbox`, `/docs/mcp` and `/docs/api` are already linked from the site's navigation and footer
(`src/components/site/nav.ts`), so those three files are named `sandbox.md`, `mcp.md` and `api.md`.

## Markdown subset

### Headings

- `##` starts a main section and `###` a subsection. Both appear in "On this page".
- `####` is allowed for small labels and is not listed in the table of contents.
- Each heading gets an id from its text: lowercase, apostrophes dropped, letters and digits kept,
  every other run of characters becomes one hyphen. `## Demo mode` becomes `#demo-mode`,
  `## What's not testable live` becomes `#whats-not-testable-live`; a repeated heading gets `-2`, `-3`.
- Set a stable id with `{#id}` at the end: `## How the agent picks a provider {#providers}`.
- Keep headings short (two to six words) and in sentence case.

### Paragraphs and inline text

- Separate paragraphs with a blank line. Lines inside a paragraph are joined, so hard wrapping is fine.
- `**bold**`, `*italic*`, `` `inline code` ``, `[link text](url)`.
- Use inline code for commands, file paths, environment variables, endpoints, ids, tool names and
  literal values: `npm run dev`, `src/lib/config.ts`, `PAYPAL_CLIENT_ID`, `POST /v1/customer/disputes/{id}/accept-claim`.
- Escape a literal `*`, `_`, `` ` ``, `[` or `|` with a backslash: `\*`.
- Bare `https://` URLs become links, but prefer `[text](url)`. Write local addresses as inline code:
  `http://localhost:3000`.
- Images: `![Alt text](/path/in/public.png)` on a line of its own. Use rarely; never for code or text.

### Links

- Between docs pages, use absolute paths: `[Quickstart](/docs/quickstart)`,
  `[the brief schema](/docs/how-exhibit-decides#the-brief)`. The Introduction is `/docs`.
- Other pages of the site: `/security`, `/proof`, `/app`, `/product/...`.
- Files in the repository: `https://github.com/exhibitlabs/exhibit/blob/main/<path>`.
- External links use the full `https://` URL and get a small arrow after them automatically.
- A link to a `/docs/...` page or `#anchor` that does not exist fails the production build, so check
  slugs against the table above and anchors against the target page's headings.

### Lists

```md
- A bullet item.
- Another one, with `code` and a [link](/docs/quickstart).
  - A nested item: indent two spaces.

1. A numbered item.
2. The next one.
   - Nested under a numbered item: indent three spaces.
```

List items hold inline text and nested lists. Put code blocks, tables and callouts after the list,
or use `:::steps` when each step needs a code block.

### Code blocks

Fence with three backticks and always give a language. An optional `title` labels the block.

````md
```bash
npm install
npm run dev
```

```env title=".env.local"
PAYPAL_CLIENT_ID=your-sandbox-client-id
```
````

- Languages with highlighting: `bash` (also `sh`, `shell`, `zsh`), `json`, `ts`, `tsx`, `js`,
  `jsx`, `env`, `yaml`, `http`, `md`. Use `text` for plain output.
- Every block gets a copy button that copies the block exactly, so do not write `$ ` prompts in
  front of commands. Put output in its own `text` block.
- Keep lines under about 90 characters; long lines scroll horizontally.

### Callouts

GitHub alert syntax. Optional title after the marker on the same line.

```md
> [!NOTE]
> Demo mode uses the PayPal simulator. Nothing leaves your machine.

> [!WARNING] Live sandbox only
> PayPal accepts one evidence document per call.
```

Types: `NOTE` (neutral context), `TIP` (a shortcut or a better way), `IMPORTANT` (needed to
succeed), `WARNING` (something can fail or surprise), `CAUTION` (irreversible or money-moving).
Use at most two or three per page. Separate paragraphs inside a callout with a line holding only `>`.
A `>` quote without a marker is a plain blockquote (for quoting a transcript or PayPal's docs).

### Tables

GitHub pipe tables. The first row is the header; the second row is the separator.
Colons in the separator set alignment (`:---`, `:---:`, `---:`). Inline formatting works in cells.

```md
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/disputes` | List disputes with their decision and deadline. |
```

A cell holding only `GET`, `POST`, `PUT`, `PATCH` or `DELETE` in inline code renders as a
method badge. Wide tables scroll sideways on phones.

### Steps

A numbered sequence where each step can hold code blocks, tables and callouts.
Each `###` inside starts a step and is listed in "On this page".

````md
:::steps
### Install dependencies

```bash
npm install
```

### Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.
:::
````

### Cards

A grid of links to other pages. Each item is a link, a colon and one short sentence.

```md
:::cards
- [Quickstart](/docs/quickstart): Run Exhibit locally in demo mode.
- [MCP server](/docs/mcp): Give Claude Desktop or Claude Code the nine tools.
:::
```

### Tabs

Alternative code blocks for the same task, shown as tabs. Each fenced block inside is one tab,
labelled by its `title` (required here).

````md
:::tabs
```json title="Claude Desktop"
{ "mcpServers": {} }
```

```bash title="Claude Code"
claude mcp list
```
:::
````

`:::steps`, `:::cards` and `:::tabs` must open and close on lines of their own and cannot be nested
inside each other. Anything else (raw HTML, JSX, footnotes, task lists, `<details>`) is not
supported and renders as plain text.

## Checking a page

- In development (`localhost:3101`), a dashed **Docs check** box at the top of a page lists anything wrong
  with it: missing frontmatter, an unknown section, two pages in one slot, a broken `/docs` link or anchor,
  an unknown code language, an unclosed `:::` block.
- In a production build, frontmatter and link problems stop the build with the file and the reason.
- Every page also gets a search entry per heading automatically (`/docs/search-index.json`).

## Writing rules

- Accuracy first. Every command, environment variable, endpoint, tool name, number and file path
  must match the code. Read the source before you write the sentence.
- Plain, concrete, short sentences. No hype words. No em dashes: use a comma, colon, parentheses
  or a full stop.
- Address the reader as "you". Name the product "Exhibit"; "Ask Exhibit", "Autopilot",
  "PayPal", "Claude Code", "Claude Desktop", "MCP" as written here.
- British spelling, as in the README (organised, behaviour).
- Demo data is labelled as demo. The evaluation always carries its caveat: 30 synthetic cases
  written by the builders.
- Fair to buyers. Exhibit refunds, offers or explains when the buyer is right; never write
  "beat the buyer".
- Start each page with what the reader can do or learn, then the detail. Prefer a table to a
  long list of similar items.

## Example page

````md
---
title: Run the dev server
description: Start Exhibit locally and open the app.
section: Get started
order: 9
---

Exhibit is a Next.js app. One command starts it with hot reload.

## Start it

:::steps
### Install dependencies

```bash
npm install
```

### Start the server

```bash
npm run dev
```

Open `http://localhost:3000/app`.
:::

> [!TIP]
> No keys are needed. With no PayPal credentials, Exhibit runs on its PayPal simulator.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the dev server on port 3000. |
| `npm test` | Runs the test suite with Vitest. |

Next, read [How Exhibit decides](/docs/how-exhibit-decides).
````

## Requests from the reference-pages agent

- No new Markdown features needed. The eight reference pages (`autopilot`, `mcp`, `security-model`,
  `testing-and-evaluation`, `configuration`, `api`, `troubleshooting`, `changelog`) use only the subset
  above and parse with no warnings.
- Rendering, phones (390 px): inline code in a narrow table column breaks mid-word. On `/docs/api`
  the path `/api/approvals` renders as `/api/` `appro` `vals`. Suggest `white-space: nowrap` for code
  in table cells (at least in method and path tables) and letting the table scroll sideways, as the
  spec promises. The two-column prose tables on `/docs/troubleshooting` already scroll sideways; a
  stacked row layout under about 640 px would read better there.
- Resolved (docs agent A): inline code in table cells stays on one line and wide tables scroll sideways
  inside their own frame. Below 640 px every table stacks: each row becomes a small card, the first cell
  leads and the others carry their column name. Long paths can break after a slash only in that layout.
