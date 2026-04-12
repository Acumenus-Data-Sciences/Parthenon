import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ConceptSummary } from "../../types/dataExplorer";

interface TopConceptsBarProps {
  data: ConceptSummary[];
  onConceptClick?: (conceptId: number) => void;
}

/** Format large numbers compactly */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Truncate long concept names */
function truncate(s: string, max = 40): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

/** Interpolate between two hex colors by fraction t in [0,1] */
function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bl})`;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ConceptSummary }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="max-w-xs rounded-lg border border-surface-highlight bg-surface-overlay px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-text-primary">
        {item.concept_name}
      </p>
      <p className="mt-0.5 font-['IBM_Plex_Mono',monospace] text-xs text-text-secondary">
        ID: {item.concept_id}
      </p>
      <p className="font-['IBM_Plex_Mono',monospace] text-xs text-success">
        {item.count.toLocaleString()} records
      </p>
      {item.prevalence != null && (
        <p className="font-['IBM_Plex_Mono',monospace] text-xs text-accent">
          Prevalence: {(item.prevalence * 100).toFixed(2)}%
        </p>
      )}
    </div>
  );
}

export function TopConceptsBar({ data, onConceptClick }: TopConceptsBarProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-raised py-16">
        <p className="text-sm text-text-muted">No concept data available</p>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.count - a.count);
  const chartData = sorted.map((d) => ({
    ...d,
    displayName: truncate(d.concept_name),
  }));

  const barHeight = 30;
  const chartHeight = Math.max(chartData.length * barHeight + 40, 200);

  const handleClick = (entry: ConceptSummary) => {
    if (onConceptClick) {
      onConceptClick(entry.concept_id);
    }
  };

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
        Top Concepts
      </h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
          barCategoryGap="18%"
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
            width={220}
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(201,162,39,0.06)" }}
          />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            onClick={(_data, _idx, e) => {
              const entry = (e as unknown as { payload: ConceptSummary })?.payload;
              if (entry) handleClick(entry);
            }}
            style={{ cursor: onConceptClick ? "pointer" : "default" }}
          >
            {chartData.map((_, idx) => (
              <Cell
                key={`cell-${idx}`}
                fill={lerpColor(
                  "var(--primary)",
                  "var(--success)",
                  chartData.length > 1 ? idx / (chartData.length - 1) : 0,
                )}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
