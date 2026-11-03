import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { DotArt } from "@/components/ui/DotArt";

export const metadata = { title: "Not found" };

/** A case id or page that doesn't exist (PayPal returned 404, or the link is wrong). */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <DotArt name="parcel" width={144} height={108} />
        <h1 className="mt-5 text-[24px] font-semibold leading-8 tracking-[-0.02em] text-ink">Nothing here</h1>
        <p className="mt-2 text-[14px] leading-[22px] text-muted">PayPal has no dispute with that id for this merchant, or the page has moved. Disputes resolved long ago may no longer be returned by the Disputes API.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/app/disputes" className={buttonClass("primary", "md")}>
            All disputes
          </Link>
          <Link href="/app" className={buttonClass("secondary", "md")}>
            Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
