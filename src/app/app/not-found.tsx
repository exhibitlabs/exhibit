import { SearchX } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Not found" };

/** A case id or page that doesn't exist (PayPal returned 404, or the link is wrong). */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-sunken text-ink-2">
          <SearchX className="size-5" />
        </span>
        <h1 className="display mt-4 text-[22px]">Nothing here</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">PayPal has no dispute with that id for this merchant, or the page has moved. Disputes that were resolved long ago may no longer be returned by the Disputes API.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/app/disputes" className="inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-[13.5px] font-medium text-white transition-colors hover:bg-[#262626]">
            All disputes
          </Link>
          <Link href="/app" className="inline-flex h-9 items-center rounded-lg border border-line px-3.5 text-[13.5px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-[#fafafa]">
            Command center
          </Link>
        </div>
      </div>
    </div>
  );
}
