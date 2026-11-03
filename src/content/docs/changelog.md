---
title: Changelog
description: What changed in Exhibit, by date, written from the git history. Newest first.
section: Reference
order: 4
---

What changed in Exhibit, newest first. Dates are commit dates in India Standard Time (UTC+5:30), and each entry ends with its commit. The full history is on [GitHub](https://github.com/exhibitlabs/exhibit/commits/main).

## November 3, 2026 {#2026-11-03}

Exhibit was tagged `v1.0.0` ("Exhibit v1.0.0: the dispute agent for PayPal merchants. Submitted to the PayPal AI Hackathon 2026.") at `83bd074`. One commit followed the tag: the landing page's founder note and the pitch deck now speak for both co-founders, Shivansh Dwivedi and Someet Shende, and the licence, site metadata, README and Devpost copy name both (`a543e54`).

### Added

- **MCP server for AI agents.** Nine tools. PayPal's agent toolkit can list, read and accept a dispute; these add the investigation, cited briefs and evidence packets. No tool can file, refund or message: actions become pending requests that the merchant approves in Exhibit. `0291179`
- **Ask Exhibit.** A command palette with read-only tools over the dispute book and a grounded, structured answer: chart values and case ids must come from tool results. It runs on Claude, or on a labelled offline router when no model is available. `bdc403a`
- **Prevention.** Seven deterministic signals map each order to the PayPal dispute it would likely become. Fixes run through the real PayPal client: tracking through Orders v2, refunds through Payments v2, and buyer replies in the buyer's language. `e084003`
- **Command center.** Recovered, at-risk and win-rate figures, a deadline grid, outcomes by reason, and dispute-rate health against published Visa and Mastercard thresholds. Demo mode gets a labelled 90-day history; sandbox mode shows only real cases. `dbb2747`
- **Live evidence graph.** On the case page, sources light up as the agent queries them, then the cited records become lettered exhibits wired to the decision. `67877b4`
- **Landing page and proof page.** The landing page replays real agent runs from the PayPal sandbox: a fight, an honest refund and a prevented dispute. `/proof` lists every PayPal sandbox call, failures included, from checked-in JSON, so both pages render with no database or credentials. `50d13ad`
- **Evaluation.** Labelling rules and 30 synthetic cases across seven dispute reasons and all three PayPal stages, labelled and hashed before one live run of the real agent: 30 of 30 decisions matched, 9 of 9 buyer-right cases were refunded, no false fights, median 29 seconds per case. The builders wrote the cases and labels, so this shows consistency, not real-world accuracy. `8a8c0ed`
- **Test suite and CI.** 286 Vitest tests for the guarantees Exhibit makes, which run with no credentials, network or Claude login, and CI that runs lint, type check, tests and a production build on every push. Also issue and pull request templates, `SECURITY.md`, `CONTRIBUTING.md`, `.editorconfig` and `.nvmrc`. `33e17d1`
- **Product polish across every screen.** `a3f1d42`
  - A self-healing demo: dates reseed from now, an idle demo resets on the next visit, most cases arrive with briefs from recorded runs, and **Reset demo** is one click. Sandbox mode refuses all of it.
  - A demo banner with a **What's real?** breakdown, a guided tour, sidebar badges, notifications, a keyboard shortcut sheet, and loading, error and not-found pages.
  - The case page: a sticky decision header, a lifecycle stepper from real state, word-level citations that light up their source, an inline evidence packet, and tabs for facts, investigation, PayPal calls and history.
  - Saved views, search, deadline-first sorting and bulk investigation on the Disputes page. A live replay of the Autopilot rules over the 90-day history. One PayPal activity timeline with a request inspector that never stores `Authorization` headers and masks secrets.
  - Agent requests get their own page. Refunds, accepted claims and money offers ask for confirmation, and Autopilot's hard limits are enforced on the server.

### Changed

- **The agent runs on the Claude CLI by default.** Exhibit uses the local Claude Code login automatically, so no API key is needed. If the CLI cannot start, a recorded run keeps the demo working and the trace says so. An API key still takes priority, and `EXHIBIT_ALLOW_CLAUDE_CODE=0` opts out. `b1c7ffd`
- **Dependencies.** Added AG Charts and the MCP SDK. `b981765`

### Fixed

- Autopilot no longer acts when a brief's decision and its PayPal action disagree. `a3f1d42`
- The simulator requires PayPal's link for `send-message` and for supporting info, and replays run their tools in the recorded order. `a3f1d42`
- A malformed `Origin` on the approvals route returns 403 instead of 500. `a3f1d42`
- A failed re-run no longer hides the last good brief, and replays run at a readable pace. `67877b4`
- Replayed runs no longer claim an investigation time: the brief card, the case page and the activity log say "recorded run" instead. `86b55c9`
- Unknown dispute ids, malformed batch bodies and empty webhook bodies get a 404 or 400 instead of starting work or failing, with 14 new tests for them and the replay label. `86b55c9`
- Agent prevention-fix approvals link to the approvals page, the resolved-case pager is correct, and the demo guide's **Review the evidence** step works on an open case. `86b55c9`
- No sideways scrolling on tablets and phones, the landing page's prevention chips fit, focus rings respect their inputs and the root 404 page is branded. The pitch deck's earnings-call quote is now verbatim. `86b55c9`

### Docs

- **The proof gains an agent-requested filing.** An outside AI agent asked through MCP to file on `PP-R-EGO-10193744`, the merchant approved, and `provide-supporting-info` returned 200 (PayPal debug id `f4652162f684d`). The proof export, README, Devpost copy, sandbox log and the proof page's social images now show 244 calls and 7 filed responses, and the test count reads 300. `411e2a5`
- The demo script, rewritten for the fifth demo video. `64f52fe`
- The final README, Devpost copy, pitch deck and submission images. The README leads with the live sandbox proof, and `/pitch` is rebuilt from the landing page's data. `7490d9e`
- The README, demo script and submission copy, updated for v2. `16c45e2`

### Removed

- Internal planning notes. `4b69f90`
- Unused screenshots and starter assets. `f00e17b`

## October 20, 2026 {#2026-10-20}

### Added

- **Exhibit's first public version, shipped for the PayPal AI Hackathon.** Anyone can clone it and run the dispute agent with no credentials. It included the case agent on Claude with its tools, brief schema and Seller Protection playbook; the PayPal REST client and the PayPal simulator; the evidence packet PDF; the inbox and the case page; Autopilot rules; tracking sync; sandbox seeding; the webhook listener; recorded runs for eight demo cases; the landing page and pitch deck; the MIT licence and the submission copy. `8655300`
- The project started from Create Next App. `1891d7a`
