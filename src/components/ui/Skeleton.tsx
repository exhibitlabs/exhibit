import { clsx } from "clsx";

/** Loading placeholder. Pass a size with className; it shimmers unless the visitor prefers less motion. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={clsx("shimmer rounded-md", className)} style={style} />;
}

/** A page header placeholder that matches PageHeader's layout. */
export function HeaderSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div className="flex items-end justify-between gap-6 border-b border-line px-4 pb-5 pt-7 sm:px-6 lg:px-8">
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3.5 w-[420px] max-w-[70vw]" />
      </div>
      <div className="hidden gap-2 sm:flex">
        {Array.from({ length: actions }, (_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
