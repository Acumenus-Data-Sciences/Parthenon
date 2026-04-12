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

const TEAL = "var(--color-primary)";
const CRIMSON = "var(--color-critical)";

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
    <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
        Preference Score Distribution
      </h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        Overlapping distributions indicate good equipoise between cohorts
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-overlay)" />
          <XAxis
            dataKey="bin"
            tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
            label={{ value: "Preference Score", position: "bottom", fill: "var(--color-text-muted)", fontSize: 11, offset: 5 }}
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
            tickFormatter={(v: number) => Math.abs(v).toFixed(2)}
          />
          <ReferenceLine y={0} stroke="var(--color-border-default)" />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 6,
              fontSize: 11,
            }}
            labelStyle={{ color: "var(--color-text-primary)" }}
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
          <span className="text-[var(--color-text-primary)]">Target (above)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CRIMSON }} />
          <span className="text-[var(--color-text-primary)]">Comparator (below)</span>
        </div>
      </div>
    </div>
  );
}
