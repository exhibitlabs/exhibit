import type { Metadata } from "next";
import { Agents } from "@/components/landing/Agents";
import { Ask } from "@/components/landing/Ask";
import { Fair } from "@/components/landing/Fair";
import { FinalCta, Footer } from "@/components/landing/Footer";
import { Founder } from "@/components/landing/Founder";
import { Gap } from "@/components/landing/Gap";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Money } from "@/components/landing/Money";
import { Nav } from "@/components/landing/Nav";
import { Prevention } from "@/components/landing/Prevention";
import { ProofSummary } from "@/components/landing/ProofSummary";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Everything on this page is rendered from checked-in records (src/components/landing/records):
// no database, no credentials, no network at request time.
export default function Landing() {
  return (
    <div className="lp-page bg-white text-ink">
      <Nav />
      <main id="main">
        <Hero />
        <Gap />
        <HowItWorks />
        <Fair />
        <Prevention />
        <Ask />
        <Agents />
        <ProofSummary />
        <Money />
        <Founder />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
