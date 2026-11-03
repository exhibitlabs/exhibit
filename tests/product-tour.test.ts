// The product tour names, numbers and draws its six chapters the same way everywhere: the tour bar, the platform
// page's map and the next-chapter cards read CHAPTERS, which must agree with the header's Product menu.
import { describe, expect, it } from "vitest";
import { DOT_ART, DOT_ART_MINI, type DotMiniName } from "@/components/site/dots/art-data";
import { CAPABILITIES, CHAPTERS, PLATFORM, chapterAt } from "@/components/site/product/capabilities";
import { PRODUCT_LINKS, PRODUCT_OVERVIEW, ROUTES } from "@/components/site/nav";

describe("product tour chapters", () => {
  it("numbers six chapters from 00, the platform first", () => {
    expect(CHAPTERS.map((c) => `${c.index} ${c.label}`)).toEqual(["00 Platform", "01 Investigate", "02 Evidence packets", "03 Prevention", "04 Ask Exhibit", "05 For AI agents"]);
    expect(CHAPTERS[0]).toBe(PLATFORM);
    expect(PLATFORM.href).toBe(ROUTES.product.overview);
    expect(chapterAt("agents")).toBe(5);
  });

  it("names, links and describes the five capabilities as the Product menu does", () => {
    expect(CAPABILITIES.map((c) => [c.label, c.href, c.description])).toEqual(PRODUCT_LINKS.map((l) => [l.label, l.href, l.description]));
  });

  it("draws every chapter with the menu's dot art", () => {
    expect(CAPABILITIES.map((c) => c.art)).toEqual(PRODUCT_LINKS.map((l) => l.art));
    expect(PLATFORM.art).toBe(PRODUCT_OVERVIEW.art);
    expect(PLATFORM.href).toBe(PRODUCT_OVERVIEW.href);
  });
});

describe("the tour's mini dot icons", () => {
  const minis = Object.entries(DOT_ART_MINI) as [DotMiniName, readonly string[]][];

  it("are 16 x 12 grids in the dot glyphs, one for each chapter's drawing", () => {
    expect(minis.map(([name]) => name).sort()).toEqual(CHAPTERS.map((c) => c.art).sort());
    for (const [name, grid] of minis) {
      expect(grid, name).toHaveLength(12);
      for (const row of grid) expect(row, name).toMatch(/^[.:o+*#@]{16}$/);
      expect(DOT_ART, name).toHaveProperty(name);
    }
  });

  it("each carry one small gold accent", () => {
    for (const [name, grid] of minis) {
      const gold = [...grid.join("")].filter((ch) => ch === "@").length;
      expect(gold, name).toBeGreaterThanOrEqual(2);
      expect(gold, name).toBeLessThanOrEqual(6);
    }
  });
});
