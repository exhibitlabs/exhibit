import Link from "next/link";
import { LogoMark } from "../ui/Logo";
import { DEMO_URL, GITHUB_URL } from "./data";
import { Container } from "./Primitives";

const LINKS = [
  { label: "How it works", href: "/#how" },
  { label: "Fair to buyers", href: "/#fair" },
  { label: "For agents", href: "/#agents" },
  { label: "Proof", href: "/proof" },
  { label: "Pricing", href: "/#pricing" },
] as const;

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-md focus:bg-ink focus:px-3 focus:py-1.5 focus:text-[13px] focus:text-white">
        Skip to content
      </a>
      <Container className="flex h-14 items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" aria-label="Exhibit, home">
          <LogoMark size={22} />
          <span className="text-[16px] font-semibold leading-none tracking-[-0.04em]">Exhibit</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 text-[13.5px] text-muted lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-sm transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
              {l.label}
            </Link>
          ))}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="rounded-sm transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
            GitHub<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </nav>
        <div className="flex items-center gap-1.5">
          <Link href="/proof" className="hidden h-9 items-center rounded-full px-3 text-[13.5px] text-ink-2 transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-ink sm:inline-flex lg:hidden">
            Proof
          </Link>
          <Link href={DEMO_URL} className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-[#262626] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
            Try the live demo
          </Link>
        </div>
      </Container>
    </header>
  );
}
