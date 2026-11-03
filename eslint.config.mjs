import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Extra build outputs (a second dev server, CI build checks) and test coverage.
    ".next-*/**",
    "coverage/**",
    // The static website build (scripts/build-site.mjs) and wrangler's local state.
    "deploy/site/dist/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
