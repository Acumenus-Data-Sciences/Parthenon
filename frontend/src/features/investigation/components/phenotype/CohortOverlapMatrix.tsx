interface CohortOverlapMatrixProps {
  cohorts: Array<{ id: number; name: string; count: number }>;
}

function truncate(name: string, max = 14): string {
  return name.length > max ? `${name.slice(0, max)}…` : name;
}

export function CohortOverlapMatrix({ cohorts }: CohortOverlapMatrixProps) {
  if (cohorts.length < 2) {
    return (
      <div className="rounded-lg border border-border-default/50 bg-surface-base/60 p-3">
        <h4 className="text-xs font-medium text-zinc-300 mb-2">Cohort Overlap Matrix</h4>
        <div className="flex items-center justify-center py-6 text-zinc-600 text-xs">
          Select 2+ cohorts to see overlap
        </div>
      </div>
    );
  }

  const n = cohorts.length;
  // grid: 1 label col + N data cols = N+1 total columns
  const gridCols = `repeat(${n + 1}, minmax(0, 1fr))`;

  return (
    <div className="rounded-lg border border-border-default/50 bg-surface-base/60 p-3">
      <h4 className="text-xs font-medium text-zinc-300 mb-2">Cohort Overlap Matrix</h4>

      <div
        className="text-[10px]"
        style={{ display: "grid", gridTemplateColumns: gridCols, gap: "1px" }}
      >
        {/* Top-left empty corner cell */}
        <div className="bg-surface-base" />

        {/* Column headers */}
        {cohorts.map((c) => (
          <div
            key={`col-${c.id}`}
            className="bg-surface-raised/60 px-1.5 py-1 text-zinc-400 font-medium text-center leading-tight overflow-hidden"
            title={c.name}
          >
            {truncate(c.name)}
          </div>
        ))}

        {/* Data rows */}
        {cohorts.map((row, ri) => (
          <>
            {/* Row header */}
            <div
              key={`row-header-${row.id}`}
              className="bg-surface-raised/60 px-1.5 py-1.5 text-zinc-400 font-medium leading-tight overflow-hidden"
              title={row.name}
            >
              {truncate(row.name)}
            </div>

            {/* Row cells */}
            {cohorts.map((col, ci) => {
              const isDiag = ri === ci;
              return (
                <div
                  key={`cell-${row.id}-${col.id}`}
                  className={`px-1.5 py-1.5 text-center border border-border-hover/40 ${
                    isDiag
                      ? "bg-[#9B1B30]/20 text-zinc-200 font-medium"
                      : "bg-surface-base text-zinc-600"
                  }`}
                  title={
                    isDiag
                      ? `${row.name}: ${row.count.toLocaleString()} patients`
                      : "Run operations to compute overlap"
                  }
                >
                  {isDiag ? row.count.toLocaleString() : "—"}
                </div>
              );
            })}
          </>
        ))}
      </div>

      <p className="text-[10px] text-zinc-600 mt-2 leading-tight">
        Diagonal: cohort sizes. Off-diagonal: run set operations to compute overlap.
      </p>
    </div>
  );
}
