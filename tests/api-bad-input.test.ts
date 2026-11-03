// Guarantee: a request the API can't make sense of gets a 4xx and changes nothing. No run starts on a
// dispute PayPal doesn't have (or spends a model call on one), a malformed id list never falls through to
// "investigate everything", and a body that is not a PayPal event never reaches the audit log.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as batch } from "@/app/api/batch/route";
import { POST as run } from "@/app/api/disputes/[id]/run/route";
import { POST as webhook } from "@/app/api/webhooks/paypal/route";
import { listActivity } from "@/lib/db";
import { latestRun } from "@/lib/disputes";
import { installCase, resetState } from "./support/fixtures";
import { instantTimers } from "./support/timers";

beforeEach(() => {
  instantTimers();
  resetState();
});
afterEach(() => vi.restoreAllMocks());

const APP = "http://localhost:3101";
const post = (path: string, body?: string) => new Request(`${APP}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body });
const started = () => listActivity().filter((a) => a.message.startsWith("Exhibit started"));

describe("starting a run", () => {
  it("is a 404 for a dispute PayPal has no record of, and nothing starts", async () => {
    const res = await run(post("/api/disputes/PP-D-NOPE/run"), { params: Promise.resolve({ id: "PP-D-NOPE" }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "PayPal has no dispute PP-D-NOPE." });
    expect(latestRun("PP-D-NOPE")).toBeUndefined();
    expect(started()).toEqual([]);
  });
});

describe("the batch route", () => {
  it.each([["a string", '{"ids":"PP-D-1"}'], ["a number", '{"ids":7}'], ["an object", '{"ids":{"0":"PP-D-1"}}'], ["null", '{"ids":null}']])("refuses ids that are %s instead of falling back to every case", async (_label, body) => {
    installCase(); // an open dispute with no brief: what "investigate everything" would have run on

    const res = await batch(post("/api/batch", body));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ids/);
    expect(started()).toEqual([]);
  });

  it("accepts a list, and ignores ids that are not open disputes", async () => {
    installCase();

    const res = await batch(post("/api/batch", JSON.stringify({ ids: ["PP-D-NOPE"] })));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ queued: [] });
  });
});

describe("the PayPal webhook", () => {
  it.each([["not JSON", "garbage"], ["JSON null", "null"], ["an empty object", "{}"], ["a list", "[]"], ["an event with no type", '{"id":"WH-1","resource":{"dispute_id":"PP-D-1"}}'], ["a type that is not a string", '{"id":"WH-1","event_type":7}']])("rejects %s with a 400 and logs nothing", async (_label, body) => {
    const res = await webhook(post("/api/webhooks/paypal", body));

    expect(res.status).toBe(400);
    expect(listActivity({ kind: "webhook" })).toEqual([]);
  });

  it("acknowledges a real event and logs it", async () => {
    const res = await webhook(post("/api/webhooks/paypal", JSON.stringify({ id: "WH-1", event_type: "CUSTOMER.DISPUTE.UPDATED" })));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(listActivity({ kind: "webhook" }).map((a) => a.message)).toEqual(["CUSTOMER.DISPUTE.UPDATED"]);
  });
});
