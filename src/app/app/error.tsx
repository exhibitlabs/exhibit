"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClass } from "@/components/ui/Button";

/** Something on this page failed to load. The rest of the app keeps working, and nothing was sent anywhere. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div role="alert" className="max-w-md text-center">
        <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-ink">This page didn&apos;t load</h1>
        <p className="mt-2 text-[14px] leading-[22px] text-muted">
          {error.message && !error.message.includes("digest") ? error.message : "Something went wrong while loading it."} Nothing was sent to PayPal. Your cases, briefs and the audit log are unchanged.
        </p>
        {error.digest ? <p className="mono mt-2 text-[12px] text-muted">ref {error.digest}</p> : null}
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="primary" onClick={reset}>
            <RotateCw className="size-3.5" /> Try again
          </Button>
          <Link href="/app" className={buttonClass("secondary", "md")}>
            Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
