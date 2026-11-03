// The six public-domain trompe-l'oeil "letter rack" paintings the site sets the product into.
// Files live in public/art/ (WebP, about 2400 px on the long edge). Every painting is credited where it
// is shown (PlateCaption) and in the footer (SiteFooter). A painting is never presented as Exhibit's product.

export type PaintingId = "harnett" | "petoOfficeBoard" | "mitchell" | "sommar" | "petoOldSouvenirs" | "hoogstraten";

export type Painting = {
  id: PaintingId;
  /** Plate number used in captions and the footer credits. */
  plate: number;
  src: string;
  width: number;
  height: number;
  title: string;
  artist: string;
  /** As the museum dates it, in words ("about 1881 to 1901"). */
  date: string;
  /** Holding museum. */
  museum: string;
  /** "CC0" or "public domain". */
  license: string;
  /** Extra source note, e.g. "via Wikimedia Commons". */
  via?: string;
  /** The museum's or Commons' page for the work. */
  page: string;
  /** Describes the painting itself, for alt text. Never describes Exhibit. */
  alt: string;
  /** Dominant colour of the canvas, shown while the image loads. */
  tone: string;
};

export const PAINTINGS: Record<PaintingId, Painting> = {
  harnett: {
    id: "harnett",
    plate: 1,
    src: "/art/harnett-artists-letter-rack.webp",
    width: 2004,
    height: 2400,
    title: "The Artist's Letter Rack",
    artist: "William Michael Harnett",
    date: "1879",
    museum: "The Metropolitan Museum of Art",
    license: "CC0",
    page: "https://www.metmuseum.org/art/collection/search/10993",
    alt: "William Michael Harnett, The Artist's Letter Rack, 1879: letters and cards tucked behind pink tape on a pine board",
    tone: "#9a7440",
  },
  petoOfficeBoard: {
    id: "petoOfficeBoard",
    plate: 2,
    src: "/art/peto-office-board.webp",
    width: 2006,
    height: 2400,
    title: "Office Board",
    artist: "John F. Peto",
    date: "1885",
    museum: "The Metropolitan Museum of Art",
    license: "CC0",
    page: "https://www.metmuseum.org/art/collection/search/11761",
    alt: "John F. Peto, Office Board, 1885: a photograph, a newspaper and letters held by pink tape on a wooden board",
    tone: "#5b3a22",
  },
  mitchell: {
    id: "mitchell",
    plate: 3,
    src: "/art/mitchell-rack-picture-dr-nones.webp",
    width: 1808,
    height: 2250,
    title: "Rack Picture for Dr. Nones",
    artist: "William A. Mitchell",
    date: "1879",
    museum: "Art Institute of Chicago",
    license: "CC0",
    page: "https://www.artic.edu/artworks/154496",
    alt: "William A. Mitchell, Rack Picture for Dr. Nones, 1879: envelopes and a theatre ticket behind a red tape cross",
    tone: "#c49a52",
  },
  sommar: {
    id: "sommar",
    plate: 4,
    src: "/art/sommar-letter-rack.webp",
    width: 1920,
    height: 1654,
    title: "Letter Rack",
    artist: "Hindric Sebastian Sommar",
    date: "18th century",
    museum: "Nationalmuseum, Stockholm",
    license: "public domain",
    via: "via Wikimedia Commons",
    page: "https://commons.wikimedia.org/wiki/File:Letter_Rack._Trompe_l%27oeil_(Hindric_Sebastian_Sommar)_-_Nationalmuseum_-_21714.tif",
    alt: "Hindric Sebastian Sommar, Letter Rack, trompe l'oeil: letters, an almanac, scissors, keys and combs pinned to a pine board",
    tone: "#b8853f",
  },
  petoOldSouvenirs: {
    id: "petoOldSouvenirs",
    plate: 5,
    src: "/art/peto-old-souvenirs.webp",
    width: 1957,
    height: 2400,
    title: "Old Souvenirs",
    artist: "John F. Peto",
    date: "about 1881 to 1901",
    museum: "The Metropolitan Museum of Art",
    license: "CC0",
    page: "https://www.metmuseum.org/art/collection/search/11763",
    alt: "John F. Peto, Old Souvenirs: a photograph, a newspaper, a report and a label reading Important Information Inside, held by pink tape",
    tone: "#4a3a26",
  },
  hoogstraten: {
    id: "hoogstraten",
    plate: 6,
    src: "/art/hoogstraten-still-life.webp",
    width: 2400,
    height: 1836,
    title: "Trompe-l'oeil Still Life",
    artist: "Samuel van Hoogstraten",
    date: "1664",
    museum: "Dordrechts Museum",
    license: "public domain",
    via: "via Wikimedia Commons",
    page: "https://commons.wikimedia.org/wiki/File:Tromp-l%27oeil_Still-Life_1664_Hoogstraeten.jpg",
    alt: "Samuel van Hoogstraten, Trompe-l'oeil Still Life, 1664: a comb, letters, a book and ribbons held by red straps on a dark board",
    tone: "#2a1d14",
  },
};

/** In plate order, for the footer credits. */
export const PAINTING_LIST: Painting[] = Object.values(PAINTINGS).sort((a, b) => a.plate - b.plate);

/** "William Michael Harnett, The Artist's Letter Rack, 1879. The Metropolitan Museum of Art, CC0." as plain text. */
export const creditText = (p: Painting) => `${p.artist}, ${p.title}, ${p.date}. ${p.museum}, ${p.license}${p.via ? `, ${p.via}` : ""}.`;
