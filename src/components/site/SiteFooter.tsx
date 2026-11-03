import Link from "next/link";
import { FOUNDER_GITHUB_URL, FOUNDERS } from "@/components/landing/data";
import { LogoMark } from "@/components/ui/Logo";
import { DotWordmark } from "./dots/DotArt";
import { FOOTER_COLUMNS, ROUTES } from "./nav";
import { PAINTING_LIST } from "./paintings";

/** The site's close: about line, full sitemap, painting credits, the monumental dotted wordmark, legal row. */
export function SiteFooter() {
  const year = 2026;
  return (
    <footer className="s-foot" aria-labelledby="s-foot-title">
      <h2 id="s-foot-title" className="s-sr-only">
        Site footer
      </h2>
      <div className="s-wrap">
        <div className="s-foot__top">
          <div className="s-foot__about">
            <Link href={ROUTES.home} className="s-brand" aria-label="Exhibit, home">
              <LogoMark size={22} />
              <span aria-hidden>Exhibit</span>
            </Link>
            <p>
              The AI dispute agent for PayPal merchants. Built by {FOUNDERS[0].name} and {FOUNDERS[1].name} for the PayPal AI Hackathon 2026.
            </p>
          </div>
          <nav className="s-foot__cols" aria-label="Sitemap">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h2>{col.title}</h2>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.external ? (
                        <a href={l.href} target="_blank" rel="noopener noreferrer">
                          {l.label}
                          <span className="s-sr-only"> (opens in a new tab)</span>
                        </a>
                      ) : (
                        <Link href={l.href}>{l.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="s-foot__credits">
          <h2>Paintings on this site</h2>
          <ol>
            {PAINTING_LIST.map((p) => (
              <li key={p.id}>
                <span className="s-cap__plate">Plate {p.plate}</span>
                <span>
                  {p.artist},{" "}
                  <a href={p.page} target="_blank" rel="noopener noreferrer">
                    <em className="s-serif-title">{p.title}</em>
                    <span className="s-sr-only"> (opens in a new tab)</span>
                  </a>
                  , {p.date}. {p.museum}, {p.license}
                  {p.via ? `, ${p.via}` : ""}.
                </span>
              </li>
            ))}
          </ol>
        </div>

        <DotWordmark className="s-foot__mark" />

        <div className="s-foot__legal">
          <p style={{ margin: 0 }}>© {year} Exhibit. Open source under the MIT licence. Not affiliated with or endorsed by PayPal.</p>
          <ul>
            <li>
              <Link href={ROUTES.legal.privacy}>Privacy</Link>
            </li>
            <li>
              <Link href={ROUTES.legal.terms}>Terms</Link>
            </li>
            <li>
              <a href={ROUTES.github} target="_blank" rel="noopener noreferrer">
                GitHub<span className="s-sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a href={FOUNDER_GITHUB_URL} target="_blank" rel="noopener noreferrer">
                {FOUNDERS[0].name}
                <span className="s-sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a href={FOUNDERS[1].github} target="_blank" rel="noopener noreferrer">
                {FOUNDERS[1].name}
                <span className="s-sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
