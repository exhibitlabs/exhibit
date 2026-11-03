import { useId, type CSSProperties } from "react";
import { DASH, dotLayers, type DotGrid } from "./paint";

/**
 * A dot grid as inline SVG, the one renderer behind the site's DotArt and the app's. No state and no
 * effects: it renders on the server and draws nothing on the client. Ink is currentColor, the gold accent
 * is --s-gold (falling back to the logo gold where the site's tokens are not loaded, as in the app).
 * `ghost` prints every mark as a pale ring; `frame` adds the two-ring border. Decorative unless `title`.
 */
export function DotSvg({
  grid,
  frame,
  ghost,
  title,
  className,
  style,
  width,
  height,
}: {
  grid: DotGrid;
  frame?: boolean;
  ghost?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
}) {
  const maskId = `dm${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const L = dotLayers(grid, { ghost, frame });
  return (
    <svg viewBox={`0 0 ${L.cols} ${L.rows}`} width={width} height={height} className={className} style={style} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      {L.fills.map((f, i) => (
        <path key={i} d={f.d} {...DASH} stroke={f.gold ? "var(--s-gold, #e8a33d)" : "currentColor"} strokeWidth={f.width} opacity={f.opacity < 1 ? f.opacity : undefined} />
      ))}
      {L.rings.length ? (
        <>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="-1" y="-1" width={L.cols + 2} height={L.rows + 2}>
            <rect x="-1" y="-1" width={L.cols + 2} height={L.rows + 2} fill="#fff" />
            {L.holes.map((h, i) => (
              <path key={i} d={h.d} {...DASH} stroke="#000" strokeWidth={h.width} />
            ))}
          </mask>
          <g mask={`url(#${maskId})`}>
            {L.rings.map((r, i) => (
              <path key={i} d={r.d} {...DASH} stroke="currentColor" strokeWidth={r.width} opacity={r.opacity < 1 ? r.opacity : undefined} />
            ))}
          </g>
        </>
      ) : null}
    </svg>
  );
}
