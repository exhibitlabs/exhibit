"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/** Something on this page failed to load. The rest of the app keeps working. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-red-soft text-red">
          <TriangleAlert className="size-5" />
        </span>
        <h1 className="display mt-4 text-[22px]">This page didn&apos;t load</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          {error.message && !error.message.includes("digest") ? error.message : "Something went wrong while loading it."} Nothing was sent to PayPal. Your cases, briefs and the audit log are unchanged.
        </p>
        {error.digest ? <p className="num mt-2 text-[11px] text-faint">ref {error.digest}</p> : null}
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="primary" onClick={reset}>
            <RotateCw className="size-4" /> Try again
          </Button>
          <Link href="/app" className="inline-flex h-9 items-center rounded-lg border border-line px-3.5 text-[13.5px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-[#fafafa]">
            Command center
          </Link>
        </div>
      </div>
    </div>
  );
}
