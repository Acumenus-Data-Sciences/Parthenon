import { CDM_TABLE_ORDER, CDM_TABLE_COLORS, fmtNumber } from "../../lib/fhir-utils";

export function RecordsBarChart({ records }: { records: Record<string, number> }) {
  const ordered = CDM_TABLE_ORDER.filter((t) => (records[t] ?? 0) > 0).map(
    (t) => ({ table: t, count: records[t] ?? 0 }),
  );
  const extra = Object.entries(records)
    .filter(([t, n]) => !CDM_TABLE_ORDER.includes(t) && n > 0)
    .map(([table, count]) => ({ table, count }));
  const all = [...ordered, ...extra];
  if (all.length === 0) return null;
  const max = Math.max(...all.map((e) => e.count), 1);

  return (
    <div className="space-y-2">
      {all.map(({ table, count }) => {
        const pct = Math.max((count / max) * 100, 2);
        const color = CDM_TABLE_COLORS[table] ?? "var(--text-muted)";
        return (
          <div key={table} className="flex items-center gap-3">
            <span className="w-44 shrink-0 text-xs text-text-secondary font-mono truncate">
              {table}
            </span>
            <div className="flex-1 h-4 rounded bg-surface-overlay overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span
              className="w-12 shrink-0 text-right text-xs tabular-nums font-semibold"
              style={{ color }}
            >
              {fmtNumber(count)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
