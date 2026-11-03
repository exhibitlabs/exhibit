import type { Metadata } from "next";
import { ClosingPlate, Pricing, Questions, Security } from "@/components/site/home/Closing";
import { Gap } from "@/components/site/home/Gap";
import { Hero } from "@/components/site/home/Hero";
import { Lifecycle } from "@/components/site/home/Lifecycle";
import { ProductSections } from "@/components/site/home/Product";
import { ProofBoard } from "@/components/site/home/ProofBoard";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Every fact on this page is rendered from checked-in records (src/components/site/facts.ts reads
// src/components/landing/records, data.ts and eval/results.json): no database and no network at request time.
export default function Home() {
  return (
    <>
      <Hero />
      <Gap />
      <ProductSections />
      <Lifecycle />
      <ProofBoard />
      <Security />
      <Pricing />
      <Questions />
      <ClosingPlate />
    </>
  );
}
