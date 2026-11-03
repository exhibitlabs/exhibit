import { clsx } from "clsx";
import Link from "next/link";
import { Container } from "../layout";
import { CAPABILITIES, OVERVIEW_HREF, type CapabilityKey } from "./capabilities";

/**
 * The product sub-navigation at the top of every /product page: Overview, then the five capabilities with
 * their index numbers. `current` marks the page (aria-current). Scrolls sideways on phones.
 */
export function ProductNav({ current }: { current: CapabilityKey | "overview" }) {
  return (
    <nav aria-label="Product" className="s-pr-subnav">
      <Container>
        <ul className="s-pr-subnav__list">
          <li>
            <Link href={OVERVIEW_HREF} className="s-pr-subnav__link" aria-current={current === "overview" ? "page" : undefined}>
              Overview
            </Link>
          </li>
          {CAPABILITIES.map((c) => (
            <li key={c.key}>
              <Link href={c.href} className={clsx("s-pr-subnav__link")} aria-current={current === c.key ? "page" : undefined}>
                <span className="s-pr-subnav__idx">{c.index}</span>
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </nav>
  );
}
