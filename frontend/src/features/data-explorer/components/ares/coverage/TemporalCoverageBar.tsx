interface TemporalCoverageBarProps {
  earliest: string | null;
  latest: string | null;
  globalEarliest?: string | null;
  globalLatest?: string | null;
}

function parseYear(dateStr: string | null): number | null {
  if (!dateStr) return null;
  // Handle YYYYMMDD or YYYY-MM-DD formats
  const clean = dateStr.replace(/-/g, "");
  const year = parseInt(clean.substring(0, 4), 10);
  return isNaN(year) ? null : year;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const clean = dateStr.replace(/-/g, "");
  if (clean.length >= 8) {
    const y = clean.substring(0, 4);
    const m = clean.substring(4, 6);
    return `${m}/${y}`;
  }
  return dateStr;
}

export default function TemporalCoverageBar({
  earliest,
  latest,
  globalEarliest,
  globalLatest,
}: TemporalCoverageBarProps) {
  const startYear = parseYear(earliest);
  const endYear = parseYear(latest);
  const gStart = parseYear(globalEarliest ?? null) ?? startYear;
  const gEnd = parseYear(globalLatest ?? null) ?? endYear;

  if (startYear === null || endYear === null || gStart === null || gEnd === null) {
    return <span className="text-[10px] text-[#555]">--</span>;
  }

  const totalSpan = Math.max(gEnd - gStart, 1);
  const leftPct = Math.max(0, ((startYear - gStart) / totalSpan) * 100);
  const widthPct = Math.max(2, ((endYear - startYear) / totalSpan) * 100);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="relative h-2 w-full rounded bg-[#1a1a22]" title={`${formatDate(earliest)} - ${formatDate(latest)}`}>
        <div
          className="absolute top-0 h-2 rounded bg-[#2DD4BF]/50"
          style={{ left: `${leftPct}%`, width: `${Math.min(widthPct, 100 - leftPct)}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-[#666]">
        <span>{formatDate(earliest)}</span>
        <span>{formatDate(latest)}</span>
      </div>
    </div>
  );
}
