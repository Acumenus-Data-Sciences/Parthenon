import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { RecordCount } from "../../types/dataExplorer";

interface RecordCountsPanelProps {
  data: RecordCount[];
}

/** Format large numbers compactly: 1005787 -> "1.0M" */
function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Convert table_name to Title Case with spaces */
function formatTableName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { displayName: string; count: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-surface-highlight bg-surface-overlay px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-text-primary">{item.displayName}</p>
      <p className="mt-0.5 font-['IBM_Plex_Mono',monospace] text-xs text-success">
        {item.count.toLocaleString()} records
      </p>
    </div>
  );
}

export function RecordCountsPanel({ data }: RecordCountsPanelProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-raised py-16">
        <p className="text-sm text-text-muted">No record count data available</p>
      </div>
    );
  }

  const sorted = [...data]
    .sort((a, b) => b.count - a.count)
    .map((d) => ({
      ...d,
      displayName: formatTableName(d.table),
    }));

  const barHeight = 32;
  const chartHeight = Math.max(sorted.length * barHeight + 40, 200);

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
        Record Counts by CDM Table
      </h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
          barCategoryGap="20%"
        >
          <XAxis
            type="number"
            tickFormatter={formatCompact}
            tick={{ fill: "var(--text-primary)", fontSize: 11 }}
            axisLine={{ stroke: "var(--surface-highlight)" }}
            tickLine={{ stroke: "var(--surface-highlight)" }}
          />
          <YAxis
            type="category"
            dataKey="displayName"
            width={180}
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(45,212,191,0.06)" }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {sorted.map((_, idx) => (
              <Cell
                key={`cell-${idx}`}
                fill="var(--success)"
                fillOpacity={1 - idx * 0.04 > 0.3 ? 1 - idx * 0.04 : 0.3}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
