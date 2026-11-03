import { HeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

/**
 * Shown while a page's server data loads: the final layout with flat bars at each value's real size, so nothing
 * shifts when the data lands. Mirrors the common page: the title row, a divided strip of figures, a table.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeaderSkeleton actions={2} />
      <div className="space-y-4 px-4 pt-6 sm:px-6">
        <div className="grid grid-cols-2 rounded-[10px] border border-line lg:grid-cols-4 lg:divide-x lg:divide-line">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2.5 px-5 py-4">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ))}
        </div>
        <div>
          <div className="flex h-9 items-center gap-6 border-b border-line">
            {[48, 140, 90, 70, 110].map((w, i) => (
              <Skeleton key={i} className="h-3" style={{ width: w }} />
            ))}
          </div>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex h-[60px] items-center gap-6 border-b border-rule">
              <Skeleton className="h-3.5 w-14" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
              <Skeleton className="hidden h-3.5 w-24 md:block" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="hidden h-5 w-24 rounded-[6px] md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
