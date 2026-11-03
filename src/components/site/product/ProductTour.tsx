import { DotIcon } from "../dots/DotArt";
import { CHAPTERS, chapterAt, type ChapterKey } from "./capabilities";
import { TourBar } from "./TourBar";

/**
 * The product tour bar, first thing in every /product page: `current` is the page's chapter. This server side
 * prints each chapter's 16 x 12 dot icon and hands them to TourBar (client) as markup, so the drawings never ship
 * in the page's JavaScript. The current icon is printed twice on purpose: every copy gets its own svg.
 */
export function ProductTour({ current }: { current: ChapterKey }) {
  const at = chapterAt(current);
  const stops = CHAPTERS.map(({ key, index, label, href }) => ({ key, index, label, href }));
  return (
    <TourBar
      chapters={stops}
      current={at}
      icons={CHAPTERS.map((c) => (
        <DotIcon key={c.key} name={c.art} />
      ))}
      nowIcon={<DotIcon name={CHAPTERS[at].art} />}
      next={stops[at + 1] ?? null}
      home={stops[0]}
    />
  );
}
