import Link from "next/link";
import { DEMO_URL } from "@/components/landing/data";
import { ButtonLink } from "@/components/landing/Primitives";
import { Logo } from "@/components/ui/Logo";

export const metadata = { title: "Page not found" };

/** An address that doesn't exist outside /app. Inside /app, unknown pages get the app's own not-found page. */
export default function NotFound() {
  return (
    <main className="lp-page flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-16 text-center text-ink">
      <Link href="/" aria-label="Exhibit, home" className="mb-10 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
        <Logo mark={28} />
      </Link>
      <p className="num text-[13px] text-muted">404</p>
      <h1 className="mt-2 text-balance text-[28px] font-semibold leading-[1.12] tracking-[-0.032em] sm:text-[34px]">That page doesn&apos;t exist.</h1>
      <p className="mt-4 max-w-[420px] text-pretty text-[15px] leading-relaxed text-muted">The link may be old or mistyped. The live demo and the proof behind it are one click away.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href={DEMO_URL}>Try the live demo</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Home
        </ButtonLink>
        <ButtonLink href="/proof" variant="secondary">
          See the proof
        </ButtonLink>
      </div>
    </main>
  );
}
