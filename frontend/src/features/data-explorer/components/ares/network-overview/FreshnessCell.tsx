interface FreshnessCellProps {
  daysSinceRefresh: number | null;
}

export default function FreshnessCell({ daysSinceRefresh }: FreshnessCellProps) {
  if (daysSinceRefresh === null) {
    return <span className="text-[#555]">--</span>;
  }

  const isStale = daysSinceRefresh > 30;
  const isWarning = daysSinceRefresh > 14;

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={
          isStale
            ? "text-[#e85d75]"
            : isWarning
              ? "text-[#C9A227]"
              : "text-[#888]"
        }
      >
        {daysSinceRefresh}d
      </span>
      {isStale && (
        <span className="rounded bg-[#9B1B30]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#e85d75]">
          STALE
        </span>
      )}
    </div>
  );
}
