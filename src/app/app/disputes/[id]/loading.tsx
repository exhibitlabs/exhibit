import { Skeleton } from "@/components/ui/Skeleton";

/** Case page placeholder: sticky header, lifecycle, evidence graph, then brief and response. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading case">
      <div className="space-y-3 border-b border-line px-4 pb-5 pt-5 sm:px-6 lg:px-8">
        <Skeleton className="h-3 w-24" />
        <div className="flex items-end justify-between gap-6">
          <div className="space-y-2.5">
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-7 w-80 max-w-[70vw]" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <Skeleton className="hidden h-11 w-52 rounded-lg sm:block" />
        </div>
        <Skeleton className="mt-2 h-8 w-full max-w-3xl" />
      </div>
      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-[300px] w-full rounded-xl" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Skeleton className="h-[420px] rounded-xl" />
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
