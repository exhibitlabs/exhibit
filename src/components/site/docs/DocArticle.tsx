import Link from "next/link";
import type { ReactNode } from "react";
import { DOCS_EDIT_BASE, getDocProblems, getPrevNext, type DocPage } from "./content";
import { Blocks } from "./render";
import { DocsToc } from "./Toc";

function Pager({ page }: { page: DocPage }) {
  const { prev, next } = getPrevNext(page);
  if (!prev && !next) return null;
  return (
    <nav aria-label="Previous and next page" className="d-pager">
      {prev ? (
        <Link href={prev.href} className="d-pager__link d-pager__link--prev" rel="prev">
          <span className="d-pager__dir">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M12.5 8h-9M7.5 4l-4 4 4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Previous
          </span>
          <span className="d-pager__title">{prev.title}</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      {next ? (
        <Link href={next.href} className="d-pager__link d-pager__link--next" rel="next">
          <span className="d-pager__dir">
            Next
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M3.5 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="d-pager__title">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}

/** "On this page" for screens without the right-hand column: a native disclosure, no script. */
function InlineToc({ page }: { page: DocPage }) {
  const headings = page.doc.headings;
  if (!page.toc || headings.length < 2) return null;
  return (
    <details className="d-inline-toc">
      <summary>
        <span>On this page</span>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M4.5 6.5L8 10l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <ul>
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? "is-sub" : undefined}>
            <a href={`#${h.id}`}>{h.text}</a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function DevProblems({ page }: { page: DocPage }) {
  const problems = getDocProblems(page);
  if (!problems.length) return null;
  return (
    <div className="d-devcheck" role="status">
      <p>
        <strong>Docs check</strong> (development only): {page.file}
      </p>
      <ul>
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

/** One docs page: the header, the rendered Markdown, the pager and "On this page". */
export function DocArticle({ page, hero }: { page: DocPage; hero?: ReactNode }) {
  const showToc = page.toc && page.doc.headings.length > 0;
  return (
    <div className={showToc ? "d-page" : "d-page d-page--notoc"}>
      <article className="d-article" aria-labelledby="d-title">
        <header className={hero ? "d-header d-header--hero" : "d-header"}>
          <div className="d-header__text">
            <p className="d-kicker">{page.section}</p>
            <h1 id="d-title" className="d-title">
              {page.title}
            </h1>
            <p className="d-lead">{page.description}</p>
          </div>
          {hero ? <div className="d-header__art">{hero}</div> : null}
        </header>
        <DevProblems page={page} />
        <InlineToc page={page} />
        <div className="d-prose">
          <Blocks blocks={page.doc.blocks} />
        </div>
        <footer className="d-article__foot">
          <a className="d-edit" href={`${DOCS_EDIT_BASE}/${page.file}`} rel="noopener">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M9.75 3.25l3 3M2.75 13.25l.75-3.25 7.5-7.5a1.41 1.41 0 0 1 2 2l-7.5 7.5z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            Edit this page on GitHub
          </a>
          <Pager page={page} />
        </footer>
      </article>
      {showToc ? (
        <div className="d-toc-col">
          <DocsToc headings={page.doc.headings} />
        </div>
      ) : null}
    </div>
  );
}
