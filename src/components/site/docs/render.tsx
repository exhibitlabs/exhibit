import Link from "next/link";
import type { ReactNode } from "react";
import { Fragment } from "react";
import { CodeTabs } from "./CodeTabs";
import { CopyButton } from "./CopyButton";
import { highlight, languageLabel } from "./highlight";
import type { Block, CalloutKind, CodeBlock as CodeBlockNode, Inline, ListBlock } from "./markdown";
import { plainText } from "./markdown";

/* ------------------------------------------------------------------ inline */

const isInternal = (href: string) => href.startsWith("/") || href.startsWith("#");

export function DocLink({ href, children }: { href: string; children: ReactNode }) {
  if (isInternal(href)) {
    return (
      <Link href={href} className="d-link">
        {children}
      </Link>
    );
  }
  const mail = href.startsWith("mailto:");
  return (
    <a href={href} className="d-link d-link--ext" rel={mail ? undefined : "noopener"}>
      {children}
      {mail ? null : (
        <svg className="d-link__arrow" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M3.5 8.5l5-5M4.5 3.5h4v4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </a>
  );
}

/** Inline code with a soft break after each slash, so a long path can wrap at a slash when it must. */
function SlashBreaks({ text }: { text: string }) {
  const parts = text.split(/(?<=\/)/);
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < parts.length - 1 ? <wbr /> : null}
        </Fragment>
      ))}
    </>
  );
}

export function Inlines({ nodes, softBreaks = false }: { nodes: Inline[]; softBreaks?: boolean }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "text":
            return <Fragment key={i}>{n.value}</Fragment>;
          case "code":
            return (
              <code key={i} className="d-code">
                {softBreaks ? <SlashBreaks text={n.value} /> : n.value}
              </code>
            );
          case "strong":
            return (
              <strong key={i}>
                <Inlines nodes={n.children} softBreaks={softBreaks} />
              </strong>
            );
          case "em":
            return (
              <em key={i}>
                <Inlines nodes={n.children} softBreaks={softBreaks} />
              </em>
            );
          case "link":
            return (
              <DocLink key={i} href={n.href}>
                <Inlines nodes={n.children} softBreaks={softBreaks} />
              </DocLink>
            );
          case "image":
            // eslint-disable-next-line @next/next/no-img-element
            return <img key={i} src={n.src} alt={n.alt} className="d-inline-img" loading="lazy" />;
        }
      })}
    </>
  );
}

/* ------------------------------------------------------------------ code */

function CodeBody({ code, lang }: { code: string; lang: string }) {
  const tokens = highlight(code, lang);
  return (
    <pre className="d-pre" tabIndex={0}>
      <code data-lang={lang}>
        {tokens.map((tk, i) =>
          tk.t ? (
            <span key={i} className={`tk-${tk.t}`}>
              {tk.v}
            </span>
          ) : (
            <Fragment key={i}>{tk.v}</Fragment>
          ),
        )}
      </code>
    </pre>
  );
}

export function CodeBlock({ block }: { block: CodeBlockNode }) {
  return (
    <figure className="d-codeblock">
      <figcaption className="d-codeblock__bar">
        <span className={block.title ? "d-codeblock__title" : "d-codeblock__lang"}>{block.title ?? languageLabel(block.lang)}</span>
        <CopyButton text={block.code} />
      </figcaption>
      <CodeBody code={block.code} lang={block.lang} />
    </figure>
  );
}

/* ------------------------------------------------------------------ callouts */

const CALLOUT_LABEL: Record<CalloutKind, string> = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution",
};

function CalloutIcon({ kind }: { kind: CalloutKind }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "tip":
      return (
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path {...common} d="M7.5 14.5h5M8.25 17h3.5M10 2.75a5 5 0 0 0-3 9c.6.45 1 1.1 1 1.85v.4h4v-.4c0-.75.4-1.4 1-1.85a5 5 0 0 0-3-9z" />
        </svg>
      );
    case "important":
      return (
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path {...common} d="M10 2.75l7.25 7.25L10 17.25 2.75 10z" />
          <path {...common} d="M10 6.75v3.75M10 13.25v.01" />
        </svg>
      );
    case "warning":
      return (
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path {...common} d="M8.7 3.5L2.4 14.5a1.5 1.5 0 0 0 1.3 2.25h12.6a1.5 1.5 0 0 0 1.3-2.25L11.3 3.5a1.5 1.5 0 0 0-2.6 0z" />
          <path {...common} d="M10 7.75v3.5M10 14v.01" />
        </svg>
      );
    case "caution":
      return (
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <path {...common} d="M7.1 2.75h5.8l4.1 4.1v5.8l-4.1 4.1H7.1l-4.1-4.1v-5.8z" />
          <path {...common} d="M10 6.5v4.25M10 13.5v.01" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <circle {...common} cx="10" cy="10" r="7.25" />
          <path {...common} d="M10 9.25v4.5M10 6.5v.01" />
        </svg>
      );
  }
}

/* ------------------------------------------------------------------ blocks */

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function Cell({ nodes }: { nodes: Inline[] }) {
  const only = nodes.length === 1 ? nodes[0] : null;
  if (only && only.type === "code" && METHODS.has(only.value)) {
    return <span className={`d-method d-method--${only.value.toLowerCase()}`}>{only.value}</span>;
  }
  return <Inlines nodes={nodes} softBreaks />;
}

function List({ block }: { block: ListBlock }) {
  const items = block.items.map((it, i) => (
    <li key={i}>
      <Inlines nodes={it.content} />
      {it.children.map((child, j) => (
        <List key={j} block={child} />
      ))}
    </li>
  ));
  return block.ordered ? (
    <ol className="d-ol" start={block.start !== 1 ? block.start : undefined}>
      {items}
    </ol>
  ) : (
    <ul className="d-ul">{items}</ul>
  );
}

function HeadingTag({ level, id, children }: { level: 2 | 3 | 4; id: string; children: ReactNode }) {
  const Tag = (level === 2 ? "h2" : level === 3 ? "h3" : "h4") as "h2" | "h3" | "h4";
  return (
    <Tag id={id} className={`d-h${level}`}>
      {children}
      {level < 4 ? (
        <a href={`#${id}`} className="d-anchor" aria-label="Link to this section">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M6.5 9.5l3-3M7.25 4.75l1-1a2.47 2.47 0 0 1 3.5 3.5l-1 1M8.75 11.25l-1 1a2.47 2.47 0 0 1-3.5-3.5l1-1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </a>
      ) : null}
    </Tag>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return (
        <HeadingTag level={block.level} id={block.id}>
          <Inlines nodes={block.content} />
        </HeadingTag>
      );
    case "paragraph":
      return (
        <p>
          <Inlines nodes={block.content} />
        </p>
      );
    case "code":
      return <CodeBlock block={block} />;
    case "list":
      return <List block={block} />;
    case "callout":
      return (
        <aside className={`d-callout d-callout--${block.kind}`} aria-label={block.title ? plainText(block.title) : CALLOUT_LABEL[block.kind]}>
          <span className="d-callout__icon">
            <CalloutIcon kind={block.kind} />
          </span>
          <div className="d-callout__body">
            <p className="d-callout__title">{block.title ? <Inlines nodes={block.title} /> : CALLOUT_LABEL[block.kind]}</p>
            <Blocks blocks={block.blocks} />
          </div>
        </aside>
      );
    case "quote":
      return (
        <blockquote className="d-quote">
          <Blocks blocks={block.blocks} />
        </blockquote>
      );
    case "table": {
      const label = block.head.map((h) => plainText(h)).filter(Boolean).join(", ");
      const headers = block.head.map((h) => plainText(h));
      // Explicit roles keep the table semantics when phones restyle rows as stacked cards.
      return (
        <div className="d-table-wrap" role="region" aria-label={`Table: ${label}`} tabIndex={0}>
          <table className={`d-table d-table--cols-${Math.min(block.head.length, 6)}`} role="table">
            <thead role="rowgroup">
              <tr role="row">
                {block.head.map((h, i) => (
                  <th key={i} scope="col" role="columnheader" style={block.align[i] ? { textAlign: block.align[i]! } : undefined}>
                    <Inlines nodes={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {block.rows.map((row, r) => (
                <tr key={r} role="row">
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      role="cell"
                      data-label={headers[c] || undefined}
                      data-empty={cell.length === 0 || undefined}
                      style={block.align[c] ? { textAlign: block.align[c]! } : undefined}
                    >
                      <Cell nodes={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "image":
      return (
        <figure className="d-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.src} alt={block.alt} loading="lazy" />
          {block.alt ? <figcaption>{block.alt}</figcaption> : null}
        </figure>
      );
    case "hr":
      return <hr className="d-hr" />;
    case "steps":
      return (
        <ol className="d-steps">
          {block.steps.map((s, i) => (
            <li key={s.id} className="d-step">
              <span className="d-step__num" aria-hidden="true">
                {i + 1}
              </span>
              <HeadingTag level={3} id={s.id}>
                <Inlines nodes={s.title} />
              </HeadingTag>
              <div className="d-step__body">
                <Blocks blocks={s.blocks} />
              </div>
            </li>
          ))}
        </ol>
      );
    case "cards":
      return (
        <ul className="d-cards">
          {block.cards.map((c, i) => {
            const internal = isInternal(c.href);
            const inner = (
              <>
                <span className="d-card__title">
                  <Inlines nodes={c.title} />
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="d-card__arrow">
                    <path d="M3.5 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {c.description.length ? (
                  <span className="d-card__desc">
                    <Inlines nodes={c.description} />
                  </span>
                ) : null}
              </>
            );
            return (
              <li key={i}>
                {internal ? (
                  <Link href={c.href} className="d-card">
                    {inner}
                  </Link>
                ) : (
                  <a href={c.href} className="d-card" rel="noopener">
                    {inner}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      );
    case "tabs":
      return (
        <CodeTabs
          tabs={block.tabs.map((t) => ({
            title: t.title ?? languageLabel(t.lang),
            code: t.code,
            body: <CodeBody code={t.code} lang={t.lang} />,
          }))}
        />
      );
  }
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </>
  );
}
