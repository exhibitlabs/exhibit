/** The header every app page shares: eyebrow, title, one line of context, and page actions. */
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-line px-4 pb-5 pt-6 sm:px-6 md:flex-row md:items-end md:justify-between md:gap-6 lg:px-8 lg:pt-7">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5 text-[12px] text-muted">{eyebrow}</div> : null}
        <h1 className="display text-[26px] leading-[1.1] lg:text-[28px]">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
