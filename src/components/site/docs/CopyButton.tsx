"use client";

import { useEffect, useRef, useState } from "react";

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers or contexts without the async clipboard API.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/** Copies a code block's text. Announces the result to screen readers. */
export function CopyButton({ text, label = "Copy code" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <button
      type="button"
      className="d-copy"
      data-state={state}
      aria-label={state === "copied" ? "Copied" : label}
      onClick={async () => {
        const ok = await writeClipboard(text);
        setState(ok ? "copied" : "failed");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "copied" ? (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <rect x="5.25" y="5.25" width="8" height="8" rx="1.75" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M10.75 3.25v-.5a1.5 1.5 0 0 0-1.5-1.5h-5.5a1.5 1.5 0 0 0-1.5 1.5v5.5a1.5 1.5 0 0 0 1.5 1.5h.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      )}
      <span className="d-copy__text">{state === "copied" ? "Copied" : state === "failed" ? "Press Ctrl+C" : "Copy"}</span>
      <span className="d-sr" aria-live="polite">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Copy failed" : ""}
      </span>
    </button>
  );
}
