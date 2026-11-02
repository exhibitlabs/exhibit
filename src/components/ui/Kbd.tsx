import { clsx } from "clsx";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={clsx("num inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-[5px] border border-line bg-[#fafafa] px-1 text-[10.5px] font-medium text-muted shadow-[0_1px_0_var(--line)]", className)}>
      {children}
    </kbd>
  );
}
