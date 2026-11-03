import { Instrument_Serif } from "next/font/google";
import "../(site)/site.css";
import "@/components/pitch/deck.css";

// The deck is drawn with the website's kit (src/components/site), so it loads the site's stylesheet and the serif
// that sets painting titles in captions. It has no site nav or footer: the deck is its own full-screen frame.
const instrument = Instrument_Serif({ weight: "400", style: "italic", subsets: ["latin"], variable: "--font-instrument", display: "swap" });

export default function PitchLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={`site pd-site ${instrument.variable}`}>{children}</div>;
}
