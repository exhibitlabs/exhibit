/**
 * A tiny server-side syntax highlighter for the docs' code blocks. Each language is an ordered list of
 * sticky regex rules; the first rule that matches at the current position wins, anything else is plain
 * text. It colours comments, strings, keys, keywords, numbers, commands and flags, which is all a
 * reader needs to scan a snippet. Runs at build time only, so it adds nothing to the client bundle.
 *
 * Token classes (styled in docs.css): c comment, s string, k keyword, n number, p property or key,
 * f function or command, v variable, a flag or attribute, t type or tag, o punctuation.
 */

export type Token = { t: string | null; v: string };
type Rule = [type: string, re: RegExp];

const sticky = (re: RegExp) => new RegExp(re.source, re.flags.includes("y") ? re.flags : re.flags + "y");
const rules = (list: [string, RegExp][]): Rule[] => list.map(([t, re]) => [t, sticky(re)]);

const STRING_D = /"(?:\\.|[^"\\\n])*"/;
const STRING_S = /'(?:\\.|[^'\\\n])*'/;
const NUMBER = /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/;

const BASH = rules([
  ["c", /(?<![^\s])#[^\n]*/],
  ["s", STRING_D],
  ["s", /'[^']*'/],
  ["v", /\$\{[^}\n]*\}|\$[A-Za-z_][A-Za-z0-9_]*|\$[0-9@#?*!$-]/],
  ["p", /(?<=(?:^|[\n;&|(])[ \t]*(?:[A-Za-z_][A-Za-z0-9_]*=\S*[ \t]+)*)[A-Za-z_][A-Za-z0-9_]*(?==)/],
  ["s", /(?<=(?:^|[\n;&|(])[ \t]*(?:[A-Za-z_][A-Za-z0-9_]*=\S*[ \t]+)*[A-Za-z_][A-Za-z0-9_]*=)[^\s;&|]+/],
  ["f", /(?<=(?:^|[\n;&|(])[ \t]*(?:[A-Za-z_][A-Za-z0-9_]*=\S*[ \t]+)*)[A-Za-z0-9_./~][A-Za-z0-9_./~:-]*/],
  ["a", /(?<=[ \t])--?[A-Za-z0-9][\w-]*/],
  ["o", /&&|\|\||[|;&<>\\]/],
]);

const JSON_RULES = rules([
  ["c", /\/\/[^\n]*|\/\*[\s\S]*?\*\//],
  ["p", /"(?:\\.|[^"\\\n])*"(?=\s*:)/],
  ["s", STRING_D],
  ["n", NUMBER],
  ["k", /\b(?:true|false|null)\b/],
  ["o", /[{}[\],:]/],
]);

const TS_KEYWORDS =
  "abstract|as|async|await|break|case|catch|class|const|continue|declare|default|delete|do|else|enum|export|extends|false|finally|for|from|function|if|implements|import|in|instanceof|interface|keyof|let|new|null|of|private|protected|public|readonly|return|satisfies|static|super|switch|this|throw|true|try|type|typeof|undefined|var|void|while|yield";

const tsRules = (jsx: boolean) =>
  rules([
    ["c", /\/\/[^\n]*|\/\*[\s\S]*?\*\//],
    ["s", /`(?:\\[\s\S]|[^`\\])*`/],
    ["s", STRING_D],
    ["s", STRING_S],
    ...(jsx ? ([["t", /<\/?[A-Za-z][\w.:-]*/]] as [string, RegExp][]) : []),
    ["k", new RegExp(`\\b(?:${TS_KEYWORDS})\\b`)],
    ["n", NUMBER],
    ["p", /(?<=(?:^|\n|[{,])[ \t]*)[A-Za-z_$][\w$]*(?=\??:(?!:))/],
    ["f", /[A-Za-z_$][\w$]*(?=\s*\()/],
    ["t", /\b[A-Z][a-z0-9]\w*\b/],
    ["o", /=>|[{}()[\];,.<>=+\-*/%!?:&|^~]/],
  ]);

const TS = tsRules(false);
const TSX = tsRules(true);

const ENV = rules([
  ["c", /(?<![^\s])#[^\n]*/],
  ["p", /(?<=(?:^|\n)[ \t]*(?:export[ \t]+)?)[A-Za-z_][A-Za-z0-9_.]*(?==)/],
  ["o", /=/],
  ["s", /(?<==)(?:"[^"\n]*"|'[^'\n]*'|[^\s#]+)/],
]);

const YAML = rules([
  ["c", /(?<![^\s])#[^\n]*/],
  ["v", /\$\{\{[^}\n]*\}\}/],
  ["p", /(?<=(?:^|\n)[ \t]*(?:-[ \t]+)?)[A-Za-z_][\w.-]*(?=:(?:[ \t]|$|\n))/],
  ["s", STRING_D],
  ["s", STRING_S],
  ["k", /\b(?:true|false|null|yes|no|on|off)\b/],
  ["n", NUMBER],
  ["o", /(?<=(?:^|\n)[ \t]*)-(?=[ \t])|:|\|/],
]);

const HTTP = rules([
  ["k", /(?<=^|\n)(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/],
  ["s", /(?<=(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) )\S+/],
  ["c", /HTTP\/\d(?:\.\d)?(?: \d{3}[^\n]*)?/],
  ["p", /(?<=^|\n)[A-Za-z][\w-]*(?=:)/],
  ["p", /"(?:\\.|[^"\\\n])*"(?=\s*:)/],
  ["s", STRING_D],
  ["n", NUMBER],
  ["k", /\b(?:true|false|null)\b/],
  ["o", /[{}[\],:]/],
]);

const MD = rules([
  ["c", /(?<=^|\n)(?:`{3,}|~{3,})[^\n]*/],
  ["k", /(?<=^|\n)#{1,6} [^\n]*/],
  ["o", /(?<=^|\n)(?:---|:::[a-z]*)(?=\n|$)/],
  ["a", /\[![A-Z]+\]/],
  ["s", /`[^`\n]+`/],
  ["f", /\[[^\]\n]*\]\([^)\n]*\)/],
  ["o", /(?<=(?:^|\n)[ \t]*)(?:[-*+]|\d+\.|>)(?= |\n|$)/],
  ["p", /(?<=^|\n)[a-z]+(?=: )/],
]);

const LANGS: Record<string, Rule[]> = {
  bash: BASH,
  sh: BASH,
  shell: BASH,
  zsh: BASH,
  json: JSON_RULES,
  jsonc: JSON_RULES,
  ts: TS,
  typescript: TS,
  js: TS,
  javascript: TS,
  tsx: TSX,
  jsx: TSX,
  env: ENV,
  dotenv: ENV,
  yaml: YAML,
  yml: YAML,
  http: HTTP,
  md: MD,
  markdown: MD,
};

export function highlight(code: string, lang: string): Token[] {
  const list = LANGS[lang];
  if (!list) return [{ t: null, v: code }];
  const out: Token[] = [];
  let plain = "";
  let i = 0;
  outer: while (i < code.length) {
    for (const [t, re] of list) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m[0].length > 0) {
        if (plain) {
          out.push({ t: null, v: plain });
          plain = "";
        }
        out.push({ t, v: m[0] });
        i += m[0].length;
        continue outer;
      }
    }
    plain += code[i];
    i++;
  }
  if (plain) out.push({ t: null, v: plain });
  return out;
}

/** The label shown in a code block's header when it has no title. */
export function languageLabel(lang: string): string {
  switch (lang) {
    case "bash":
    case "sh":
    case "shell":
    case "zsh":
      return "Terminal";
    case "json":
    case "jsonc":
      return "JSON";
    case "ts":
    case "typescript":
      return "TypeScript";
    case "tsx":
      return "TSX";
    case "js":
    case "javascript":
      return "JavaScript";
    case "jsx":
      return "JSX";
    case "env":
    case "dotenv":
      return ".env";
    case "yaml":
    case "yml":
      return "YAML";
    case "http":
      return "HTTP";
    case "md":
    case "markdown":
      return "Markdown";
    default:
      return "Text";
  }
}
