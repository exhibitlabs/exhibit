import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Container } from "../layout";
import { PAINTINGS, type PaintingId } from "../paintings";
import { CAPABILITIES, OVERVIEW_HREF, type CapabilityKey } from "./capabilities";

type Stop = { href: string; index?: string; label: string; description: string; painting: PaintingId };

const OVERVIEW: Stop = { href: OVERVIEW_HREF, label: "Product overview", description: "Everything Exhibit does, on one page", painting: "harnett" };
const STOPS: Stop[] = CAPABILITIES.map((c) => ({ href: c.href, index: c.index, label: c.label, description: c.description, painting: c.painting }));

function PagerLink({ stop, dir }: { stop: Stop; dir: "prev" | "next" }) {
  const p = PAINTINGS[stop.painting];
  return (
    <Link href={stop.href} className={`s-pr-pager__link s-pr-pager__link--${dir}`}>
      <span className="s-pr-pager__thumb" style={{ background: p.tone }}>
        <Image src={p.src} alt="" fill sizes="160px" className="s-pr-pager__img" />
      </span>
      <span className="s-pr-pager__text">
        <span className="s-pr-pager__dir">
          {dir === "prev" ? <ArrowLeft className="s-icon" aria-hidden /> : null}
          {dir === "prev" ? "Previous" : "Next"}
          {dir === "next" ? <ArrowRight className="s-icon" aria-hidden /> : null}
        </span>
        <span className="s-pr-pager__label">
          {stop.index ? <span className="s-pr-pager__idx">{stop.index}</span> : null}
          {stop.label}
        </span>
        <span className="s-pr-pager__desc">{stop.description}</span>
      </span>
    </Link>
  );
}

/** Previous and next product pages, with each one's painting as a thumbnail. Wraps around through the overview. */
export function ProductPager({ current }: { current: CapabilityKey }) {
  const i = STOPS.findIndex((s) => s.href === CAPABILITIES.find((c) => c.key === current)!.href);
  const prev = i === 0 ? OVERVIEW : STOPS[i - 1];
  const next = i === STOPS.length - 1 ? OVERVIEW : STOPS[i + 1];
  return (
    <nav aria-label="More of the product" className="s-pr-pager">
      <Container>
        <div className="s-pr-pager__grid">
          <PagerLink stop={prev} dir="prev" />
          <PagerLink stop={next} dir="next" />
        </div>
      </Container>
    </nav>
  );
}
