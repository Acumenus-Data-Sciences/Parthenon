import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { PreferenceDistribution } from "../types/patientSimilarity";

const TEAL = "var(--success)";
const CRIMSON = "var(--primary)";

interface PreferenceScoreDistributionProps {
  distribution: PreferenceDistribution;
}

interface ChartDatum {
  bin: number;
  target: number;
  comparator: number;
}

export function PreferenceScoreDistribution({
  distribution,
}: PreferenceScoreDistributionProps) {
  const chartData: ChartDatum[] = distribution.bins.map((bin, i) => ({
    bin: Math.round(bin * 100) / 100,
    target: distribution.target_density[i] ?? 0,
    comparator: -(distribution.comparator_density[i] ?? 0),
  }));

  const maxVal = Math.max(
    ...distribution.target_density,
    ...distribution.comparator_density,
  );
  const yDomain = [-(maxVal * 1.1), maxVal * 1.1];

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-1">
        Preference Score Distribution
      </h3>
      <p className="text-xs text-text-ghost mb-3">
        Overlapping distributions indicate good equipoise between cohorts
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-elevated)" />
          <XAxis
            dataKey="bin"
            tick={{ fill: "var(--text-ghost)", fontSize: 10 }}
            label={{ value: "Preference Score", position: "bottom", fill: "var(--text-ghost)", fontSize: 11, offset: 5 }}
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: "var(--text-ghost)", fontSize: 10 }}
            tickFormatter={(v: number) => Math.abs(v).toFixed(2)}
          />
          <ReferenceLine y={0} stroke="var(--surface-highlight)" />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface-overlay)",
              border: "1px solid #323238",
              borderRadius: 6,
              fontSize: 11,
            }}
            labelStyle={{ color: "var(--text-secondary)" }}
            formatter={((value: number, name: string) => [
              Math.abs(value).toFixed(4),
              name === "target" ? "Target" : "Comparator",
            ]) as never}
            labelFormatter={((label: number) => `Preference: ${label.toFixed(2)}`) as never}
          />
          <Area
            type="monotone"
            dataKey="target"
            fill={TEAL}
            fillOpacity={0.3}
            stroke={TEAL}
            strokeWidth={1.5}
            name="target"
          />
          <Area
            type="monotone"
            dataKey="comparator"
            fill={CRIMSON}
            fillOpacity={0.3}
            stroke={CRIMSON}
            strokeWidth={1.5}
            name="comparator"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TEAL }} />
          <span className="text-text-secondary">Target (above)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CRIMSON }} />
          <span className="text-text-secondary">Comparator (below)</span>
        </div>
      </div>
    </div>
  );
}
