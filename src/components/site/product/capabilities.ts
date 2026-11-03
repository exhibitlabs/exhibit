import type { DotArtName } from "../dots/DotArt";
import { PRODUCT_LINKS, ROUTES } from "../nav";
import type { PaintingId } from "../paintings";

export type CapabilityKey = "investigate" | "evidence" | "prevention" | "ask" | "agents";

/**
 * The five capabilities in product order. Labels, URLs and one-line descriptions come from the kit's
 * PRODUCT_LINKS (the navigation's Product menu), so the menu, the sub-nav and the pages always agree.
 * Each capability keeps one painting (the plate it has on the homepage) and one dot drawing.
 */
const META: { key: CapabilityKey; index: string; painting: PaintingId; art: DotArtName }[] = [
  { key: "investigate", index: "01", painting: "petoOfficeBoard", art: "magnifier" },
  { key: "evidence", index: "02", painting: "mitchell", art: "stamp" },
  { key: "prevention", index: "03", painting: "sommar", art: "parcel" },
  { key: "ask", index: "04", painting: "petoOldSouvenirs", art: "bubble" },
  { key: "agents", index: "05", painting: "hoogstraten", art: "terminal" },
];

export const CAPABILITIES = META.map((m, i) => ({
  ...m,
  label: PRODUCT_LINKS[i].label,
  href: PRODUCT_LINKS[i].href,
  description: PRODUCT_LINKS[i].description ?? "",
}));

export type Capability = (typeof CAPABILITIES)[number];

export const capability = (key: CapabilityKey) => CAPABILITIES.find((c) => c.key === key)!;

export const OVERVIEW_HREF = ROUTES.product.overview;
