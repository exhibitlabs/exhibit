/**
 * The title row every app page shares: a noun at 24px, one grey line about the data (the finding, the scope),
 * and the page's real actions on the right. No eyebrow; the shell already names the product and the merchant.
 */
export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 px-4 pt-6 sm:px-6 md:flex-row md:items-end md:justify-between md:gap-8">
      <div className="min-w-0">
        <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-[760px] text-[14px] leading-[22px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
