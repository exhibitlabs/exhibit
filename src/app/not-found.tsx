import { Instrument_Serif } from "next/font/google";
import { ButtonLink } from "@/components/site/actions";
import { DotArt } from "@/components/site/dots/DotArt";
import { Container } from "@/components/site/layout";
import { ROUTES } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { Eyebrow, Heading, Lede } from "@/components/site/type";
import "./(site)/site.css";

export const metadata = { title: "Page not found" };

const instrument = Instrument_Serif({ weight: "400", style: "italic", subsets: ["latin"], variable: "--font-instrument", display: "swap" });

/** An address that doesn't exist outside /app (the app has its own not-found page). Uses the site's frame. */
export default function NotFound() {
  return (
    <div className={`site ${instrument.variable}`}>
      <SiteNav />
      <main id="main" tabIndex={-1} style={{ outline: "none" }}>
        <Container>
          <div className="s-404">
            <div className="s-404__txt">
              <Eyebrow>404</Eyebrow>
              <Heading as="h1" size="h1" title="No such address." rest="This page was returned to sender." />
              <Lede className="s-404__lede">The link may be old or mistyped, or the page is still being written. The live demo and the record behind it are one click away.</Lede>
              <div className="s-actions">
                <ButtonLink href={ROUTES.app} arrow>
                  Try the live demo
                </ButtonLink>
                <ButtonLink href={ROUTES.home} variant="ghost">
                  Home
                </ButtonLink>
                <ButtonLink href={ROUTES.proof} variant="ghost">
                  See the record
                </ButtonLink>
              </div>
            </div>
            <DotArt name="letter" ghost frame className="s-404__art" title="Dot drawing of a letter, in outline: undelivered" />
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
