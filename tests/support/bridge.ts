// A local HTTP server in front of Exhibit's real API route handlers, backed by the test database.
// It stands in for `next start`, so the MCP server (a separate process that only speaks HTTP) can be
// tested end to end with no build, no port 3000 and no credentials.
import http from "node:http";
import type { AddressInfo } from "node:net";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Response | Promise<Response>;
type RouteModule = Partial<Record<string, Handler>>;

const ROUTES: { pattern: RegExp; keys: string[]; load: () => Promise<unknown> }[] = [
  { pattern: /^\/api\/disputes$/, keys: [], load: () => import("@/app/api/disputes/route") },
  { pattern: /^\/api\/disputes\/([^/]+)\/state$/, keys: ["id"], load: () => import("@/app/api/disputes/[id]/state/route") },
  { pattern: /^\/api\/disputes\/([^/]+)\/run$/, keys: ["id"], load: () => import("@/app/api/disputes/[id]/run/route") },
  { pattern: /^\/api\/disputes\/([^/]+)\/packet$/, keys: ["id"], load: () => import("@/app/api/disputes/[id]/packet/route") },
  { pattern: /^\/api\/disputes\/([^/]+)\/act$/, keys: ["id"], load: () => import("@/app/api/disputes/[id]/act/route") },
  { pattern: /^\/api\/approvals$/, keys: [], load: () => import("@/app/api/approvals/route") },
  { pattern: /^\/api\/approvals\/([^/]+)$/, keys: ["id"], load: () => import("@/app/api/approvals/[id]/route") },
  { pattern: /^\/api\/prevention$/, keys: [], load: () => import("@/app/api/prevention/route") },
  { pattern: /^\/api\/overview$/, keys: [], load: () => import("@/app/api/overview/route") },
];

export type SeenRequest = { method: string; path: string; /** Sent by the test itself, not by the MCP server. */ direct: boolean };

export async function startBridge() {
  const seen: SeenRequest[] = [];
  const server = http.createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const method = req.method ?? "GET";
      seen.push({ method, path: url.pathname + url.search, direct: req.headers["x-test-client"] === "direct" });
      const route = ROUTES.find((r) => r.pattern.test(url.pathname));
      const handler = route && ((await route.load()) as RouteModule)[method];
      if (!route || !handler) {
        res.writeHead(route ? 405 : 404, { "content-type": "application/json" }).end(JSON.stringify({ error: `${method} ${url.pathname} is not served by the test bridge` }));
        return;
      }
      const values = (url.pathname.match(route.pattern) ?? []).slice(1).map(decodeURIComponent);
      const params = Object.fromEntries(route.keys.map((k, i) => [k, values[i]]));
      const request = new Request(url, { method, headers: req.headers as Record<string, string>, body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks) });
      const response = await handler(request, { params: Promise.resolve(params) });
      res.writeHead(response.status, Object.fromEntries(response.headers)).end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url,
    seen,
    /** Requests the MCP server made (the test's own `direct` calls excluded). */
    fromMcp: () => seen.filter((r) => !r.direct),
    /** A request as the merchant's browser would make it, from the Exhibit app's own origin. */
    asMerchant: (path: string, body: unknown) =>
      fetch(url + path, { method: "POST", headers: { "content-type": "application/json", "x-test-client": "direct", origin: url, "sec-fetch-site": "same-origin" }, body: JSON.stringify(body) }),
    /** A request from anywhere else: another site, a script, an agent with network access. */
    asOutsider: (path: string, body: unknown, headers: Record<string, string> = {}) =>
      fetch(url + path, { method: "POST", headers: { "content-type": "application/json", "x-test-client": "direct", ...headers }, body: JSON.stringify(body) }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
