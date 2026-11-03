import { Instrument_Serif } from "next/font/google";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import "./site.css";

// Instrument Serif italic sets only the titles of paintings in their museum captions.
const instrument = Instrument_Serif({ weight: "400", style: "italic", subsets: ["latin"], variable: "--font-instrument", display: "swap" });

/** Shared frame for every marketing page: navigation, main, footer. Pages render inside <main id="main">. */
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`site ${instrument.variable}`}>
      <SiteNav />
      <main id="main" tabIndex={-1} style={{ outline: "none" }}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
