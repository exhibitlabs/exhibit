// Everything the public site states as a fact lives here or in ./records (exported from real runs by
// ./records/export.mjs). Edit these constants rather than the components.

export const SITE_URL = "https://exhibit.9to5code.com";
export const GITHUB_URL = "https://github.com/shvuuuu/exhibit";
export const FOUNDER_GITHUB_URL = "https://github.com/shvuuuu";
export const DEMO_URL = "/app";

/**
 * The demo video (YouTube). Leave empty and the "Watch the demo" button is hidden.
 * Example: "https://www.youtube.com/watch?v=XXXXXXXXXXX"
 */
export const DEMO_VIDEO_URL = "";

/**
 * Evaluation on labelled cases. Leave null until it has been measured; the block renders only
 * when this is filled in. Every field must come from a real, reproducible run.
 */
export const EVALUATION: null | {
  /** Number of labelled cases. */
  cases: number;
  /** Share of cases where Exhibit's decision matched the label, 0 to 100. */
  agreementRate: number;
  /** Median minutes from "Run" to a finished, validated brief. */
  minutesPerCase: number;
  /** Share of should-refund cases that Exhibit refunded, 0 to 100. Optional. */
  correctlyRefunded?: number;
  /** One sentence on how the cases and labels were made, e.g. "30 synthetic cases, labels written before the run". */
  method: string;
  /** Where the method and raw results live, e.g. a file on GitHub. */
  url?: string;
} = null;

/** PayPal's agent tools reference, retrieved 2026-11-03. Dispute tools, quoted. */
export const PAYPAL_AGENT_TOOLS = {
  url: "https://developer.paypal.com/ai-tools/agent-tools/",
  retrieved: "2026-11-03",
  tools: [
    { name: "list_disputes", description: "Retrieve a summary of all disputes with optional filtering." },
    { name: "get_dispute", description: "Retrieve detailed information about a specific dispute." },
    { name: "accept_dispute_claim", description: "Accept a dispute claim, resolving it in favor of the buyer." },
  ],
};

/**
 * PayPal's own published rule for its MCP gateway, quoted verbatim from the live post (retrieved
 * 2026-11-03). The post was first shared at /community/blog/One_connection_2000_tools; that address
 * now redirects to the blog index, and the current text is what is quoted here.
 */
export const PAYPAL_MCP_QUOTE = {
  text: "Authorization is checked again before a selected tool is executed.",
  title: "What We Learned Building PayPal's MCP Gateway",
  author: "PayPal Cosmos.AI Agentic Platform Team",
  date: "Oct 8, 2026",
  url: "https://developer.paypal.com/community/blog/PayPal_MCP_Gateway",
};

/**
 * PayPal US business fees page ("Last Updated: October 1, 2026"). First read 2026-10-21 (docs/sources), checked
 * again 2026-11-03. The old /us/webapps/mpp/merchant-fees address redirects here.
 */
export const PAYPAL_FEES = {
  url: "https://www.paypal.com/us/business/paypal-business-fees",
  updated: "Oct 1, 2026",
  retrieved: "Nov 3, 2026",
  quote: "We may charge a Dispute Fee when a buyer files a dispute claim or chargeback …",
  fees: [
    { amount: 15, label: "Standard dispute fee", note: "PayPal checkout payments" },
    { amount: 30, label: "High-volume dispute fee", note: "Sellers over PayPal's high-volume threshold" },
    { amount: 20, label: "Card chargeback fee", note: "Card payments not made through a PayPal account" },
  ],
};

export const PRICING = {
  label: "Planned pricing",
  line: "Free to try. Then a share of what Exhibit recovers. If it recovers nothing, you pay nothing.",
  note: "Exhibit is not on sale yet. This is the model we plan to launch with.",
};

export const FOUNDER = {
  name: "Shivansh Dwivedi",
  role: "Founder, KaDeep AI",
  city: "Mumbai",
  firstCommit: "Oct 20, 2026",
};
