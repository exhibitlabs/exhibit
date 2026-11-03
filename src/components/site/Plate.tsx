import { clsx } from "clsx";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { PAINTINGS, type PaintingId } from "./paintings";

type Crop = {
  /** The point of the painting kept in view, in percent of its width and height. Default [50, 50]. */
  focus?: [number, number];
  /** Zoom around the focus point. 1 = the painting just covers the plate. */
  zoom?: number;
  /** Plate height in px. Ignored when `ratio` is set. */
  height?: number;
  /** Plate aspect ratio, e.g. "16 / 10". */
  ratio?: string;
};

/**
 * A painting used as a plate, with the product set into it. The painting covers the plate; `focus` and
 * `zoom` choose the crop (separately for phones with `mobile`). Children are laid over the painting:
 * position them absolutely (see UiWindow / UiSheet), or wrap them in <PlateLayer>.
 * Always pair a plate with <PlateCaption> (or use <PlateFigure>), which credits the painting.
 */
export function Plate({
  painting,
  focus = [50, 50],
  zoom = 1,
  height = 560,
  ratio,
  mobile,
  preload,
  sizes = "(max-width: 768px) 100vw, (max-width: 1440px) 96vw, 1376px",
  decorative,
  image,
  className,
  style,
  children,
}: Crop & {
  painting: PaintingId;
  /** A pre-cropped detail of the same painting (smaller file for a hero). Credits stay the painting's. */
  image?: string;
  mobile?: Crop;
  /** Preload the image (the hero only). */
  preload?: boolean;
  /** next/image `sizes`. Raise it when you zoom far in. */
  sizes?: string;
  /** Hide the painting from screen readers (when the caption already names it and the plate repeats). */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const p = PAINTINGS[painting];
  const m = mobile ?? {};
  const vars: Record<string, string | number | undefined> = {
    "--s-plate-tone": p.tone,
    "--s-fx": `${focus[0]}%`,
    "--s-fy": `${focus[1]}%`,
    "--s-zoom": zoom,
    "--s-plate-h": ratio ? undefined : `${height}px`,
    "--s-plate-ratio": ratio,
    "--s-fx-m": m.focus ? `${m.focus[0]}%` : undefined,
    "--s-fy-m": m.focus ? `${m.focus[1]}%` : undefined,
    "--s-zoom-m": m.zoom,
    "--s-plate-h-m": m.height ? `${m.height}px` : undefined,
    "--s-plate-ratio-m": m.ratio,
  };
  return (
    <div className={clsx("s-plate", ratio && "s-plate--ratio", className)} style={{ ...(vars as CSSProperties), ...style }}>
      <Image src={image ?? p.src} alt={decorative ? "" : p.alt} fill sizes={sizes} preload={preload} loading={preload ? "eager" : undefined} fetchPriority={preload ? "high" : undefined} className="s-plate__img" draggable={false} />
      {children}
    </div>
  );
}

/**
 * A plate with product UI laid over it that stays readable on phones. Pass the overlays as <PlateOverlay>
 * children: from 768 px they sit on the painting at the given position (clipped by the plate's edge, like a
 * letter tucked into the rack); on phones they slide down to overlap the plate's bottom edge and stack.
 */
export function PlateStage({ children, stageClassName, ...plate }: Omit<Parameters<typeof Plate>[0], "children"> & { children: ReactNode; stageClassName?: string }) {
  return (
    <div className={clsx("s-stage", stageClassName)}>
      <Plate {...plate} />
      {children}
    </div>
  );
}

/** One overlay in a PlateStage. Positions are CSS lengths for 768 px and up (`left="6%" top="120px" width="44%"`). */
export function PlateOverlay({ left, top, right, width, children, className, style }: { left?: string; top?: string; right?: string; width?: string; children: ReactNode; className?: string; style?: CSSProperties }) {
  const vars = { "--l": left, "--t": top, "--r": right, "--w": width } as CSSProperties;
  return (
    <div className={clsx("s-overlay", className)} style={{ ...vars, ...style }}>
      {children}
    </div>
  );
}

/** Full-size layer over a plate's painting, for overlays you position yourself. */
export function PlateLayer({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={clsx("s-plate__layer", className)} style={style}>
      {children}
    </div>
  );
}

/** "Plate 1  William Michael Harnett, The Artist's Letter Rack, 1879. The Metropolitan Museum of Art, CC0." */
export function PaintingCredit({ painting, detail, className }: { painting: PaintingId; detail?: boolean; className?: string }) {
  const p = PAINTINGS[painting];
  return (
    <span className={className}>
      <span className="s-cap__plate">
        Plate {p.plate}
        {detail ? ", detail" : ""}
      </span>
      {p.artist}, <em className="s-serif-title">{p.title}</em>, {p.date}. {p.museum}, {p.license}
      {p.via ? `, ${p.via}` : ""}.
    </span>
  );
}

/**
 * Museum-style caption under a plate: on the left what the product shows (children, start with a <b>
 * lead-in), on the right the painting's credit. `even` splits the two halves equally (for narrow figures).
 */
export function PlateCaption({ painting, detail, even, children, className, as: Tag = "figcaption" }: { painting: PaintingId; detail?: boolean; even?: boolean; children?: ReactNode; className?: string; as?: "figcaption" | "div" }) {
  return (
    <Tag className={clsx("s-cap", even && "s-cap--even", className)}>
      <span className="s-cap__ui">{children}</span>
      <PaintingCredit painting={painting} detail={detail} className="s-cap__art" />
    </Tag>
  );
}

/** A <figure> with a Plate and its PlateCaption. Takes every Plate prop plus `caption`. */
export function PlateFigure({ caption, captionEven, detail, figureClassName, ...plate }: Parameters<typeof Plate>[0] & { caption: ReactNode; captionEven?: boolean; detail?: boolean; figureClassName?: string }) {
  return (
    <figure className={clsx("s-figure", figureClassName)}>
      <Plate {...plate} />
      <PlateCaption painting={plate.painting} detail={detail} even={captionEven}>
        {caption}
      </PlateCaption>
    </figure>
  );
}
