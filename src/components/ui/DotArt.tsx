import "server-only";
import { clsx } from "clsx";
import type { DotArtName } from "../site/dots/art-data";
import { DOT_ART_SMALL } from "../site/dots/art-small";
import { DotSvg } from "../site/dots/DotSvg";

export type { DotArtName };

/**
 * Ink halftone dot art, the website's illustration language, used sparingly in the app: empty states, the
 * demo guide, the not-found page. Never on a working screen. The same drawings and renderer as the site
 * (src/components/site/dots), on the 32 x 24 grid drawn for 96 to 179 px wide: a static SVG rendered on the
 * server, with no canvas and no JavaScript in the browser.
 *
 * Server only (the import above fails the build otherwise). A client component that shows art takes it as
 * a prop from its page, e.g. `<InboxView emptyArt={<DotArt name="parcel" width={128} height={96} />} />`.
 * Decorative (aria-hidden); the size is fixed so nothing shifts. Height defaults to 3/4 of the width.
 */
export function DotArt({ name, width = 128, height = Math.round(width * 0.75), className }: { name: DotArtName; width?: number; height?: number; className?: string }) {
  return <DotSvg grid={DOT_ART_SMALL[name]} width={width} height={height} className={clsx("text-ink", className)} />;
}
