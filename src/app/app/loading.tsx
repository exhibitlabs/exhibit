import { HeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

/** Shown while a page's server data loads. Mirrors the common layout: header, a KPI row, a table. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeaderSkeleton actions={2} />
      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card space-y-3 px-5 py-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          ))}
        </div>
        <div className="card overflow-hidden">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
