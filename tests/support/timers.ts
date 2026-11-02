import { vi } from "vitest";

/**
 * The simulator adds 60-200 ms of fake network latency per call and the replay provider paces its
 * output with sleeps. Neither matters to what the tests check, so timers fire on the next microtask.
 * Do not use it in tests that talk to another process (it would also fire that client's timeouts).
 * Call vi.restoreAllMocks() to put the real timers back.
 */
export function instantTimers() {
  return vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: (...a: unknown[]) => void, _ms?: number, ...args: unknown[]) => {
    queueMicrotask(() => fn(...args));
    // Enough of a Timeout for callers that unref() it.
    const timer = { ref: () => timer, unref: () => timer, hasRef: () => false, refresh: () => timer, [Symbol.toPrimitive]: () => 0 };
    return timer;
  }) as unknown as typeof setTimeout);
}
