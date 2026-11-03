import type { DotMiniName } from "../dots/DotArt";
import { PRODUCT_LINKS, PRODUCT_OVERVIEW } from "../nav";

export type CapabilityKey = "investigate" | "evidence" | "prevention" | "ask" | "agents";
export type ChapterKey = "platform" | CapabilityKey;

/** One stop on the product tour. `art` names its dot drawing; the tour bar shows the drawing's 16 x 12 icon. */
export type Chapter = { key: ChapterKey; index: string; label: string; href: string; description: string; art: DotMiniName };

/**
 * The five capabilities in product order, chapters 01 to 05 of the tour. Labels, URLs and one-line descriptions
 * come from the kit's PRODUCT_LINKS (the header's Product menu), so the menu, the tour and the pages always agree.
 * The drawings match the menu's `art` (tests/product-tour.test.ts checks both).
 */
const META: { key: CapabilityKey; index: string; art: DotMiniName }[] = [
  { key: "investigate", index: "01", art: "magnifier" },
  { key: "evidence", index: "02", art: "stamp" },
  { key: "prevention", index: "03", art: "parcel" },
  { key: "ask", index: "04", art: "bubble" },
  { key: "agents", index: "05", art: "terminal" },
];

export const CAPABILITIES = META.map(
  (m, i): Chapter & { key: CapabilityKey } => ({
    ...m,
    label: PRODUCT_LINKS[i].label,
    href: PRODUCT_LINKS[i].href,
    description: PRODUCT_LINKS[i].description ?? "",
  }),
);

export type Capability = (typeof CAPABILITIES)[number];

export const capability = (key: CapabilityKey) => CAPABILITIES.find((c) => c.key === key)!;

/** Chapter 00: the platform page, /product, with the menu's overview drawing. */
export const PLATFORM: Chapter = { key: "platform", index: "00", label: "Platform", href: PRODUCT_OVERVIEW.href, description: "One agent for the whole dispute", art: "scales" };

/**
 * The product tour: six chapters numbered from 00, the platform and then the five capabilities. The tour bar, the
 * platform page's map and the next-chapter cards all read this list, so names, numbers and drawings never drift.
 */
export const CHAPTERS: Chapter[] = [PLATFORM, ...CAPABILITIES];

/** A chapter's position on the tour, 0 to 5. */
export const chapterAt = (key: ChapterKey) => CHAPTERS.findIndex((c) => c.key === key);
