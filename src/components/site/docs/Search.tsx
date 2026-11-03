"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { SEARCH_INDEX_URL, type SearchEntryData } from "./types";

/* ------------------------------------------------------------------ index and scoring */

let indexPromise: Promise<SearchEntryData[]> | null = null;
function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(SEARCH_INDEX_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .catch((e) => {
        indexPromise = null;
        throw e;
      });
  }
  return indexPromise;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
const wordStart = (hay: string, t: string) => hay.startsWith(t) || new RegExp(`[^a-z0-9]${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(hay);

type Result = { entry: SearchEntryData; score: number };

function runSearch(index: SearchEntryData[], query: string): Result[] {
  const q = norm(query.trim());
  const terms = q.split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const results: Result[] = [];
  for (const entry of index) {
    const page = norm(entry.page);
    const heading = norm(entry.heading);
    const text = norm(entry.text);
    let score = 0;
    let all = true;
    for (const t of terms) {
      let s = 0;
      if (page.includes(t)) s += wordStart(page, t) ? 12 : 7;
      if (heading.includes(t)) s += wordStart(heading, t) ? 10 : 6;
      if (text.includes(t)) s += (wordStart(text, t) ? 3 : 1.5) + Math.min(text.split(t).length - 1, 6) * 0.35;
      if (!s) {
        all = false;
        break;
      }
      score += s;
    }
    if (!all) continue;
    // The exact phrase beats the same words scattered through a section.
    if (terms.length > 1 && (heading.includes(q) || text.includes(q) || page.includes(q))) score += 18;
    if (!entry.heading) score += 1.5;
    results.push({ entry, score });
  }
  results.sort((a, b) => b.score - a.score);
  // Keep the list varied: at most three hits from one page.
  const perPage = new Map<string, number>();
  const out: Result[] = [];
  for (const r of results) {
    const n = perPage.get(r.entry.page) ?? 0;
    if (n >= 3) continue;
    perPage.set(r.entry.page, n + 1);
    out.push(r);
    if (out.length >= 10) break;
  }
  return out;
}

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}
    </>
  );
}

function snippet(text: string, terms: string[]): string {
  if (!text) return "";
  const lower = norm(text);
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return text.length > 150 ? text.slice(0, 150).trimEnd() + "…" : text;
  const start = Math.max(0, at - 50);
  const end = Math.min(text.length, at + 110);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

/* ------------------------------------------------------------------ context */

const SearchContext = createContext<{ open: () => void } | null>(null);

/** Owns the search dialog and its shortcuts (Cmd or Ctrl + K, and /). Wrap the docs layout in it. */
export function DocsSearchProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setOpen] = useState(false);

  const open = useCallback(() => {
    const d = dialogRef.current;
    if (d && !d.open) {
      d.showModal();
      setOpen(true);
    }
  }, []);
  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (dialogRef.current?.open) close();
        else open();
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <SearchContext.Provider value={value}>
      {children}
      <dialog
        ref={dialogRef}
        className="d-search"
        aria-label="Search the docs"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // A click on the backdrop (the dialog element itself) closes it.
          if (e.target === dialogRef.current) close();
        }}
      >
        {isOpen ? <SearchPanel onDone={close} /> : null}
      </dialog>
    </SearchContext.Provider>
  );
}

export function SearchTrigger({ variant = "bar" }: { variant?: "bar" | "icon" }) {
  const ctx = useContext(SearchContext);
  // The platform is only knowable in the browser; the server renders the Mac hint.
  const mac = useSyncExternalStore(noopSubscribe, isMacPlatform, () => true);
  if (variant === "icon") {
    return (
      <button type="button" className="d-search-icon" aria-label="Search the docs" onClick={() => ctx?.open()}>
        <SearchGlyph />
      </button>
    );
  }
  return (
    <button type="button" className="d-search-trigger" onClick={() => ctx?.open()} aria-keyshortcuts="Meta+K Control+K /">
      <SearchGlyph />
      <span className="d-search-trigger__label">Search docs</span>
      <kbd className="d-kbd" aria-hidden="true">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}

const noopSubscribe = () => () => {};
const isMacPlatform = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function SearchGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5l3.25 3.25" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ panel */

function SearchPanel({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchEntryData[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    loadIndex().then(setIndex, () => setFailed(true));
  }, []);

  const results = useMemo(() => (index ? runSearch(index, query) : []), [index, query]);
  const terms = useMemo(() => norm(query.trim()).split(/\s+/).filter(Boolean), [query]);

  const go = (href: string) => {
    onDone();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (results.length ? (a + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active].entry.href);
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  return (
    <div className="d-search__panel">
      <div className="d-search__field">
        <SearchGlyph />
        <input
          ref={inputRef}
          type="search"
          className="d-search__input"
          placeholder="Search the docs"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results.length ? `${listId}-opt-${active}` : undefined}
          aria-autocomplete="list"
          aria-label="Search the docs"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" className="d-search__esc" onClick={onDone}>
          Esc
        </button>
      </div>
      <div className="d-search__body">
        {failed ? (
          <p className="d-search__empty">Search could not load. Use the sidebar instead.</p>
        ) : !index ? (
          <p className="d-search__empty">Loading…</p>
        ) : !query.trim() ? (
          <p className="d-search__empty">Search commands, environment variables, endpoints and tools.</p>
        ) : results.length === 0 ? (
          <p className="d-search__empty">No results for “{query.trim()}”.</p>
        ) : null}
        <ul id={listId} role="listbox" aria-label="Results" className="d-search__list" hidden={!results.length}>
          {results.map((r, i) => (
            <li
              key={r.entry.href + i}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className="d-search__item"
              onMouseMove={() => setActive(i)}
              onClick={() => go(r.entry.href)}
            >
              <span className="d-search__crumb">
                {r.entry.section} <span aria-hidden="true">/</span> {r.entry.page}
              </span>
              <span className="d-search__heading">
                <Highlighted text={r.entry.heading || r.entry.page} terms={terms} />
              </span>
              {r.entry.text ? (
                <span className="d-search__snippet">
                  <Highlighted text={snippet(r.entry.text, terms)} terms={terms} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <p className="d-search__foot" aria-hidden="true">
        <span>
          <kbd className="d-kbd">↑</kbd>
          <kbd className="d-kbd">↓</kbd> to move
        </span>
        <span>
          <kbd className="d-kbd">↵</kbd> to open
        </span>
        <span>
          <kbd className="d-kbd">Esc</kbd> to close
        </span>
      </p>
    </div>
  );
}
