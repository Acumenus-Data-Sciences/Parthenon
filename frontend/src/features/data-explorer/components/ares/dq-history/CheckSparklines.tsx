interface CheckSparklinesProps {
  /** Map of check_id -> array of pass/fail/null for last 6 releases */
  sparklines: Record<string, Array<boolean | null>>;
  checkId: string;
}

export default function CheckSparklines({ sparklines, checkId }: CheckSparklinesProps) {
  const history = sparklines[checkId];
  if (!history || history.length === 0) return null;

  return (
    <div className="inline-flex items-center gap-0.5" title={`Last ${history.length} releases`}>
      {history.map((passed, i) => (
        <span
          key={i}
          className={`inline-block h-3 w-1.5 rounded-sm ${
            passed === null
              ? "bg-[#333]"
              : passed
                ? "bg-[#2DD4BF]"
                : "bg-[#9B1B30]"
          }`}
        />
      ))}
    </div>
  );
}

/** Standalone sparkline row for embedding in delta tables */
export function SparklineCell({
  sparklines,
  checkId,
}: {
  sparklines: Record<string, Array<boolean | null>> | undefined;
  checkId: string;
}) {
  if (!sparklines) {
    return <span className="text-[10px] text-[#555]">--</span>;
  }

  return <CheckSparklines sparklines={sparklines} checkId={checkId} />;
}
