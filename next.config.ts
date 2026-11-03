import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // A second dev server (e.g. demo mode on another port) can build into its own directory.
  distDir: process.env.EXHIBIT_DIST_DIR ?? ".next",
  // The static website deploy (scripts/build-site.mjs) has no image optimizer: serve the paintings as they are.
  images: { unoptimized: process.env.NEXT_PUBLIC_EXHIBIT_SITE_ONLY === "1" },
  // These packages ship native/worker code or spawn subprocesses; keep them out of the bundle.
  serverExternalPackages: ["@react-pdf/renderer", "@anthropic-ai/claude-agent-sdk"],
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
