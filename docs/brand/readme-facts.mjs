#!/usr/bin/env node
// Ties the README to Exhibit's records, and checks its links. Node 24 or later, no packages.
//
//   node docs/brand/readme-facts.mjs                  write the generated block in README.md, then check
//   node docs/brand/readme-facts.mjs --check          check only; exits 1 if anything is off
//   node docs/brand/readme-facts.mjs --tests          also run the test suite and check the test count
//   node docs/brand/readme-facts.mjs --external       also request every external link
//
// The block between <!-- records:proof ... --> and <!-- /records:proof --> is written from
// src/components/landing/records/proof.json, Exhibit's own sandbox call log (exported by records/export.mjs).
// Every other figure the README states is checked against its source: proof.json, eval/results.json,
// docs/MCP_DEMO.md, src/components/landing/data.ts and the code it describes. Then every relative link and
// image must exist, and every #anchor must match a heading the way GitHub makes heading ids. The
// organisation profile (../exhibit-org-dotgithub next to the repo, or ORG_DIR) is checked too when present.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const README = path.join(ROOT, "README.md");
const ORG_DIR = path.resolve(process.env.ORG_DIR ?? path.join(ROOT, "../exhibit-org-dotgithub"));
const args = new Set(process.argv.slice(2));
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const json = (p) => JSON.parse(read(p));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const pad = (n) => String(n).padStart(2, "0");
/** "Nov 3, 2026" (UTC), or "Nov 3" without the year. */
const day = (iso, year = true) => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}${year ? `, ${d.getUTCFullYear()}` : ""}`;
};
const time = (iso) => `${pad(new Date(iso).getUTCHours())}:${pad(new Date(iso).getUTCMinutes())} UTC`;
const usd = (n) => `$${n.toLocaleString("en-US")}`;
const num = (n) => n.toLocaleString("en-US");
const word = (n) => WORDS[n] ?? String(n);

// ------------------------------------------------------------------ the sandbox record (proof.json)

const proof = json("src/components/landing/records/proof.json");
const T = proof.totals;
const REASON = { UNAUTHORISED: "Unauthorized", MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received", CREDIT_NOT_PROCESSED: "Credit not processed" };
const DECISION = { FIGHT: "Fight", REFUND: "Refund", OFFER: "Offer", MESSAGE_BUYER: "Message the buyer" };
const DISPUTE_CALL = /\/(provide-evidence|provide-supporting-info|accept-claim|make-offer|send-message)$/;

/** Successful dispute responses filed through the Disputes API, oldest first. */
const filed = proof.writes.filter((w) => w.disputeId && DISPUTE_CALL.test(w.path) && w.status < 400);
const failed = proof.writes.filter((w) => w.status >= 400);
const endpoint = (w) => w.path.split("/").pop();
/** Exhibit's call on a case: its latest finished brief. */
const call = (id) => {
  const run = proof.runs.filter((r) => r.disputeId === id && r.status === "done").at(-1);
  return run ? `${DECISION[run.decision] ?? run.decision}, ${run.winLikelihood}%` : "";
};
const asked = proof.actions.find((a) => a.actor.startsWith("agent:"));
const agentFiling = asked ? filed.find((w) => w.disputeId === asked.disputeId && Math.abs(Date.parse(w.at) - Date.parse(asked.at)) < 2000) : null;
const agentName = asked ? asked.actor.replace(/^agent:/, "").replace(/ approved by merchant$/, "") : null;
const resolved = proof.disputes.find((d) => d.status === "RESOLVED") ?? null;
const ruling = resolved ? proof.writes.find((w) => w.disputeId === resolved.id && w.path.endsWith("/adjudicate")) : null;

const td = (html, attrs = "") => `<td${attrs}>${html}</td>`;

function proofBlock() {
  const first = proof.firstCall;
  const last = proof.lastCall;
  const range = new Date(first).getUTCFullYear() === new Date(last).getUTCFullYear() ? `${day(first, false)} to ${day(last)}` : `${day(first)} to ${day(last)}`;
  // An HTML table, so each case spans its filings; one filing per row.
  const rows = [];
  for (const id of [...new Set(filed.map((w) => w.disputeId))]) {
    const d = proof.disputes.find((x) => x.id === id);
    const mine = filed.filter((w) => w.disputeId === id);
    const span = mine.length > 1 ? ` rowspan="${mine.length}"` : "";
    mine.forEach((w, i) => {
      const lead = i ? "" : td(`${id}<br><sub>${REASON[d.reason] ?? d.reason}, ${usd(d.amount)}</sub>`, span) + td(call(id), span);
      const note = w === agentFiling ? "<br><sub>requested by an AI agent</sub>" : "";
      rows.push(`<tr>${lead}${td(`<code>${endpoint(w)}</code>${note}`)}${td(w.status)}${td(`<code>${w.debugId}</code>`)}</tr>`);
    });
  }
  const out = [
    `Exhibit has run end to end on \`${proof.host}\`. Its own call log holds **${num(T.calls)} API calls** from ${range}: ${num(T.ok)} returned 2xx and ${num(T.errors)} returned an error, across ${T.endpoints} endpoints, ${T.disputes} sandbox chargebacks and ${T.runs} agent runs. These are the **${filed.length} dispute responses** it filed through the Disputes API:`,
    "",
    "<table>",
    `<thead><tr>${["Dispute", "Exhibit's call", "Filed", "HTTP", "PayPal-Debug-Id"].map((h) => `<th align="left">${h}</th>`).join("")}</tr></thead>`,
    "<tbody>",
    ...rows,
    "</tbody>",
    "</table>",
  ];
  if (agentFiling) {
    out.push("", `**The agent-requested filing.** On ${day(agentFiling.at)}, at ${time(agentFiling.at)}, an outside AI agent (${agentName}, connected through Exhibit's MCP server) asked to file on ${agentFiling.disputeId}. Nothing moved until the merchant approved. Then Exhibit called \`${endpoint(agentFiling)}\`, and PayPal answered ${agentFiling.status} in ${num(agentFiling.ms)} ms.`);
  }
  const rest = [];
  if (resolved && resolved.outcome) rest.push(`${resolved.id} is now \`${resolved.status}\` (\`${resolved.outcome.code}\` / \`${resolved.outcome.reason}\`)${ruling ? ` after a sandbox-only \`adjudicate\` call (\`${ruling.debugId}\`)` : ""}.`);
  if (failed.length) {
    const same = failed.every((w) => w.disputeId === failed[0].disputeId && endpoint(w) === endpoint(failed[0]));
    const codes = failed.map((w) => `HTTP ${w.status}, \`${w.debugId}\``).join("; ");
    rest.push(
      same
        ? `${word(failed.length)[0].toUpperCase()}${word(failed.length).slice(1)} earlier \`${endpoint(failed[0])}\` attempts on ${failed[0].disputeId === resolved?.id ? "it" : failed[0].disputeId} failed (${codes}), which is why Exhibit now files one evidence per call.`
        : `${failed.length} earlier filing attempts failed (${failed.map((w) => `\`${endpoint(w)}\` on ${w.disputeId}, HTTP ${w.status}, \`${w.debugId}\``).join("; ")}), which is why Exhibit now files one evidence per call.`,
    );
  }
  if (rest.length) out.push("", `**The rest of the record.** ${rest.join(" ")}`);
  return out.join("\n");
}

// ------------------------------------------------------------------ the other sources

const evalRun = json("eval/results.json");
const cases = evalRun.cases;
const minutes = cases.map((c) => c.minutes).filter((m) => m != null).sort((a, b) => a - b);
const mid = Math.floor(minutes.length / 2);
const median = minutes.length % 2 ? minutes[mid] : (minutes[mid - 1] + minutes[mid]) / 2;
const buyerRight = cases.filter((c) => c.expected === "REFUND");
const notFight = cases.filter((c) => c.expected !== "FIGHT");
const EVAL = {
  cases: cases.length,
  matched: cases.filter((c) => c.decision === c.expected).length,
  refunded: buyerRight.filter((c) => c.decision && c.decision !== "FIGHT").length,
  buyerRight: buyerRight.length,
  falseFights: notFight.filter((c) => c.decision === "FIGHT").length,
  notFight: notFight.length,
  passed: cases.filter((c) => c.guardrails?.final_valid).length,
  seconds: Math.round(median * 60),
  reasons: new Set(cases.map((c) => c.reason)).size,
  date: day(evalRun.meta.started_at),
};

const data = read("src/components/landing/data.ts");
const fees = [...data.slice(data.indexOf("PAYPAL_FEES")).matchAll(/amount: (\d+)/g)].slice(0, 3).map((m) => Number(m[1]));
const quote = { text: data.match(/PAYPAL_MCP_QUOTE = \{\s*text: "([^"]+)"/)?.[1], date: data.match(/PAYPAL_MCP_QUOTE = \{[^}]*date: "([^"]+)"/)?.[1] };
const mcpDemo = read("docs/MCP_DEMO.md");
const MCP_RUN = { disputes: Number(mcpDemo.match(/"count":(\d+)/)?.[1]), seconds: Number(mcpDemo.match(/Finished in (\d+)s/)?.[1]) };
const IDLE = Number(read("src/lib/demo.ts").match(/DEMO_IDLE_MINUTES = (\d+)/)?.[1]);
const agentTools = [...read("src/lib/agent/tools.ts").matchAll(/name: "([a-z_]+)"/g)].map((m) => m[1]);
const signals = read("src/lib/prevention.ts").match(/export const SIGNALS[^=]*= \{([^]*?)\n\};/)?.[1].match(/^\s+[a-z_]+:/gm)?.length;
const mcpServer = read("mcp/server.ts");
const mcpTools = [...mcpServer.matchAll(/registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
const historyDays = Number(read("src/lib/store/history.ts").match(/deterministic (\d+)-day history/)?.[1]);
let firstCommit = null;
try {
  firstCommit = execFileSync("git", ["log", "--reverse", "--format=%aI", "--max-parents=0"], { cwd: ROOT, encoding: "utf8" }).trim().split("\n")[0];
} catch {
  /* not a git checkout */
}

// ------------------------------------------------------------------ checks

const problems = [];
const ok = [];
function expect(text, phrase, why, times = 1) {
  const n = text.toLowerCase().split(phrase.toLowerCase()).length - 1;
  if (n < times) problems.push(`README should say "${phrase}" (${why})${times > 1 ? `, ${times} times; found ${n}` : ""}`);
  else ok.push(phrase);
}

function checkFigures(md) {
  const prose = md.replace(/<!-- records:proof[^]*?<!-- \/records:proof -->/, "");
  // Test count: every mention agrees; with --tests, it matches the suite.
  const testCounts = new Set([...prose.matchAll(/(\d+) tests/g), ...prose.matchAll(/tests-(\d+)/g)].map((m) => m[1]));
  if (testCounts.size !== 1) problems.push(`README gives different test counts: ${[...testCounts].join(", ") || "none"}`);
  if (args.has("--tests")) {
    // The JSON goes to a file: tests may print to stdout, which would break parsing the console output.
    const report = path.join(os.tmpdir(), `exhibit-readme-facts-${process.pid}.json`);
    execFileSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${report}`], { cwd: ROOT, stdio: "ignore" });
    const total = JSON.parse(readFileSync(report, "utf8")).numTotalTests;
    rmSync(report, { force: true });
    if (!testCounts.has(String(total)) || testCounts.size !== 1) problems.push(`the suite has ${total} tests; README says ${[...testCounts].join(", ")}`);
    else ok.push(`${total} tests`);
  }
  expect(prose, `$${fees[0]}, $${fees[1]} for high-volume sellers, $${fees[2]} per card chargeback`, "PAYPAL_FEES in data.ts");
  expect(prose, `${EVAL.cases} synthetic disputes`, "eval/results.json", 2);
  expect(prose, `matched the label ${EVAL.matched} of ${EVAL.cases} times`, "eval/results.json");
  expect(prose, `**${EVAL.matched} of ${EVAL.cases} decisions matched the label**`, "eval/results.json");
  expect(prose, EVAL.refunded === EVAL.buyerRight ? `refunded all ${EVAL.buyerRight} cases where the buyer was right` : `refunded ${EVAL.refunded} of ${EVAL.buyerRight} cases where the buyer was right`, "eval/results.json");
  expect(prose, `made ${EVAL.falseFights} false fights out of ${EVAL.notFight}`, "eval/results.json");
  expect(prose, EVAL.passed === EVAL.cases ? `all ${EVAL.cases} briefs passed the citation and action guardrails` : `${EVAL.passed} of ${EVAL.cases} briefs passed`, "eval/results.json");
  expect(prose, `The median case took ${EVAL.seconds} s`, "eval/results.json");
  expect(prose, `across ${word(EVAL.reasons)} reasons`, "eval/results.json");
  expect(prose, `on ${EVAL.date}, with the labels frozen`, "eval/results.json");
  expect(prose, `triaged ${MCP_RUN.disputes} open disputes in ${MCP_RUN.seconds} s`, "docs/MCP_DEMO.md");
  expect(prose, `${IDLE} quiet minutes`, "DEMO_IDLE_MINUTES in src/lib/demo.ts", 2);
  const reads = agentTools.filter((t) => t !== "file_case_brief").length;
  if (agentTools.at(-1) !== "file_case_brief") problems.push("src/lib/agent/tools.ts no longer ends with file_case_brief");
  expect(prose, `across ${word(reads)} sources`, "the agent's read tools in src/lib/agent/tools.ts");
  expect(prose, `${word(reads)} read-only tools and files a structured brief with a ${["", "", "", "", "", "", "", "", "", "ninth", "tenth"][agentTools.length] ?? `${agentTools.length}th`}, \`file_case_brief\``, "src/lib/agent/tools.ts");
  expect(prose, `${reads} read-only tools + file_case_brief`, "src/lib/agent/tools.ts (Mermaid)");
  expect(prose, `${word(signals)} warning signs`, "SIGNALS in src/lib/prevention.ts", 2);
  const table = prose.slice(prose.indexOf("| Tool | What it does |"));
  const listed = [...table.slice(0, table.indexOf("\n\n")).matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]);
  if (listed.join() !== mcpTools.join()) problems.push(`MCP tools table (${listed.join(", ")}) differs from mcp/server.ts (${mcpTools.join(", ")})`);
  else ok.push(`${mcpTools.length} MCP tools`);
  if (quote.text) expect(prose, `"${quote.text}"`, "PAYPAL_MCP_QUOTE in data.ts");
  if (quote.date) expect(prose, `PayPal Cosmos.AI Agentic Platform Team, ${quote.date}`, "PAYPAL_MCP_QUOTE in data.ts");
  expect(prose, `generated ${historyDays}-day history`, "src/lib/store/history.ts");
  if (firstCommit) expect(prose, `the first commit is ${MONTHS[Number(firstCommit.slice(5, 7)) - 1]} ${Number(firstCommit.slice(8, 10))}, ${firstCommit.slice(0, 4)}`, "git log");
}

/** GitHub's heading ids (github-slugger): lower case, punctuation dropped, spaces to hyphens, repeats numbered. */
function slugs(md) {
  const seen = new Map();
  const out = new Set();
  for (const line of md.replace(/^```[^]*?^```/gm, "").split("\n")) {
    const m = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const text = m[1]
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/[`*_~]/g, "");
    let s = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "").replace(/ /g, "-");
    const n = seen.get(s) ?? 0;
    seen.set(s, n + 1);
    if (n) s = `${s}-${n}`;
    out.add(s);
  }
  return out;
}

const external = new Set();
function checkLinks(file, label) {
  const md = readFileSync(file, "utf8");
  const ids = slugs(md);
  const body = md.replace(/^```[^]*?^```/gm, "").replace(/`[^`\n]+`/g, "").replace(/<!--[^]*?-->/g, "");
  const targets = [
    ...[...body.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]),
    ...[...body.matchAll(/\s(?:href|src|srcset)="([^"]+)"/g)].map((m) => m[1]),
  ];
  let local = 0;
  for (const t of targets) {
    if (/^mailto:/.test(t)) continue;
    if (/^https?:\/\//.test(t)) {
      external.add(t);
      continue;
    }
    const [p, anchor] = t.split("#");
    if (!p) {
      if (!ids.has(anchor)) problems.push(`${label}: #${anchor} matches no heading`);
      else local++;
      continue;
    }
    const target = path.resolve(path.dirname(file), decodeURI(p));
    if (!existsSync(target)) {
      problems.push(`${label}: ${t} does not exist`);
      continue;
    }
    if (anchor && target.endsWith(".md") && !slugs(readFileSync(target, "utf8")).has(anchor)) problems.push(`${label}: ${t} has no heading #${anchor}`);
    else local++;
  }
  ok.push(`${label}: ${local} local links and images`);
}

async function checkExternal() {
  for (const url of external) {
    // The repository's own URLs are left alone: the move to github.com/exhibitlabs may still be settling.
    if (url.startsWith("https://github.com/exhibitlabs/")) continue;
    try {
      const r = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "Mozilla/5.0 exhibit-readme-check" } });
      if (r.status >= 400) problems.push(`${url} returned ${r.status}`);
      else ok.push(url);
    } catch (e) {
      problems.push(`${url}: ${e.cause?.code ?? e.message}`);
    }
  }
}

// ------------------------------------------------------------------ run

let md = readFileSync(README, "utf8");
const BLOCK = /(<!-- records:proof\b[^]*?-->\n)[^]*?(<!-- \/records:proof -->)/;
if (!BLOCK.test(md)) {
  console.error("README.md has no <!-- records:proof --> ... <!-- /records:proof --> block.");
  process.exit(1);
}
const next = md.replace(BLOCK, (_, open, close) => `${open}${proofBlock()}\n${close}`);
if (next !== md) {
  if (args.has("--check")) problems.push("the records:proof block is out of date with proof.json (run without --check)");
  else {
    writeFileSync(README, next);
    md = next;
    console.log(`README.md: wrote the sandbox record (${filed.length} filings, ${T.calls} calls) from proof.json`);
  }
}

checkFigures(md);
checkLinks(README, "README.md");
for (const f of ["profile/README.md", "README.md"]) {
  const file = path.join(ORG_DIR, f);
  if (existsSync(file)) checkLinks(file, `org ${f}`);
}
if (args.has("--external")) await checkExternal();

console.log(`Checked ${ok.length} figures and link groups${args.has("--external") ? `, ${external.size} external links` : ` (${external.size} external links not requested; add --external)`}.`);
if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("All good.");
