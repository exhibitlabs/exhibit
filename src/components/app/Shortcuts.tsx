"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "../ui/Dialog";
import { Kbd } from "../ui/Kbd";

const GO: Record<string, { href: string; label: string }> = {
  o: { href: "/app", label: "Overview" },
  d: { href: "/app/disputes", label: "Disputes" },
  p: { href: "/app/protection", label: "Prevention" },
  a: { href: "/app/autopilot", label: "Autopilot" },
  r: { href: "/app/approvals", label: "Agent requests" },
  l: { href: "/app/activity", label: "PayPal activity" },
  s: { href: "/app/settings", label: "Settings" },
};

const GROUPS: { title: string; rows: [React.ReactNode, string][] }[] = [
  {
    title: "Anywhere",
    rows: [
      [
        <>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </>,
        "Ask Exhibit, or jump to a case",
      ],
      [<Kbd key="n">N</Kbd>, "Notifications"],
      [<Kbd key="q">?</Kbd>, "This list"],
      [<Kbd key="e">Esc</Kbd>, "Close a dialog, drawer or palette"],
    ],
  },
  {
    title: "Go to",
    rows: Object.entries(GO).map(([k, v]) => [
      <>
        <Kbd>G</Kbd>
        <Kbd>{k.toUpperCase()}</Kbd>
      </>,
      v.label,
    ]),
  },
  {
    title: "Disputes",
    rows: [[<Kbd key="s">/</Kbd>, "Search disputes"]],
  },
  {
    title: "Case page",
    rows: [
      [
        <>
          <Kbd>J</Kbd>
          <Kbd>K</Kbd>
        </>,
        "Next or previous case, by deadline",
      ],
      [<Kbd key="r">R</Kbd>, "Run or re-run Exhibit"],
      [<Kbd key="e">E</Kbd>, "Edit the response to PayPal"],
      [<Kbd key="1">1–5</Kbd>, "Switch the case tabs"],
    ],
  },
];

const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/** Global keys. Page-level keys (R, E, J, 1–5, /) are re-broadcast as exhibit:key for the page to handle. */
export function Shortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pendingG = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || e.defaultPrevented) return;
      if (document.querySelector("[aria-modal=true]")) return;
      const k = e.key.toLowerCase();
      if (pendingG.current && Date.now() - pendingG.current < 1200 && GO[k]) {
        e.preventDefault();
        pendingG.current = 0;
        router.push(GO[k].href);
        return;
      }
      pendingG.current = 0;
      if (k === "g") {
        pendingG.current = Date.now();
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (k === "n") {
        e.preventDefault();
        window.dispatchEvent(new Event("exhibit:notifications"));
        return;
      }
      if (["/", "r", "e", "j", "k", "1", "2", "3", "4", "5"].includes(k)) {
        const ev = new CustomEvent("exhibit:key", { detail: k, cancelable: true });
        window.dispatchEvent(ev);
        if (ev.defaultPrevented) e.preventDefault();
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("exhibit:shortcuts", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("exhibit:shortcuts", onOpen);
    };
  }, [router]);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts" width={600}>
      <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-1 text-[13px] font-medium text-ink">{g.title}</div>
            <ul>
              {g.rows.map(([keys, label], i) => (
                <li key={i} className="flex min-h-8 items-center justify-between gap-3 border-b border-rule py-1 text-[13px] text-ink-2 last:border-0">
                  <span>{label}</span>
                  <span className="flex shrink-0 gap-0.5">{keys}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

/** Subscribes a page to re-broadcast keys. Return true from the handler to claim the key. */
export function usePageKeys(handler: (key: string) => boolean | void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const on = (e: Event) => {
      if (ref.current((e as CustomEvent<string>).detail)) e.preventDefault();
    };
    window.addEventListener("exhibit:key", on);
    return () => window.removeEventListener("exhibit:key", on);
  }, []);
}
