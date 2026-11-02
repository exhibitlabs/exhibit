// .mts because the project is CommonJS-typed and Vite warns about an ESM config in a .ts file there.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // `server-only` throws outside a React Server Component bundle; under test it is a no-op.
      { find: /^server-only$/, replacement: at("./tests/support/empty.ts") },
      { find: /^@\//, replacement: at("./src/") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Forces demo mode, the replay AI provider and a private data dir, and blocks the network.
    setupFiles: ["tests/support/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
