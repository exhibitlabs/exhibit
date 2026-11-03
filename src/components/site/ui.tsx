import { clsx } from "clsx";
import type { CSSProperties, ReactNode } from "react";

// Product UI fragments: small, faithful rebuilds of pieces of the real app, in the app's own system (Geist
// 12/13/14/16/20/24, #ebebea lines, radius 12 page / 10 panels / 8 controls / 6 tags, green and red only for
// status). Use real values from src/components/landing/records/*.json and label demo data as demo. Every root
// carries data-ui so the design inspector treats it as product UI.

type Box = { className?: string; style?: CSSProperties; children: ReactNode; label?: string };

/** An app window floating over a plate (strong shadow, 12px corners). Position it with style or className. */
export function UiWindow({ className, style, children, label }: Box) {
  return (
    <div data-ui className={clsx("s-ui s-ui-window", className)} style={style} role={label ? "group" : undefined} aria-label={label}>
      {children}
    </div>
  );
}

/** A panel or sheet floating over a plate: a brief, a drawer, a message. `paper` squares the corners (documents). */
export function UiSheet({ className, style, children, label, paper }: Box & { paper?: boolean }) {
  return (
    <div data-ui className={clsx("s-ui s-ui-sheet", paper && "s-ui-sheet--paper", className)} style={style} role={label ? "group" : undefined} aria-label={label}>
      {children}
    </div>
  );
}

/** An app card at rest (radius 10, hairline), with an optional header row: `title` 14px semibold, `meta` grey. */
export function UiCard({ className, style, children, label, title, meta }: Box & { title?: ReactNode; meta?: ReactNode }) {
  return (
    <div data-ui className={clsx("s-ui s-ui-card", className)} style={style} role={label ? "group" : undefined} aria-label={label}>
      {title || meta ? (
        <div className="s-ui-card__head">
          <div>{title}</div>
          {meta ? <span>{meta}</span> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export type ChipTone = "outline" | "neutral" | "green" | "red" | "ink";

/**
 * The app's tag (src/components/ui/Chip.tsx): 20px, radius 6, Geist 12 at 500. `outline` (default) is white with
 * a hairline, `neutral` grey; green and red carry meaning. `soft` is kept as an alias of neutral, `dot` adds a 6px mark.
 */
export function UiChip({ children, soft, dot, tone, className }: { children: ReactNode; soft?: boolean; dot?: boolean; tone?: ChipTone; className?: string }) {
  const t: ChipTone = tone ?? (soft ? "neutral" : "outline");
  return (
    <span className={clsx("s-ui-chip", `s-ui-chip--${t}`, className)}>
      {dot ? <span className="s-ui-chip__dot" aria-hidden /> : null}
      {children}
    </span>
  );
}

export type Decision = "FIGHT" | "REFUND" | "OFFER" | "MESSAGE_BUYER" | "PREVENTED";
const DECISION: Record<Decision, string> = { FIGHT: "Fight", REFUND: "Refund", OFFER: "Offer", MESSAGE_BUYER: "Message", PREVENTED: "Prevented" };

/**
 * Exhibit's call as the app tags it: one outlined tag for all four calls (the call is a recommendation, not a
 * status); Prevented is green. `solid` is the ink tag at the centre of the evidence graph.
 */
export function UiPill({ decision, children, solid, className }: { decision?: Decision; children?: ReactNode; solid?: boolean; className?: string }) {
  return <span className={clsx("s-ui-pill", solid && "s-ui-pill--solid", decision === "PREVENTED" && "s-ui-pill--prevented", className)}>{children ?? (decision ? DECISION[decision] : null)}</span>;
}

/**
 * The app's rings. Green (win likelihood) is the evidence graph's ring: a #f6f6f5 track and the figure in Geist
 * semibold. Red, grey and ink are Prevention's score ring on a #ededeb track. `unit` follows the figure at full size.
 */
export function UiRing({ value, size = 68, stroke = 5, tone = "green", unit = "%", className, label, check }: { value: number; size?: number; stroke?: number; tone?: "green" | "red" | "ink" | "grey" | "prevented"; unit?: string; className?: string; label?: string; check?: boolean }) {
  // The graph ring is drawn on the app's 64-unit board (r 26, stroke 5); the score ring in pixels, like ScoreRing.
  const graph = tone === "green" && !check;
  const box = graph ? 64 : size;
  const r = graph ? 26 : (size - stroke) / 2;
  const sw = graph ? 5 : stroke;
  const c = 2 * Math.PI * r;
  const colour = tone === "red" ? "#b91c1c" : tone === "grey" ? "#8a8a87" : tone === "ink" ? "#0a0a0a" : "#15803d";
  const track = graph ? "#f6f6f5" : "#ededeb";
  const filled = check ? 100 : Math.max(value, 2);
  const fontSize = graph ? Math.round(size * 0.235) : size > 50 ? Math.round(size * 0.3) : 13;
  return (
    <span className={clsx("s-ui-ring", className)} style={{ width: size, height: size }} role="img" aria-label={label ?? `${value}${unit === "%" ? " percent" : ""}`}>
      <svg width={size} height={size} viewBox={`0 0 ${box} ${box}`} aria-hidden>
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke={track} strokeWidth={sw} />
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke={colour} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${(c * filled) / 100} ${c}`} />
      </svg>
      <span className="s-ui-ring__v" style={{ fontSize, color: check ? colour : undefined }} aria-hidden>
        {check ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <span>
            {value}
            {unit}
          </span>
        )}
      </span>
    </span>
  );
}

/** A citation on a reasoning point, as the brief shows it: the exhibit letter in mono, then the record ("A  Tracking SHP-10503"). */
export function UiCite({ letter, children, className }: { letter?: string | null; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("s-ui-cite", className)}>
      {letter ? <b>{letter}</b> : null}
      {children}
    </span>
  );
}

/** A lettered exhibit: the ink mark in a letter (default, 18px), `sm` the 16px legend mark, `badge` the evidence graph's green dot. */
export function UiExhibit({ letter, variant, className }: { letter: string; variant?: "sm" | "badge"; className?: string }) {
  return <span className={clsx("s-ui-exhibit", variant && `s-ui-exhibit--${variant}`, className)}>{letter}</span>;
}

/** An HTTP status as the app's PayPal activity shows it: green for 2xx, red for errors. */
export function UiStatus({ code, className }: { code: number; className?: string }) {
  return <span className={clsx("s-ui-status", code >= 400 && "s-ui-status--err", className)}>{code}</span>;
}

/** The app's key cap (src/components/ui/Kbd.tsx): 18px, Geist Mono 11. */
export function UiKbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx("s-ui-kbd", className)} aria-hidden>
      {children}
    </span>
  );
}

/** The app's buttons, drawn (not clickable): ink primary, white secondary with a hairline, ghost. Sizes 28 / 32 / 40. */
export function UiButton({ children, variant = "secondary", size = "md", className, icon }: { children?: ReactNode; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg"; className?: string; icon?: boolean }) {
  return <span className={clsx("s-ui-btn", `s-ui-btn--${variant}`, `s-ui-btn--${size}`, icon && "s-ui-btn--icon", className)}>{children}</span>;
}

/** A terminal window (night). Pass lines as children; classes p (prompt grey), c (command), g (green), y (gold). */
export function Terminal({ title, children, className, label }: { title?: string; children: ReactNode; className?: string; label?: string }) {
  return (
    <div data-ui className={clsx("s-term", className)} role={label ? "group" : undefined} aria-label={label}>
      <div className="s-term__bar" aria-hidden>
        <i />
        <i />
        <i />
        {title ? <span>{title}</span> : null}
      </div>
      {children}
    </div>
  );
}
