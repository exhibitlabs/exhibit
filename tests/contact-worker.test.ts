// Guarantee: the site's Worker emails a contact message only when it should, and says "sent" only when it did.
// It answers 200 only after Cloudflare took the email. A failed or missing bot check, a filled honeypot, a
// message from another site, the wrong content type, an oversized or unreadable body, invalid fields or a
// missing secret all stop it before anything is sent, each with its own status. Every other request goes to
// the static assets untouched.
import { afterEach, describe, expect, it, vi } from "vitest";
import { FROM_ADDRESS, SITEVERIFY_URL, TO_ADDRESS, handleContact, type ContactDeps } from "../deploy/site/contact";

vi.mock("cloudflare:email", () => ({
  EmailMessage: class {
    constructor(
      readonly from: string,
      readonly to: string,
      readonly raw: string,
    ) {}
  },
}));

const NOW = Date.UTC(2026, 10, 4, 6, 0);
const THU_9_BERLIN = Date.UTC(2026, 10, 5, 8, 0);
const SITE = "https://exhibit.9to5code.com";

const message = {
  topic: "demo",
  name: "Ada Lovelace",
  email: "ada@example.com",
  company: "Acme",
  website: "acme.example",
  volume: "10 to 50",
  message: "Hello",
  times: [new Date(THU_9_BERLIN).toISOString()],
  timeZone: "Europe/Berlin",
  page: `${SITE}/contact`,
  referrer: "/pricing",
  token: "XXXX.DUMMY.TOKEN.XXXX",
  hp: "",
};

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${SITE}/api/contact`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: SITE, "cf-connecting-ip": "203.0.113.7", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

function setup(verdict: { success: boolean } | "down" | Error = { success: true }, sendError?: Error) {
  const sent: { from: string; to: string; raw: string }[] = [];
  const siteverify = vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () => {
    if (verdict instanceof Error) throw verdict;
    if (verdict === "down") return new Response("bad gateway", { status: 502 });
    return Response.json({ success: verdict.success, "error-codes": verdict.success ? [] : ["invalid-input-response"] });
  });
  const deps: ContactDeps = {
    secret: "test-secret",
    fetch: siteverify as unknown as typeof fetch,
    now: () => NOW,
    uuid: () => "0e9f3a2c-5b1d-4c7e-9a8b-1f2e3d4c5b6a",
    send: async (mail) => {
      if (sendError) throw sendError;
      sent.push(mail);
    },
  };
  return { deps, sent, siteverify };
}
const json = async (res: Response) => ({ status: res.status, body: (await res.json()) as Record<string, unknown> });

afterEach(() => vi.restoreAllMocks());

describe("a good message", () => {
  it("is checked with Turnstile, emailed to the founders, and only then answered 200", async () => {
    const { deps, sent, siteverify } = setup();
    expect(await json(await handleContact(post(message), deps))).toEqual({ status: 200, body: { ok: true } });

    expect(siteverify).toHaveBeenCalledOnce();
    const [url, init] = siteverify.mock.calls[0];
    expect(url).toBe(SITEVERIFY_URL);
    expect(Object.fromEntries(init!.body as URLSearchParams)).toEqual({ secret: "test-secret", response: "XXXX.DUMMY.TOKEN.XXXX", remoteip: "203.0.113.7", idempotency_key: "0e9f3a2c-5b1d-4c7e-9a8b-1f2e3d4c5b6a" });

    expect(sent).toHaveLength(1);
    const { from, to, raw } = sent[0];
    expect([from, to]).toEqual([FROM_ADDRESS, TO_ADDRESS]);
    const head = raw.slice(0, raw.indexOf("\r\n\r\n")).replace(/\r\n /g, " ");
    expect(head).toContain(`From: "Ada Lovelace via Exhibit" <${FROM_ADDRESS}>`);
    expect(head).toContain(`To: <${TO_ADDRESS}>`);
    expect(head).toContain('Reply-To: "Ada Lovelace" <ada@example.com>');
    expect(head).toContain("Subject: Demo request: Ada Lovelace, Acme");
    expect(head).toContain("Message-ID: <0e9f3a2c-5b1d-4c7e-9a8b-1f2e3d4c5b6a@exhibit.9to5code.com>");
    const body = raw.replace(/=\r\n/g, "").replace(/=3D/g, "=");
    expect(body).toContain("- Thu 5 Nov, 09:00 Berlin time (GMT+1) = 13:30 IST");
    expect(body).toContain("Came from: /pricing");
    expect(body).toContain("Sent: Wed 4 Nov 2026, 06:00 UTC (11:30 IST)");
  });

  it("sends a question without times", async () => {
    const { deps, sent } = setup();
    const res = await handleContact(post({ ...message, topic: "question", message: "Do you support Stripe?", times: undefined }), deps);
    expect(res.status).toBe(200);
    expect(sent[0].raw).toContain("Subject: Question: Ada Lovelace, Acme");
    expect(sent[0].raw).not.toContain("Times that suit me");
  });
});

describe("nothing is sent", () => {
  it.each([
    ["the bot check fails", { success: false }, 403, "bot_check_failed"],
    ["siteverify is down", "down", 503, "bot_check_unavailable"],
    ["siteverify can't be reached", new Error("network"), 503, "bot_check_unavailable"],
  ] as const)("when %s", async (_label, verdict, status, error) => {
    const { deps, sent } = setup(verdict);
    expect(await json(await handleContact(post(message), deps))).toMatchObject({ status, body: { ok: false, error } });
    expect(sent).toEqual([]);
  });

  it("without a token, and siteverify isn't asked", async () => {
    for (const token of ["", undefined, 42, "x".repeat(2049)]) {
      const { deps, sent, siteverify } = setup();
      expect(await json(await handleContact(post({ ...message, token }), deps))).toMatchObject({ status: 403, body: { error: "bot_check_failed" } });
      expect(siteverify).not.toHaveBeenCalled();
      expect(sent).toEqual([]);
    }
  });

  it("when the honeypot is filled in", async () => {
    const { deps, sent, siteverify } = setup();
    expect(await json(await handleContact(post({ ...message, hp: "http://spam.example" }), deps))).toMatchObject({ status: 400, body: { error: "rejected" } });
    expect(siteverify).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it("when fields are invalid, and the form hears which ones", async () => {
    const { deps, sent, siteverify } = setup();
    const res = await json(await handleContact(post({ ...message, name: "", email: "ada@example.com\r\nBcc: evil@example.com" }), deps));
    expect(res).toMatchObject({ status: 400, body: { error: "invalid", fields: { name: "Please add your name.", email: "That email address doesn't look complete." } } });
    expect(siteverify).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it("when the secret isn't set", async () => {
    const { deps, sent, siteverify } = setup();
    expect(await json(await handleContact(post(message), { ...deps, secret: undefined }))).toMatchObject({ status: 500, body: { error: "not_configured" } });
    expect(siteverify).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it("from another site's page", async () => {
    const { deps, sent } = setup();
    expect((await handleContact(post(message, { origin: "https://evil.example" }), deps)).status).toBe(403);
    expect((await handleContact(post(message, { origin: "null" }), deps)).status).toBe(403);
    expect(sent).toEqual([]);
    // Local development hosts and requests without an Origin (curl) still go through to the checks.
    expect((await handleContact(post(message, { origin: "http://localhost:8799" }), deps)).status).toBe(200);
  });

  it("unless it is JSON", async () => {
    const { deps, sent } = setup();
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", "application/jsonp"]) {
      expect((await handleContact(post(message, { "content-type": type }), deps)).status).toBe(415);
    }
    expect((await handleContact(post(message, { "content-type": "application/json; charset=utf-8" }), deps)).status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it("when the body is over 16 KB, whether or not it says so", async () => {
    const { deps, sent } = setup();
    const big = { ...message, message: "x".repeat(20_000) };
    expect((await handleContact(post(big), deps)).status).toBe(413);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < 40; i++) c.enqueue(new TextEncoder().encode("x".repeat(1000)));
        c.close();
      },
    });
    const chunked = new Request(`${SITE}/api/contact`, { method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
    expect((await handleContact(chunked, deps)).status).toBe(413);
    expect(sent).toEqual([]);
  });

  it("when the body isn't a JSON object", async () => {
    const { deps, sent } = setup();
    for (const body of ["{not json", "[]", "null", '"text"', ""]) {
      expect(await json(await handleContact(post(body), deps))).toMatchObject({ status: 400, body: { error: "bad_request" } });
    }
    expect(sent).toEqual([]);
  });
});

describe("when Cloudflare refuses the email", () => {
  it("answers 502, never 200", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps } = setup({ success: true }, new Error("destination address not verified"));
    expect(await json(await handleContact(post(message), deps))).toMatchObject({ status: 502, body: { ok: false, error: "send_failed" } });
    expect(console.error).toHaveBeenCalledWith("contact: Cloudflare refused the email:", "destination address not verified");
  });
});

describe("the Worker", () => {
  it("answers POST /api/contact itself and passes everything else to the static assets", async () => {
    const { default: worker } = await import("../deploy/site/worker");
    const assets = vi.fn(async (req: Request) => new Response(`asset ${new URL(req.url).pathname}`, { status: req.url.endsWith("/nope") ? 404 : 200 }));
    const sendEmail = vi.fn<(message: unknown) => Promise<void>>(async () => {});
    const env = { ASSETS: { fetch: assets }, SEND_EMAIL: { send: sendEmail }, TURNSTILE_SECRET: undefined };

    for (const [method, path] of [["GET", "/"], ["GET", "/contact"], ["GET", "/api/contact"], ["GET", "/nope"], ["POST", "/contact"]]) {
      const res = await worker.fetch(new Request(`${SITE}${path}`, { method, body: method === "POST" ? "{}" : undefined }), env);
      expect(await res.text()).toBe(`asset ${path}`);
    }
    expect(assets).toHaveBeenCalledTimes(5);

    // Without the secret the Worker refuses to send; the route is still its own, not an asset. (A question, so
    // no proposed time can have passed whenever this runs: the Worker uses the real clock.)
    const res = await worker.fetch(post({ ...message, topic: "question", times: undefined }), env);
    expect(await json(res)).toMatchObject({ status: 500, body: { error: "not_configured" } });
    expect(assets).toHaveBeenCalledTimes(5);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
