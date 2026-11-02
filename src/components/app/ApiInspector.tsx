"use client";

import { clsx } from "clsx";
import { Check, Copy, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { dateTime } from "@/lib/format";

export type ApiRowLite = { id: number; at: string; meta: { method: string; path: string; status: number; ms: number; debugId?: string; requestId?: string; mode?: string } };
type Detail = { id: number; at: string; dispute_id: string | null; meta: ApiRowLite["meta"]; request: { headers?: Record<string, string>; body?: unknown } | null; response: unknown };

export function StatusPill({ status }: { status: number }) {
  return <span className={clsx("num inline-flex h-[20px] min-w-[38px] items-center justify-center rounded px-1.5 text-[11.5px] font-medium", status < 300 ? "bg-green-soft text-green" : status < 500 ? "bg-red-soft text-red" : "bg-red text-white")}>{status}</span>;
}

export function MethodTag({ method }: { method: string }) {
  return <span className={clsx("num inline-block w-11 shrink-0 text-[11.5px] font-medium", method === "GET" ? "text-muted" : "text-ink")}>{method}</span>;
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className={clsx("inline-flex h-6 items-center gap-1 rounded-md border border-line bg-surface px-1.5 text-[11px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink", className)}
    >
      {done ? <Check className="size-3 text-green" /> : <Copy className="size-3" />}
      {label !== "Copy" ? label : done ? "Copied" : "Copy"}
    </button>
  );
}

function Json({ value }: { value: unknown }) {
  const text = value === undefined || value === null ? "" : typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (!text) return <div className="rounded-lg bg-sunken px-3 py-2.5 text-[12px] text-muted">No body</div>;
  return (
    <div className="relative">
      <pre className="num scroll-thin max-h-[42vh] overflow-auto rounded-lg bg-sunken px-3 py-2.5 pr-16 text-[11.5px] leading-[1.6] text-ink-2">{text}</pre>
      <CopyButton text={text} className="absolute right-2 top-2" />
    </div>
  );
}

/** Request and response of one PayPal call: method, path, status, latency, debug id, sanitized bodies. */
export function ApiInspector({ id, onClose, mode }: { id: number | null; onClose: () => void; mode: string }) {
  // Keyed by call id, so switching calls never shows the previous call's bodies.
  const [loaded, setLoaded] = useState<{ id: number; detail?: Detail; error?: string } | null>(null);
  const detail = loaded?.id === id ? (loaded.detail ?? null) : null;
  const error = loaded?.id === id ? (loaded.error ?? null) : null;

  useEffect(() => {
    if (id === null) return;
    let live = true;
    fetch(`/api/activity/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("This call is no longer in the log."))))
      .then((d) => live && setLoaded({ id, detail: d }))
      .catch((e) => live && setLoaded({ id, error: e instanceof Error ? e.message : String(e) }));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      live = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [id, onClose]);

  if (id === null || typeof document === "undefined") return null;
  const m = detail?.meta;
  const host = "https://api-m.sandbox.paypal.com";
  const curl = m ? `curl -X ${m.method} '${host}${m.path}' \\\n  -H 'Authorization: Bearer $PAYPAL_ACCESS_TOKEN'${detail?.request?.headers?.["Content-Type"] === "application/json" && detail.request.body ? ` \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(detail.request.body)}'` : ""}` : "";

  return createPortal(
    <div className="app-shell fixed inset-0 z-[96]" role="dialog" aria-modal="true" aria-label="PayPal API call">
      <div className="ask-fade absolute inset-0 bg-black/10" onClick={onClose} />
      <aside className="pv-drawer absolute inset-y-0 right-0 flex w-[min(640px,100vw)] flex-col border-l border-line bg-surface shadow-[0_0_60px_rgb(0_0_0/0.14)]">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">{mode === "demo" ? "PayPal simulator · same request and response shapes as the live API" : "PayPal sandbox · live API"}</div>
            {m ? (
              <div className="mt-1.5 flex items-center gap-2">
                <MethodTag method={m.method} />
                <span className="num min-w-0 break-all text-[13px] text-ink">{m.path}</span>
              </div>
            ) : (
              <div className="mt-2 h-4 w-72 shimmer rounded" />
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <div className="scroll-thin flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {error ? <div className="rounded-lg bg-red-soft px-3 py-2.5 text-[12.5px] text-red">{error}</div> : null}
          {!detail && !error ? (
            <div className="flex items-center gap-2 text-[12.5px] text-muted">
              <Loader2 className="size-3.5 animate-spin" /> Loading the call
            </div>
          ) : null}
          {detail && m ? (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12.5px] sm:grid-cols-4">
                <div>
                  <dt className="text-muted">Status</dt>
                  <dd className="mt-1">
                    <StatusPill status={m.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Latency</dt>
                  <dd className="num mt-1 text-ink">{m.ms} ms</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted">When</dt>
                  <dd className="mt-1 text-ink">{dateTime(detail.at)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted">PayPal-Debug-Id</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <span className="num text-ink">{m.debugId ?? "none"}</span>
                    {m.debugId ? <CopyButton text={m.debugId} /> : null}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted">PayPal-Request-Id</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <span className="num truncate text-ink">{m.requestId ?? "none (not idempotent)"}</span>
                    {m.requestId ? <CopyButton text={m.requestId} /> : null}
                  </dd>
                </div>
              </dl>
              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">Request</h3>
                  <span className="text-[11px] text-faint">Authorization header never stored</span>
                </div>
                {detail.request?.headers && Object.keys(detail.request.headers).length ? (
                  <div className="num mb-2 space-y-0.5 rounded-lg border border-line px-3 py-2 text-[11.5px] text-ink-2">
                    {Object.entries(detail.request.headers).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-muted">{k}:</span> {v}
                      </div>
                    ))}
                    <div>
                      <span className="text-muted">Authorization:</span> Bearer [redacted]
                    </div>
                  </div>
                ) : null}
                <Json value={detail.request?.body} />
              </section>
              <section>
                <h3 className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.06em] text-muted">Response</h3>
                <Json value={detail.response} />
              </section>
              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">Reproduce</h3>
                  <span className="text-[11px] text-faint">bring your own sandbox token</span>
                </div>
                <Json value={curl} />
              </section>
            </>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
