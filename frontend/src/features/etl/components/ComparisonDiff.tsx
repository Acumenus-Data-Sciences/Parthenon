import type { ComparisonData } from "../api";

interface ComparisonDiffProps {
  data: ComparisonData;
  activeFilter: string | null;
}

interface DiffRow {
  key: string;
  table: string;
  column: string;
  metric: string;
  baseline: string;
  current: string;
  delta: string;
  colorClass: string;
  category: string;
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString() : String(value);
}

function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export default function ComparisonDiff({ data, activeFilter }: ComparisonDiffProps) {
  const rows: DiffRow[] = [];

  for (const r of data.regressions) {
    rows.push({
      key: `reg-${r.table}-${r.column}-${r.metric}`,
      table: r.table,
      column: r.column,
      metric: r.metric,
      baseline: formatNumber(r.baseline),
      current: formatNumber(r.current),
      delta: formatDelta(r.delta),
      colorClass: "text-red-400",
      category: "regressions",
    });
  }

  for (const i of data.improvements) {
    rows.push({
      key: `imp-${i.table}-${i.column}-${i.metric}`,
      table: i.table,
      column: i.column,
      metric: i.metric,
      baseline: formatNumber(i.baseline),
      current: formatNumber(i.current),
      delta: formatDelta(i.delta),
      colorClass: "text-emerald-400",
      category: "improvements",
    });
  }

  for (const s of data.schema_changes) {
    rows.push({
      key: `sch-${s.table}-${s.column}-${s.change}`,
      table: s.table,
      column: s.column,
      metric: s.change,
      baseline: s.change === "REMOVED" ? s.type : "\u2014",
      current: s.change === "NEW" ? s.type : s.change === "REMOVED" ? "\u2014" : s.type,
      delta: s.change.toUpperCase(),
      colorClass: "text-purple-400",
      category: "schema_changes",
    });
  }

  const filtered = activeFilter
    ? rows.filter((r) => r.category === activeFilter)
    : rows;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 uppercase border-b border-gray-700">
            <th className="text-left py-3 px-3">Table.Column</th>
            <th className="text-left py-3 px-3">Metric</th>
            <th className="text-right py-3 px-3">Baseline</th>
            <th className="text-right py-3 px-3">Current</th>
            <th className="text-right py-3 px-3">Delta</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center text-gray-500 py-8">
                No changes in this category
              </td>
            </tr>
          ) : (
            filtered.map((row) => (
              <tr
                key={row.key}
                className={`border-b border-gray-800/50 ${row.colorClass}`}
              >
                <td className="py-2.5 px-3">
                  {row.table}.{row.column}
                </td>
                <td className="py-2.5 px-3">{row.metric}</td>
                <td className="py-2.5 px-3 text-right">{row.baseline}</td>
                <td className="py-2.5 px-3 text-right">{row.current}</td>
                <td className="py-2.5 px-3 text-right font-medium">{row.delta}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
