/**
 * Exhibit's evaluation harness. Seeds the labelled cases in eval/cases.ts into an isolated store and
 * runs the real agent on each one through the Claude CLI, exactly as the Run button does.
 *
 *   node eval/run.ts                    every case, concurrency 2; writes eval/results.json and eval/RESULTS.md
 *   node eval/run.ts --check            seed the cases and run every lookup tool on them (no model calls)
 *   node eval/run.ts --only inr-01,dup-02   a subset; results go to the run's /tmp data dir, not eval/
 *   node eval/run.ts --smoke            one demo-merchant case (not in the set), to test the plumbing
 *   node eval/run.ts --report           rebuild eval/RESULTS.md from eval/results.json and eval/readings.ts
 *
 * Safety: PayPal is always the in-process simulator (EXHIBIT_PAYPAL_MODE=demo), data lives in a fresh
 * /tmp/exhibit-eval-<timestamp>, and fetches to paypal.com or localhost are blocked. It never reads or
 * writes .data/, never calls the PayPal sandbox and never talks to a running dev server.
 *
 * Exhibit's server code is written for Next.js (extensionless imports, `server-only`, one .tsx file), so
 * this entry registers Node module hooks that resolve those imports and transpile them with the repo's
 * own TypeScript before loading the harness. No product code is changed.
 */
import fs from "node:fs";
import { createRequire, registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const ts = createRequire(import.meta.url)("typescript") as typeof import("typescript");

const ours = (file: string) => [path.join(root, "src"), here].some((dir) => file.startsWith(dir + path.sep));
const withExtension = (base: string) => [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")].find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
const TAP = pathToFileURL(path.join(here, "sdk-tap.ts")).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    // `server-only` throws outside a React Server Component bundle; here it is a no-op, as in the tests.
    if (specifier === "server-only") return { url: "data:text/javascript,export%20%7B%7D", shortCircuit: true };
    const parent = context.parentURL?.startsWith("file:") ? fileURLToPath(context.parentURL) : undefined;
    // The Claude CLI provider gets a read-only tap on the SDK's message stream (eval/sdk-tap.ts).
    if (specifier === "@anthropic-ai/claude-agent-sdk" && parent === path.join(root, "src/lib/agent/providers/claude-code.ts")) return { url: TAP, shortCircuit: true };
    let target: string | undefined;
    if (specifier.startsWith("@/")) target = withExtension(path.join(root, "src", specifier.slice(2)));
    else if (/^\.\.?\//.test(specifier) && parent && ours(parent)) target = withExtension(path.resolve(path.dirname(parent), specifier));
    if (target) return { url: pathToFileURL(target).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && /\.tsx?$/.test(url) && ours(fileURLToPath(url))) {
      const file = fileURLToPath(url);
      const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, isolatedModules: true, inlineSourceMap: true },
      });
      return { format: "module", source: outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
process.setSourceMapsEnabled(true);

const argv = process.argv.slice(2);
if (argv.includes("--report")) {
  const { rebuildReport } = await import("./report");
  console.log(rebuildReport());
  process.exit(0);
}

// The environment is pinned before any Exhibit module loads.
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
process.env.EXHIBIT_DATA_DIR = `/tmp/exhibit-eval-${stamp}`;
process.env.EXHIBIT_PAYPAL_MODE = "demo";
process.env.EXHIBIT_AI_PROVIDER = "claude-code";
// No PayPal credentials, no API key (the CLI must use the local Claude login), no replay recording.
for (const k of ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "EXHIBIT_RECORD_REPLAYS", "EXHIBIT_APP_URL"]) delete process.env[k];
// Run the CLI as it would run from a plain terminal, even when this harness is started inside a Claude
// Code session (whose variables, such as CLAUDE_EFFORT, would otherwise reach the agent's CLI).
for (const k of Object.keys(process.env)) if (/^CLAUDE/.test(k) && k !== "CLAUDE_CONFIG_DIR") delete process.env[k];
process.chdir(root);

const { main } = await import("./harness");
process.exit(await main(argv));
