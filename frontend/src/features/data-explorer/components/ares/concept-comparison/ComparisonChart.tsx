import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ErrorBar,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import type { ConceptComparison, MultiConceptComparison } from "../../../types/ares";

const CONCEPT_COLORS = ["var(--success)", "var(--accent)", "#e85d75", "#7c8aed", "#59c990"];

interface SingleComparisonChartProps {
  data: ConceptComparison[];
  metric: "count" | "rate_per_1000";
  multiData?: never;
  benchmarkRate?: number | null;
}

interface MultiComparisonChartProps {
  data?: never;
  metric: "count" | "rate_per_1000";
  multiData: MultiConceptComparison;
  benchmarkRate?: never;
}

type ComparisonChartProps = SingleComparisonChartProps | MultiComparisonChartProps;

export default function ComparisonChart(props: ComparisonChartProps) {
  const { metric, multiData } = props;

  // Multi-concept grouped bars
  if (multiData) {
    return <GroupedBars multiData={multiData} metric={metric} />;
  }

  const { data, benchmarkRate } = props as SingleComparisonChartProps;

  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-text-ghost">
        No comparison data available.
      </div>
    );
  }

  const chartData = data.map((d) => {
    const value = metric === "count" ? d.count : d.rate_per_1000;
    // Error bar uses [errorLow, errorHigh] tuple relative to the value
    const error: [number, number] =
      metric === "rate_per_1000" && d.ci_lower !== undefined && d.ci_upper !== undefined
        ? [value - d.ci_lower, d.ci_upper - value]
        : [0, 0];
    return { source: d.source_name, value, error };
  });

  const showBenchmark = metric === "rate_per_1000" && benchmarkRate != null && benchmarkRate > 0;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
          <XAxis
            dataKey="source"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-default)' }}
            angle={-30}
            textAnchor="end"
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-default)' }}
            tickFormatter={(v: number) =>
              metric === "rate_per_1000" ? `${v}/1k` : v.toLocaleString()
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface-overlay)',
              border: "1px solid #333",
              borderRadius: "8px",
              color: 'var(--text-secondary)',
              fontSize: 12,
            }}
            /* eslint-disable @typescript-eslint/no-explicit-any */
            formatter={((value: number | string) => [
              metric === "rate_per_1000"
                ? `${Number(value).toFixed(2)} per 1,000`
                : Number(value).toLocaleString(),
              metric === "rate_per_1000" ? "Rate" : "Count",
            ]) as any}
            /* eslint-enable @typescript-eslint/no-explicit-any */
          />
          {showBenchmark && (
            <ReferenceLine
              y={benchmarkRate}
              stroke="#e85d75"
              strokeDasharray="8 4"
              strokeWidth={1.5}
              label={{
                value: `CDC National Rate: ${benchmarkRate} per 1,000`,
                position: "top",
                fill: "var(--critical)",
                fontSize: 10,
              }}
            />
          )}
          <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]}>
            {metric === "rate_per_1000" && (
              <ErrorBar dataKey="error" width={4} stroke="#888" strokeWidth={1} />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GroupedBars({
  multiData,
  metric,
}: {
  multiData: MultiConceptComparison;
  metric: "count" | "rate_per_1000";
}) {
  if (multiData.sources.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-text-ghost">
        No comparison data available.
      </div>
    );
  }

  // Build chart data: one row per source, one bar per concept
  const chartData = multiData.sources.map((source) => {
    const row: Record<string, unknown> = { source: source.source_name };
    for (const concept of multiData.concepts) {
      const rate = source.rates[concept.concept_id];
      row[`concept_${concept.concept_id}`] = rate
        ? metric === "count"
          ? rate.count
          : rate.rate_per_1000
        : 0;
    }
    return row;
  });

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
          <XAxis
            dataKey="source"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-default)' }}
            angle={-30}
            textAnchor="end"
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-default)' }}
            tickFormatter={(v: number) =>
              metric === "rate_per_1000" ? `${v}/1k` : v.toLocaleString()
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface-overlay)',
              border: "1px solid #333",
              borderRadius: "8px",
              color: 'var(--text-secondary)',
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }}
          />
          {multiData.concepts.map((concept, i) => (
            <Bar
              key={concept.concept_id}
              dataKey={`concept_${concept.concept_id}`}
              name={concept.concept_name}
              fill={CONCEPT_COLORS[i % CONCEPT_COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
