import { clsx } from "clsx";

/** Loading placeholder: a flat bar at the real size of the value it stands for. No shimmer. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={clsx("skeleton rounded-[6px]", className)} style={style} />;
}

/** A page header placeholder that matches PageHeader: the title and its one line, the actions on the right. */
export function HeaderSkeleton({ actions = 0, subtitle = true }: { actions?: number; subtitle?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-6 px-4 pt-6 sm:px-6">
      <div className="space-y-2.5">
        <Skeleton className="h-7 w-56" />
        {subtitle ? <Skeleton className="h-4 w-[460px] max-w-[70vw]" /> : null}
      </div>
      <div className="hidden gap-2 sm:flex">
        {Array.from({ length: actions }, (_, i) => (
          <Skeleton key={i} className="h-8 w-32 rounded-[8px]" />
        ))}
      </div>
    </div>
  );
}
