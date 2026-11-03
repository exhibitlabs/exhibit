# Exhibit site kit

The design system for every marketing page (everything under `src/app/(site)/`). Direction: **Letter Rack**
with **Blueprint's dot art redrawn in ink**. Airy white and the lightest warm-neutral grey (`#f6f6f5`, never
cream), ink `#0a0a0a`, Geist with Geist Mono for ids, two-tone headlines, the logo's gold `#e8a33d` only as
small accents, the real product UI set into 1880s trompe-l'oeil letter-rack paintings with museum captions,
and ink halftone illustrations.

```tsx
import { Section, Container, SectionHead, Eyebrow, Heading, Lede, ButtonLink, PlateFigure, DotArt } from "@/components/site";
```

Names and props here are stable: later passes add, never rename.

## How a page is put together

- Put the page in `src/app/(site)/<route>/page.tsx`. The `(site)` layout already renders `SiteNav`, a
  `<main id="main">` and `SiteFooter`, and imports `src/app/(site)/site.css`. Do not add another nav or footer.
- Every page has exactly one `h1` (use `PageHeader` on inner pages) and every section opens with a heading.
- Pages must render statically: read data from `src/components/landing/records/*.json`,
  `src/components/landing/data.ts`, `eval/RESULTS.md`, `docs/SANDBOX_E2E.md`. Never import `src/lib/**`
  (database) into a site page.
- Link with `ROUTES` from `@/components/site` (or `./nav`), never hand-typed URLs.
- Client components (`"use client"`) must import kit pieces from their own files
  (`@/components/site/actions`, not the barrel), so the dot-art data stays out of client bundles.

### Inner page template

```tsx
import type { Metadata } from "next";
import { Container, Section, SectionHead, PageHeader, Eyebrow, Heading, Lede, Body, ButtonLink, TextLink, DotArt, Prose, ROUTES } from "@/components/site";

export const metadata: Metadata = {
  title: "Security", // renders "Security · Exhibit"
  description: "One plain sentence with a real fact.",
  alternates: { canonical: "/security" },
};

export default function SecurityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Nothing reaches PayPal"
        rest="until you say so."
        lede="Four checks stand between a draft and a filing. Each one is enforced in code you can read."
        actions={<><ButtonLink href={ROUTES.app} arrow>Try the live demo</ButtonLink><ButtonLink href={ROUTES.contact} variant="ghost">Book a demo</ButtonLink></>}
        aside={<DotArt name="shield" frame className="w-[300px]" />}
      />
      <Section id="approvals" labelledBy="approvals-title">
        <Container>
          <SectionHead aside={<Body>Agents and Autopilot request. You approve.</Body>}>
            <Eyebrow>Approval gates</Eyebrow>
            <Heading id="approvals-title" title="Agents request." rest="Merchants approve." />
          </SectionHead>
          {/* section content */}
        </Container>
      </Section>
    </>
  );
}
```

## Tokens

All tokens are CSS custom properties on `.site` (set by the layout), defined in `src/app/(site)/site.css`.
Use them in inline styles or Tailwind arbitrary values: `text-[var(--s-muted)]`, `bg-[var(--s-band)]`.

| Token | Value | Use |
| --- | --- | --- |
| `--s-bg` | `#ffffff` | Page ground |
| `--s-band` | `#f6f6f5` | The light grey band, quiet cards (never cream) |
| `--s-band-2` | `#efefed` | A step darker than the band |
| `--s-ink` | `#0a0a0a` | Type, primary buttons, dot art |
| `--s-ink-2` | `#2f2f2f` | Strong secondary text |
| `--s-body` | `#474747` | Running text |
| `--s-muted` | `#6b6b6b` | Secondary text and captions (passes AA) |
| `--s-faint` | `#a3a3a3` | Icons and decoration only, never small text |
| `--s-dim` | `#858583` | Grey second line of two-tone headings (large text only) |
| `--s-line` / `--s-line-2` | `#ebebea` / `#dcdcda` | Hairlines in tables, facts, cards |
| `--s-gold` | `#e8a33d` | The logo's arm: eyebrow squares, the wordmark's arm. Small accents only |
| `--s-green` / `--s-green-soft` | `#15803d` / `#f0fdf4` | Inside product UI and 2xx codes only |
| `--s-red` / `--s-red-soft` | `#b91c1c` / `#fef2f2` | Inside product UI and error codes only |
| `--s-night` | `#0d0d0c` | The one dark band (`Section tone="night"`) and terminals |
| `--s-sans` / `--s-mono` / `--s-serif` | Geist / Geist Mono / Instrument Serif italic | Serif is for painting titles in captions only |
| `--s-text-display` | 34 to 54 px | Homepage h1 |
| `--s-text-h1` | 32 to 48 px | Inner page h1 |
| `--s-text-h2` | 26 to 34 px | Section headings |
| `--s-text-h3` | 17 px | Sub-headings |
| `--s-text-lede` / `--s-text-body` / `--s-text-small` / `--s-text-cap` | 16.5 / 15.5 / 13 / 12.5 px | Text sizes |
| `--s-wrap` / `--s-wide` | 1280 / 1376 px | Container widths |
| `--s-gutter` | 20 / 32 / 48 px | Side margin (phone / tablet / desktop) |
| `--s-section-y` | 88 / 104 / 128 px | Space between sections |
| `--s-nav-h` | 60 / 68 px | Sticky nav height (use for `scroll-margin-top`) |
| `--s-radius` / `--s-radius-plate` / `--s-radius-ui` | 7 / 6 / 12 px | Buttons / plates / product cards |
| `--s-float` / `--s-float-sm` | shadows | Only for product UI floating over a painting |

Breakpoints: phone below 640, tablet 640 to 1023, desktop 1024 and up. Tailwind's `sm:` `md:` `lg:` match.

Typography rules: headings weight 500, tight tracking, balanced. Two tones only at h2 size and up. Geist Mono
only for ids and records (dispute ids, debug ids, endpoints, HTTP codes, figures in stat rows). Sentence case
everywhere; no tiny uppercase labels.

## Layout

### `Container`
`size?: "wrap" | "wide" | "narrow"` (default `wrap`, 1280; `wide` 1376 for plates; `narrow` 760 for reading),
`as?`, `className?`, `style?`.

### `Section`
`id?`, `tone?: "plain" | "band" | "night"`, `spacing?: "default" | "tight" | "flush"`, `labelledBy?` (id of
the heading), `label?`, `className?`. Sections are spaced by top padding, so stack them directly.
`band` and `night` get padding on both sides; inside `night`, headings turn white, grey tokens swap to dark
equivalents and buttons should use `light` / `outline-light`.

### `SectionHead`
The standard opening: heading on the left (8 of 12 columns), `aside` paragraph on the right, bottom-aligned.
`even?` makes it 7/5. Stacks on phones.

```tsx
<SectionHead aside={<Body>PayPal publishes three dispute tools for AI agents. None of them investigates.</Body>}>
  <Eyebrow>The gap</Eyebrow>
  <Heading id="gap-title" title="PayPal's agent tools can read a dispute or concede it." rest="Exhibit does everything in between." />
</SectionHead>
```

Use the 12-column grid with Tailwind (`grid lg:grid-cols-12 gap-x-6`) or the `s-grid` class.

## Type

| Component | Props | Notes |
| --- | --- | --- |
| `Eyebrow` | `children`, `index?`, `as?` | Gold square + phrase. With `index="01"` a mono number replaces the square (product sections only). |
| `Heading` | `title`, `rest?`, `as?` (`h1`..`h4`, `p`), `size?` (`display`, `h1`, `h2`, `h3`, `h4`), `inline?`, `id?` | Two-tone: `title` ink, `rest` grey on its own line. `as="h1"` defaults to `display`. |
| `Lede` | `children` | The paragraph after a heading. |
| `Body` | `children` | Running text, 15.5 px. |
| `Small` | `children` | 13 px note. |
| `Mono` | `children` | Inline Geist Mono for ids. |

## Actions

| Component | Props | Notes |
| --- | --- | --- |
| `ButtonLink` | `href`, `variant?: "ink" \| "ghost" \| "light" \| "outline-light"`, `size?: "sm" \| "md" \| "lg"`, `arrow?` | Primary is `ink` with `arrow`. External URLs open in a new tab and announce it. |
| `TextLink` | `href`, `children` | "Read the security page →". External gets ↗. |
| `Actions` | `children` | Row of buttons with the standard gap. |

The site's calls to action are always: primary **Try the live demo** → `ROUTES.app` (`/app`), secondary
**Book a demo** → `ROUTES.contact`.

## Plates (paintings)

The six paintings are in `public/art/` and described in `paintings.ts` (`PAINTINGS`, `PAINTING_LIST`,
`creditText`). Ids: `harnett` (Plate 1), `petoOfficeBoard` (2), `mitchell` (3), `sommar` (4),
`petoOldSouvenirs` (5), `hoogstraten` (6). Never present a painting as Exhibit's product; the product sits
*on* the painting and the caption says which is which. Every shown painting is credited in its caption
and in the footer (automatic).

### `Plate`
`painting`, `focus?: [x%, y%]` (point kept in view, default `[50, 50]`), `zoom?` (1 = covers),
`height?` (px, default 560) or `ratio?` (`"16 / 10"`), `mobile?: { focus, zoom, height, ratio }`,
`preload?` (hero only), `sizes?`, `decorative?`, `className?`, `style?`, `children` (overlays).
Overlays are positioned absolutely by you; on phones prefer stacking them under the plate.

### `PlateCaption`
`painting`, `detail?` ("Plate 1, detail"), `even?`, `children` (start with a `<b>` lead-in), `as?`.
Left half says what the product shows; right half credits the painting.

### `PlateFigure`
`<figure>` with `Plate` and `PlateCaption`: every Plate prop plus `caption`, `captionEven?`, `detail?`.

```tsx
<PlateFigure
  painting="petoOfficeBoard"
  focus={[46, 40]}
  zoom={1.2}
  height={760}
  mobile={{ height: 520 }}
  caption={<><b>The cited decision.</b> A recorded Claude run on the sandbox chargeback, Oct 21, 2026, 35.6 s.</>}
>
  <UiSheet style={{ position: "absolute", left: 40, top: 260, width: 540 }}>…</UiSheet>
</PlateFigure>
```

`PlateLayer` is a full-size absolute layer for overlays; `PaintingCredit` renders the credit line alone.

### `PlateStage` and `PlateOverlay` (product UI that stays readable on phones)
`PlateStage` takes every Plate prop (except children) plus `stageClassName?`; its children are
`PlateOverlay`s with `left?`, `top?`, `right?`, `width?` (CSS lengths, used from 768 px up), `className?`,
`style?`. From 768 px the overlays sit on the painting, clipped by its edge like a letter tucked into the
rack; on phones they slide down to overlap the plate's bottom edge and stack under it. Prefer this over
absolutely positioned Plate children whenever the overlay holds text. For a wide plate with two or more overlays, pass
`stageClassName="s-stage--late"` to keep the stacked layout until 1024 px.

```tsx
<figure className="s-figure">
  <PlateStage painting="petoOfficeBoard" focus={[50, 51]} zoom={1.02} height={760} mobile={{ height: 300, focus: [62, 22], zoom: 1.5 }}>
    <PlateOverlay left="4.7%" top="262px" width="64%">
      <UiSheet label="Exhibit's brief"><BriefSheet /></UiSheet>
    </PlateOverlay>
  </PlateStage>
  <PlateCaption painting="petoOfficeBoard" even><b>The cited decision.</b> …</PlateCaption>
</figure>
```

### `FitBox` (client)
Scales a fixed-size piece of UI to its box like a screenshot, but as live HTML: `width`, `height` (design
size in px), `min?` (stop shrinking; past it the UI is cropped), `max?`, `ratio?` (keep the design aspect),
`fallback?` (scale without JavaScript), `className?`, `style?`. The homepage hero puts `CasePage` (designed at
1386 x 1013) in a FitBox inside a UiWindow.

## Dot art (ink halftone)

Printed-looking illustrations on a grid of dots, as static SVG: rendered on the server, zero client
JavaScript, a handful of `<path>` elements per piece, colour from `currentColor` (ink by default; set `color`
or `--s-dot` to change; the gold accent is `--s-gold`). Every cell prints one of six marks: a full dot (solid
ink), a large or small dot (mid tones), a ring (light tones, glass), a faint ring (shadows), or a full dot in
gold. Rings are for light tones and "not yet" ghosts, never for an outline that has to read solid.

### `DotArt`
`name`, `frame?` (the printed two-ring border), `ghost?` (every mark as a pale ring: something that has not
happened yet), `small?` (the 32 x 24 drawings), `title?` (accessible name; omit and it is decorative),
`className?`, `style?`. 4:3; size with CSS width. Keep it 180 px wide or more so every cell stays at least
3 px; between 96 and 179 px pass `small`.

| `name` | Drawing | Good for |
| --- | --- | --- |
| `parcel` | Isometric box, taped, with a blank label | Delivery evidence, item not received |
| `slip` | Delivery slip: barcode, an X and a signature | Proof of delivery, citations |
| `letter` | Letter in an open envelope | A dispute arriving, messages, contact |
| `stamp` | "EXHIBIT A" rubber stamp in a dot-matrix face | Filing, evidence packets, calls to action |
| `scales` | A balance | PayPal reviewing, decisions, fairness to buyers |
| `shield` | Shield with a check | Security, approval gates |
| `bubble` | Two speech bubbles: a message and the reply | Ask Exhibit, buyer messages, prevention replies |
| `terminal` | Terminal window: prompt, command, output, cursor | MCP, AI agents, docs |
| `magnifier` | Magnifier over a page | Investigation, docs |
| `receipt` | Long receipt with a torn edge | The record, audit log, pricing |
| `verdict` | "RESOLVED" stamp with a check | Outcomes; draw it `ghost` while a case is undecided |

Use dot art with intent: one piece that says what the section is about, never as filler or wallpaper.

### `DotIcon`
The product tour's 16 x 12 icons, one for each chapter's piece (`scales`, `magnifier`, `stamp`, `parcel`,
`bubble`, `terminal`): `name`, `title?`, `className?`, `style?`. Size it 32 px wide (2 px a cell; it reads from
28 to 36 px). Each has a gold accent of a few cells (the pivot, the found line, the A's crossbar, the label, the
question, the cursor) that prints in `--s-gold`; set `--s-gold: currentColor` on a parent to print it in ink, as
the tour does for every chapter but the current one.

### `DotWordmark`
The monumental footer wordmark (the logo's E with its gold arm, "xhibit"), solid ink dots. A coarser drawing
takes over below 640 px so the dots stay large. `accent?` (gold arm, default true), `className?`. Already in
the footer; don't repeat it on pages.

### `DotTrack`
Comparison track: `cells?` (12), `filled: number[] | "all"`, `dots?: [across, down]` (9 x 5), `columns?`,
`columnsMobile?` (6), `label` (required, read as one image), `className?`. Filled boxes print full ink dots
in an ink box; the rest pale rings.

```tsx
<DotTrack filled={[0, 1, 9]} label="PayPal's agent tools cover 3 of Exhibit's 12 steps" />
<DotTrack filled="all" label="Exhibit covers all 12" />
```

### In the app
`src/components/ui/DotArt.tsx` prints the same drawings with the same renderer on the 32 x 24 grid, at a
fixed `width` and `height` (empty states, the demo guide, not-found). It is server only: a client component
takes its art as a prop from the page, e.g.
`<InboxView emptyArt={<DotArt name="parcel" width={128} height={96} />} />`.

### How it is built
- `dots/generator/drawings.mjs`: every piece drawn by hand in grid cells, twice (`lg` 60 x 45 for the site,
  `sm` 32 x 24), plus the wordmark. Shapes come from `dots/generator/raster.mjs` (rect, roundRect, circle,
  poly, line, a 5 x 7 dot face for words); a cell takes a tone when its centre is inside the shape. The six
  product chapters' pieces are drawn a third time as `xs`, the tour's 16 x 12 icons, set cell by cell
  (`sketch`) because at that size every cell is a decision.
- `node src/components/site/dots/generator/generate.mjs` writes `dots/art-data.ts` (with `DOT_ART_MINI`, the
  `xs` icons) and `dots/art-small.ts`
  (one glyph per cell: `.` paper, `:` faint ring, `o` ring, `+` small dot, `*` large dot, `#` full dot, `@`
  gold) and prints every grid to the terminal. Pure Node: no browser, fonts or network. Never edit the grids
  by hand; a new piece only needs a new entry in `PIECES` (the `DotArtName` type is generated).
- `dots/paint.ts` turns a grid into SVG paths, `dots/DotSvg.tsx` renders them. Each dot is a zero-length
  dash with a round cap on one path per tone. Runs start half a cell early with `stroke-dashoffset` 0.5, so
  no dash sits on the end of a path: WebKit draws a dot there and Chrome doesn't, which used to add or drop
  the last dot of a run. Chrome and WebKit (Safari) print the same dots.
- Rules of the family: bold silhouettes; strokes at least two cells on the 60 x 45 grid (lines of text are
  rows of dots); words only in the dot face, big enough to read; no marks on skewed surfaces.

### Brand files
`node src/components/site/dots/generator/export-svg.mjs` writes every piece and the wordmark to
`docs/brand/dots/` as standalone SVGs: `<name>-on-light.svg` in ink for light backgrounds and
`<name>-on-dark.svg` in a light tone (`#f2f2ef`) for dark ones, the wordmark's arm gold in both.
`wordmark-small-*` is the coarse wordmark for widths under about 600 px. Run it after `generate.mjs`.
In a README, pair them for GitHub's light and dark themes:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/dots/wordmark-on-dark.svg">
  <img src="docs/brand/dots/wordmark-on-light.svg" alt="Exhibit" width="440">
</picture>
```

## Product UI fragments

Faithful rebuilds of pieces of the real app (`http://localhost:3101/app`), with real values from the
records. Inside fragments the app's own look applies: Geist 13 px, `#ebebeb` lines, green and red only for
status. Label demo data as demo (Kora Atelier is a demo merchant; Lena Hoffmann is on the PayPal simulator).
Every root carries `data-ui`.

| Component | Props | What |
| --- | --- | --- |
| `UiWindow` | `className?`, `style?`, `label?` | App window floating over a plate (strong shadow, 12 px radius) |
| `UiSheet` | same + `paper?` | A sheet floating over a plate: a brief, a packet page, a message. `paper` squares the corners |
| `UiCard` | same + `title?`, `meta?` | Bordered app card at rest with an optional header row |
| `UiChip` | `soft?`, `dot?` | "Chargeback", "PayPal reviewing" |
| `UiPill` | `decision?: "FIGHT" \| "REFUND" \| "OFFER" \| "MESSAGE_BUYER" \| "PREVENTED"` or children | Exhibit's decision |
| `UiRing` | `value`, `size?` (66), `stroke?`, `tone?: "green" \| "red" \| "ink"`, `unit?`, `label?` | Likelihood or risk ring |
| `UiCite` | `letter`, `children` | Citation tag "A Tracking SHP-10503" |
| `UiExhibit` | `letter`, `variant?: "sm" \| "badge"` | Lettered exhibit marker |
| `UiStatus` | `code` | HTTP status inside a fragment |
| `Terminal` | `title?`, `label?`, children with spans `.p` `.c` `.g` `.y` | Night terminal |

Fragment classes for custom pieces: wrap in `s-ui` (then `s-ui-muted`, `s-ui-mono`).

### Ready-made fragments, bound to the real records (`@/components/site/fragments`)
Server components; import from the file, not the barrel. Put each inside the frame named.

| Component | Frame | What it shows |
| --- | --- | --- |
| `CasePage` | `FitBox width={1386} height={1013}` in a `UiWindow` | The app's case page for Daniel Reyes, `PP-R-EGO-10193744`, as it runs on the PayPal sandbox: sidebar and top bar in sandbox mode, case header, lifecycle, evidence graph, brief, "Response to PayPal" |
| `EvidenceGraph` `width?` (1098) `gap?` (97) | the case page, or any box that width | Eight sources, six cited A to F, the legend "Cited to fight / Read, not cited / Not queried" |
| `BriefCardView` `points?` `summary?: "full" \| "first" \| "none"` `risks?` `why?` | `UiSheet`, `UiCard` or a card | The app's brief card for the Oct 21 run: the call, headline, summary, the four figures (2 x 2 when the card is narrow), reasoning with citations, risks |
| `BriefSheet` `points?` (3) | `UiSheet` | `BriefCardView` cropped for a plate: the summary's first sentence and the first reasoning points, no risks |
| `PacketPage` `paragraphs?` (5) | `UiSheet paper` | The packet's cover as `src/lib/packet` prints it (letterhead, title, facts, the letter's first paragraphs), the Nov 3 filing; `paragraphs={0}` ends under the facts |
| `AtRiskCard` | `UiSheet` | Prevention: Lena Hoffmann's at-risk order, risk 84, signals, her German message (demo merchant) |
| `BuyerReply` | `UiSheet` | "Fix it now": the German reply as the drawer previews it, and Message buyer (demo merchant) |
| `AskAnswer` `height?` | `UiWindow` | The recorded Ask Exhibit answer in the palette: $668 across 3 disputes, chart, cases, follow-ups |
| `AskTurnTop` | a card | The top of that answer: the question, the read-only steps and the answer's first line |
| `ApprovalCard` `decided?` | none (renders its own cards) | Agent requests: Claude Code's request waiting, then the Decided table |
| `ApprovalRow`, `DecidedTable`, `ApprovalBannerView` | a card | The queue row, the Decided table, the case page's agent-request banner |
| `McpLines` | `Terminal` | The MCP tool flow behind the Nov 3 filing |
| `AuditLog` `rows?` | `UiSheet` (in a `FitBox` at 813 px) | PayPal activity: four real calls including the 500; `ActivityCall` and `ActivityEvent` are its rows |
| `RunTimeline` | `UiCard` (inside a `Reveal` the bars grow in) | The recorded run's tool calls on a time axis, 35.6 s (a figure of the record, set in the app's type) |

The packet's page parts (`PdfPage`, `PdfLetterhead`, `PdfTitle`, `PdfFacts`, `PdfLabel`, `PdfExhibitHead`) are in
`packet.tsx`, shared by `PacketPage`, the client `PacketViewer` and the refund letter on `/product/evidence`. They size
in PDF points (`--pt` on `.s-pdf__page`, read off the page's width with a floor), so a page scales like the document
and reflows its facts two across when narrow. Classes: `s-pdf` in site.css.

### Facts (`@/components/site/facts`)
Every number and string the site states, derived from the records: `REYES` (the showcase case: dispute,
recorded run, brief with em dashes removed, every filing, the approval), `RECORD` (sandbox totals, filings,
failures, endpoints, runs, every call), `EVAL` (counted from `eval/results.json`, with `caveat`), `ASK`,
`PREVENTION`, `PAYPAL_FEES`, `PAYPAL_AGENT_TOOLS`, `PAYPAL_MCP_QUOTE`, `PRICING`, `LESSONS`, `NOT_LIVE`,
`MCP_TOOLS`, `MCP_SETUP`, plus UTC formatters (`fmtDate`, `fmtDay`, `fmtTime`, `fmtDateTime`, `fmtMs`,
`fmtSeconds`, `usd`) and `plain()` (house style: no em dashes). Use these instead of re-deriving; server only.

### Homepage sections (`@/components/site/home/*`)
`Hero`, `Gap`, `ProductSections`, `Lifecycle` (the "Opened to Resolved" showpiece, with `LifecycleSpy`),
`ProofBoard` (the evidence board, with `CallStrip`: one dot per logged call), `Security`, `Pricing`,
`Questions`, `ClosingPlate`. Page-specific, but importable: `CallStrip cols={61}` and `RunTimeline` are good
on product and proof pages.

## Records, facts, FAQ

| Component | Props | What |
| --- | --- | --- |
| `Stat` | `value`, `label` | Big mono figure and label ("244 API calls logged") |
| `Facts` | `items: { k, v }[]` | Key/value rows with hairlines |
| `StatusCode` | `code` | HTTP code chip outside fragments (tables) |
| `Tag` | `dot?`, `green?` | Small status label ("Planned") |
| `Faq` | `items: { q, a }[]`, `open?: number[]` (default `[0]`) | Native `<details>` accordion |

Tables: `<div className="s-table-wrap"><table className="s-table">…</table></div>`, mono cells with `s-mono`.

## Inner pages and long-form

### `PageHeader`
`eyebrow?`, `title`, `rest?`, `lede?`, `actions?`, `aside?` (dot art, small plate or fragment, right side on
desktop), `crumbs?: { label, href? }[]`, `children?`. Renders the page's `h1`.

### `Prose`
Wrap long-form HTML (legal, docs, about): `<Prose><h2>…</h2><p>…</p></Prose>`. Styles h2, h3, p, lists,
links, `code`, `pre`, blockquote, tables, hr. 680 px measure. Put it in `<Container size="narrow">` or a grid
column next to a sticky table of contents.

## Navigation and footer

`SiteNav` and `SiteFooter` are rendered by the layout. Their links come from `nav.ts`:

- `ROUTES`: `home`, `proof`, `product.{overview, investigate, evidencePackets, prevention, askExhibit, aiAgents}`,
  `security`, `docs.{home, api, mcp, sandbox}`, `pricing`, `about`, `contact`, `legal.{privacy, terms}`,
  `app` (`/app`), `github`.
- `PRODUCT_LINKS`, `PRODUCT_OVERVIEW`, `COMPANY_LINKS`, `NAV`, `NAV_ACTIONS`, `FOOTER_COLUMNS`.

The header: `SiteNav.tsx` (server) prints the menus' dot drawings and hands them to `NavBar.tsx` (client: the
logo, the bar, the phone menu); `NavMenus.tsx` holds the dropdowns (`PreviewMenu`, and `Dropdown` for a menu
without drawings). Product is the wide menu: the five `PRODUCT_LINKS` on the left (icon, title, description), a
preview card on the right with the hovered or focused item's `art` (a `DotArt` name), its name on a chip and its
`caption` on an ink bar, and `PRODUCT_OVERVIEW` as the last row. Company is the same panel, narrow: its two
`COMPANY_LINKS` (Exhibit Labs and Contact, each with `art` and `caption`) above the same card, hanging from its
button. The card crossfades and is hidden from screen readers (the list carries the meaning). Both are disclosure
menus: a button with `aria-expanded`; arrow keys, Home and End move through the links; Escape, a click outside or
focus leaving closes. The bar is exactly `--s-nav-h` tall in every state.

URLs: `/product` (overview), `/product/investigate`, `/product/evidence`, `/product/prevention`, `/product/ask`,
`/product/agents`, `/security` (anchors `#approvals`, `#audit-log`), `/docs`, `/docs/api`, `/docs/mcp`,
`/docs/sandbox`, `/pricing`, `/about` (anchor `#founders`), `/contact`, `/legal/privacy`, `/legal/terms`,
`/proof`.

## Motion

`Reveal` (client): `children`, `delay?` (ms), `y?` (px), `as?`, `className?`. Server HTML is always visible;
after hydration only elements below the fold rise in once. Reduced motion and no-JS visitors see everything.
Stagger heading 0, text 70, picture 140. Transform and opacity only.

## Content rules (all pages)

- Plain, concrete, confident. No hype, no em dashes, sentence case. Fair to buyers: Exhibit fights when the
  record supports the merchant and refunds when the buyer is right. Never "beat the buyer".
- Real data only, from the records and docs listed above. Demo data labelled as demo. The evaluation always
  with its caveat: 30 synthetic cases written and labelled by the builders; it shows consistency, not
  accuracy on real disputes.
- No invented customers, logos, testimonials, funding, "Backed by YC" or SOC 2 claims. No PayPal logo; PayPal
  is named in text only. The footer carries "Not affiliated with or endorsed by PayPal".
- Pricing is "Planned" (`PRICING` in `src/components/landing/data.ts`).
- The team is Exhibit Labs, founded by Shivansh Dwivedi and Someet Shende, both named wherever the team is
  (`FOUNDERS`). No claim of incorporation, funding, customers or a team beyond the two co-founders.

## Files

| File | What |
| --- | --- |
| `src/app/(site)/layout.tsx` | Route-group layout: nav, main, footer, site.css, Instrument Serif |
| `src/app/(site)/site.css` | Tokens and every `s-` class (components layer, so Tailwind utilities override) |
| `index.ts` | Barrel export |
| `layout.tsx` | `Container`, `Section`, `SectionHead` |
| `type.tsx` | `Eyebrow`, `Heading`, `Lede`, `Body`, `Small`, `Mono` |
| `actions.tsx` | `ButtonLink`, `TextLink`, `Actions` |
| `Plate.tsx` / `paintings.ts` | Plates, captions, credits data |
| `dots/DotArt.tsx` / `DotSvg.tsx` / `paint.ts` / `art-data.ts` / `art-small.ts` / `generator/` | Dot art components, the SVG printer, generated grids, the drawings, generator and brand export |
| `ui.tsx` | Product UI fragment primitives |
| `fragments.tsx`, `packet.tsx`, `drawer.tsx`, `askparts.tsx` | The ready-made fragments; the packet's page parts; the prevention drawer's parts; the Ask palette's answer and chart |
| `records.tsx` | `Stat`, `Facts`, `StatusCode`, `Tag` |
| `Faq.tsx`, `PageHeader.tsx`, `Prose.tsx`, `Reveal.tsx` | As named |
| `SiteNav.tsx`, `NavBar.tsx`, `NavMenus.tsx`, `SiteFooter.tsx`, `nav.ts` | Navigation (server wrapper, client bar, menus), footer, information architecture |

## Docs

`/docs` is built from Markdown. Each page is a file in `src/content/docs/` with frontmatter (title,
description, section, order). The format, the supported Markdown and the sidebar order for all sixteen pages
are specified in `src/content/docs/README.md`; write pages there, not in TSX. Docs-only code lives in
`src/components/site/docs/`, every class is prefixed `d-`, and the styles are in `docs/docs.css`, imported by
`src/app/(site)/docs/layout.tsx` only. Tokens come from the kit (`--s-*`).

| File | What |
| --- | --- |
| `docs/markdown.ts` | The Markdown parser: frontmatter, headings with ids, paragraphs, lists, code fences with a language and title, GitHub-style callouts, pipe tables, `:::steps`, `:::cards`, `:::tabs`. Returns an AST, never HTML. |
| `docs/content.ts` | Server-only loader: reads the files, builds the sidebar, previous and next, and the search index. In production any bad frontmatter or broken `/docs` link or anchor fails the build; in development the problems show on the page. |
| `docs/render.tsx` | AST to React: `Blocks`, `Inlines`, `CodeBlock`, `DocLink` (internal links through `next/link`, external links with an arrow). Table cells holding only `GET`, `POST`, `PUT`, `PATCH` or `DELETE` render as method badges. |
| `docs/highlight.ts` | A small regex highlighter (bash, json, ts/tsx/js, env, yaml, http, md), run at build time. |
| `docs/DocArticle.tsx` | One page: header (with an optional `hero` beside the title), inline "On this page" for narrower screens, the body, "Edit this page on GitHub", previous and next. |
| `docs/Sidebar.tsx` | `DocsSidebar`: the section list, `aria-current="page"` on the open page. |
| `docs/Toc.tsx` | `DocsToc`: "On this page" with scroll tracking (`aria-current="location"`). |
| `docs/MobileBar.tsx` | `DocsMobileBar`: the sticky bar under the nav below 1024 px, with the current page and the docs menu. |
| `docs/Search.tsx` | `DocsSearchProvider` and `SearchTrigger`: the search dialog (native `<dialog>`, Cmd or Ctrl + K and `/`), over the static index at `/docs/search-index.json`. |
| `docs/CodeTabs.tsx`, `docs/CopyButton.tsx` | Client islands: tabbed code blocks and the copy button. |
| `docs/meta.ts` | `docsMetadata`: title, description, canonical URL and share cards (with the site's OG and Twitter images) for a docs page. |
| `docs/types.ts` | Shapes shared by the loader and the client components. |

Layout: sidebar (236 px) and article from 1024 px; "On this page" in its own column from 1280 px. Below 640 px,
tables stack each row into a small card with labelled cells. The docs home shows the one piece of dot art in
the docs (`magnifier`); reference pages carry none.

## Company pages

`/security`, `/pricing`, `/about`, `/contact`, `/legal/privacy` and `/legal/terms`. They are built from the kit
above; the few patterns the kit lacked live in `src/components/site/company/`. Every class there is prefixed
`s-co-` and sits in `company/company.css` (components layer, kit tokens), which the company components import
themselves. Overlays on paintings use the kit's `PlateStage` and `PlateOverlay`.

| File | What |
| --- | --- |
| `company/OnThisPage.tsx` | `OnThisPage items={[{ id, label }]}`: a ruled row of anchor links under a page header; scrolls sideways on phones. Used on the trust center (`/security`). |
| `company/FactStrip.tsx` | `FactStrip items={[{ k, v, note? }]}`: short facts in a ruled strip, key over value. Two columns on phones, one row on desktop. |
| `company/LegalPage.tsx` | `LegalPage`: header with the last-updated date, a four-point "short version", then `Prose` with a sticky list of sections (each an `h2` with an id). Both legal pages. |
| `company/ContactForm.tsx` (client) | The contact form. It POSTs JSON to `/api/contact`, which on the live site is the static site's Worker (`deploy/site/worker.ts`): Turnstile, then an email to the founders' inbox. "Sent" shows only on a 200. Where there is no sender (the Next app's route answers 501) it opens the visitor's email app with the message written; a failed send says why and offers that email and a copy. The preview on a plate shows the letter exactly as it arrives. Without JavaScript the form opens a plain-text email through its `mailto:` action. |
| `company/Scheduler.tsx` (client) | The demo-time picker inside the form: the next four weeks, times every half hour from 08:00 to 19:30 in the visitor's detected (changeable) zone, at least 12 hours ahead, up to three picks shown with their IST equivalents. Arrow keys, Home, End and Page keys in the calendar; roving focus in the times. |
| `company/contact/` | Pure modules the form and the Worker share: `zones.ts` (time zone arithmetic), `schedule.ts` (which times are offered), `submission.ts` (fields, limits, the one validator), `letter.ts` (the email's text and HTML), and `turnstile.ts` (the browser-only widget loader). Tested in `tests/contact-*.test.ts`. |
| `company/fragments.tsx` | Trust-center fragments from the app and Exhibit's own sandbox log: `ApprovalRequest` (the Nov 3 request with the app's real title, the agent's note and the decision), `AuditTrail` (that approval row by row, with who acted and the re-read of the dispute before filing), `CallInspector` (one stored `api_calls` row: no Authorization header, the packet by name and size), `AutopilotPanel` (Autopilot as it ships, and the default rules run by the app's own `evaluateRules` on the four sandbox chargebacks), `TraceRejection` (the case page's Investigation panel with the two `file_case_brief` steps of evaluation case inr-07: rejected, then fixed). |
| `company/cases.tsx` | `BriefCard run="fight" \| "refund" \| "refund2"` (the top of the app's brief card for Daniel Reyes, Jordan Kim or Priya Patel, with the four figures) and `PreventionSave` (Lena Hoffmann's at-risk order, the fix and $394 kept; demo merchant). |
| `company/records.ts` | Facts these pages show that the landing records don't export: the contact email, GitHub links, test counts per file, the Nov 3 approval as the sandbox log holds it, the SQLite tables, the four sandbox cases, the about page's eight facts (`MARKET_FACTS`, `EXHIBIT_FACTS`, each with its quoted source) and where each founder's face sits in their photo (`FOUNDER_PHOTOS`). Each value names its source. |
| `company/about.tsx` | The about page's pieces: `Portrait name ratio? head? at? alt?` (a founder's photo from `public/team`, cropped so both faces sit alike, grey until its card is hovered or focused), `FounderCard founder` (photo, name, role, GitHub), `FoundersQuote` (the quote, verbatim, attributed to both) and `EightFacts` (Exhibit in 8 facts: the market as a ruled grid of figures with their sources, then Exhibit's two on dark cards with the 3-of-12 `DotTrack`). |
| `company/meta.ts` | `companyMetadata({ title, description, path })`: canonical URL and share cards with the site's OG and Twitter images. A page that sets `openGraph` otherwise loses the root's images. |

Reusable classes: `s-co-promises` (numbered ruled grid, four across), `s-co-steps` (ordered steps on a rail),
`s-co-list` (ruled list, an icon per row; works on the night band), `s-co-matrix` (can / cannot table that
stacks on phones), `s-co-cards` (three cards), `s-co-ledger` (dotted-leader list), `s-co-track` (three-step
track), `s-co-eptable` (an `s-table` that stacks its rows on phones), `s-co-panel` (quiet grey panel),
`s-co-notyet` (two-column ruled list), `s-co-standfirst` (an argument's opening paragraph, a step above the lede),
`s-co-founders` (founder cards, two across from 640 px), `s-co-portrait` (a founder's photo), `s-co-quote` (a large
quote with its attribution), `s-co-facts` and `s-co-fact` (figure, label, source), `s-co-wedge` (facts on dark cards).

`fragments.tsx` imports `src/lib/autopilot-rules.ts`. It is the one `src/lib` import on the site, and it is safe:
the file is pure (no database, type-only imports), so the limits and verdicts on `/security` are computed by the
same code the app runs. The site 404 is `src/app/not-found.tsx`, built with the kit; unmatched URLs get it with
the site's nav and footer.

## Product pages

`/product` (overview) and the five capability pages, `/product/investigate`, `/product/evidence`,
`/product/prevention`, `/product/ask` and `/product/agents` (URLs in `ROUTES.product`; the keys
`evidencePackets`, `askExhibit` and `aiAgents` point at the short URLs). They are built from the kit above; the
patterns it lacked live in `src/components/site/product/`. Every class there is prefixed `s-pr-` and sits in
`product/product.css` (components layer, kit tokens), imported once by `src/app/(site)/product/layout.tsx`.
The kit gained one prop for them: `PageHeader eyebrowIndex="01"` shows the mono index in place of the gold
square, as on the homepage's product sections.

| File | What |
| --- | --- |
| `product/capabilities.ts` | `CHAPTERS`: the product tour's six chapters, 00 Platform (`PLATFORM`, `/product`) and then the five `CAPABILITIES` (01 to 05), each with its number, name, URL, one line and dot drawing. The five's names, URLs and lines come from `PRODUCT_LINKS` and the platform's URL and drawing from `PRODUCT_OVERVIEW`, so the menu and the tour agree (`tests/product-tour.test.ts`). |
| `product/ProductTour.tsx`, `TourBar.tsx` (client) | `ProductTour current="platform" \| "investigate" \| …`: the tour bar, first in every product page and sticky right under the header (`top: var(--s-nav-h)`, `--s-tour-h` tall). The six chapters with their `DotIcon`s, joined by a line filled up to the current one (`aria-current="page"`, on a white chip, its icon's gold accent showing), the next chapter on the right (on the last, Back to the platform: the header beside it already carries `CTA.primary`, and the end card offers it) and a reading-progress line along the bottom. The bar's own width picks the layout (container queries, classes `s-tour`): every name from 1240 px, icons only for the other chapters from 660 px, and below that the current chapter as a button that opens all six. Anchors on product pages clear both bars. |
| `product/TourMap.tsx` | The platform page's map, under its header: chapters 01 to 05 as cards with their drawings, number, name and line, joined by arrows, then "Start the tour". |
| `product/NextChapter.tsx` | `NextChapter current=…`: the end of each capability page, above its closing band: the next chapter as one card (its drawing, "Next chapter · 02 of 05", name, line, Continue), then links to the previous chapter and back to the platform. On 05 it points at `CTA.primary`. |
| `product/ProductCta.tsx` | `ProductCta id title rest lede art note?`: the closing band (grey) with the site's two actions and one framed dot drawing. |
| `product/meta.ts` | `productMetadata({ title, description, path })`: canonical URL and share cards that name the site's OG and Twitter images (a page `openGraph` otherwise drops them). |
| `product/data.ts` | Page-level views of the records: the Reyes run as the eight sources (`SOURCES`, with each tool's summary, exhibit and the reasoning points that cite it), every run on the case, the refunds, the filings, Lena Hoffmann, the radar, the Ask answer. Same records as `facts.ts`; server only. |
| `product/filing.ts` | `FILING`, `EXHIBIT_PAGES` (each exhibit page as the packet lays out that kind of record), `LETTERHEAD`, `PACKET_COVER` (the cover's date and facts), `pdfDate`, `pdfDateTime`: the Reyes response exactly as filed on Nov 3, 2026, 02:39 UTC (letter, exhibits A to F, the UPS record) and the agent's approval `apv_348c2c7423`. The call, run and actor come from `records/proof.json`; the letter, exhibits and approval row were copied read-only from the sandbox database, because `export.mjs` exports only the letter's first line. Note: the brief filed on Nov 3 is run `run_00a4c818-1a0`, whose exhibits are lettered differently from the Oct 21 run in `hero-runs.json` (A is checkout signals, B the UPS scans). |
| `product/SourceGraph.tsx` (client) | The app's evidence graph for one recorded run, every source selectable: what the tool returned, its exhibit, the reasoning that cites it. Fixed geometry, no measuring; stacks under 860 px (container query). |
| `product/PacketViewer.tsx` (client) | The packet as the PDF prints it: the cover with the filed letter, whose "(Exhibit B)" references, index rows and file tabs open that exhibit's page beside it (sticky on desktop), the cited exhibit tinted gold as in the app's packet panel. |
| `product/PreventionSave.tsx` (client) | Lena Hoffmann's at-risk order with a Before / After toggle (risk 84 to 0) and the German reply, with the English the app shows the merchant in a `<details>`. Demo merchant. |
| `product/AskReplay.tsx` (client) | The Ask Exhibit palette with the recorded answer and its chart; Replay plays the steps, the text and the chart back. Renders complete; reduced motion skips to the end. |
| `product/ConfigTabs.tsx` (client) | The app's three MCP configs (Claude Desktop, Claude Code, with PayPal's MCP) in tabs, with copy. |

Reusable classes: `s-pr-flow` on a `Plate` (with an `s-pr-flow__in` child) puts product UI in normal flow on the
painting: the plate grows with its content, so nothing is clipped at any width; set the painting margins with
`--pad-t`, `--pad-x`, `--pad-b` and `--pad-t-m` (phones). It uses `overflow: clip`, so a sticky child works.
`s-pr-stack` makes an `s-table` stack its rows on phones. `s-pr-chip--ink | green | neutral | red | outline` are
the app's approval-state chips. The Investigate page uses the kit's `RunTimeline` fragment in a `UiCard`.
