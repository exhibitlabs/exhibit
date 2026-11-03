import { Skeleton } from "@/components/ui/Skeleton";

/** Case page placeholder in the page's own shape: header, lifecycle, evidence graph, then brief and response. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading case">
      <div className="border-b border-line px-4 pb-4 pt-5 sm:px-6">
        <Skeleton className="h-3.5 w-40" />
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2.5">
            <Skeleton className="h-7 w-80 max-w-[70vw]" />
            <Skeleton className="h-4 w-[420px] max-w-[80vw]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-[8px]" />
            <Skeleton className="h-8 w-44 rounded-[8px]" />
          </div>
        </div>
      </div>
      <div className="flex gap-6 border-b border-line px-4 py-4 sm:px-6">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex flex-1 gap-2.5">
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-4 px-4 pt-5 sm:px-6">
        <Skeleton className="h-[340px] w-full rounded-[10px]" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Skeleton className="h-[420px] rounded-[10px]" />
          <Skeleton className="h-[420px] rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}
