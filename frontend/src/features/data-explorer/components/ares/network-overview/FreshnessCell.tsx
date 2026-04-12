interface FreshnessCellProps {
  daysSinceRefresh: number | null;
}

export default function FreshnessCell({ daysSinceRefresh }: FreshnessCellProps) {
  if (daysSinceRefresh === null) {
    return <span className="text-text-ghost">--</span>;
  }

  const isStale = daysSinceRefresh > 30;
  const isWarning = daysSinceRefresh > 14;

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={
          isStale
            ? "text-critical"
            : isWarning
              ? "text-accent"
              : "text-text-muted"
        }
      >
        {daysSinceRefresh}d
      </span>
      {isStale && (
        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-critical">
          STALE
        </span>
      )}
    </div>
  );
}
