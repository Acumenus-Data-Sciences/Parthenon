export function HubCardSkeleton() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised p-5">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-surface-accent" />
        <span className="h-3 w-24 animate-pulse rounded bg-surface-accent" />
      </div>
      <div className="w-full space-y-2">
        <div className="h-7 w-16 animate-pulse rounded bg-surface-accent" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-surface-overlay" />
      </div>
    </div>
  );
}
