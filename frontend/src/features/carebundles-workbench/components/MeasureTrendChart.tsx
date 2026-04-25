import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { useMeasureTrend } from "../hooks";
import { formatRateWithCI } from "../lib/formatting";

interface Props {
  bundleId: number | null;
  measureId: number | null;
  sourceId: number | null;
}

interface ChartPoint {
  index: number;
  label: string;
  rate: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
  denominator_count: number;
  numerator_count: number;
}

export function MeasureTrendChart({ bundleId, measureId, sourceId }: Props) {
  const { data, isLoading, error } = useMeasureTrend(
    bundleId,
    measureId,
    sourceId,
  );

  if (bundleId == null || measureId == null || sourceId == null) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-text-ghost">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading trend…
      </div>
    );
  }

  if (error || !data || data.points.length < 1) {
    return (
      <p className="p-4 text-xs text-text-ghost">
        No historical runs yet — trend appears once two or more runs complete.
      </p>
    );
  }

  const points: ChartPoint[] = data.points.map((p, i) => ({
    index: i,
    label: p.completed_at?.slice(0, 16).replace("T", " ") ?? `run ${p.run_id}`,
    rate: p.rate != null ? p.rate * 100 : null,
    ci_lower: p.ci_lower != null ? p.ci_lower * 100 : null,
    ci_upper: p.ci_upper != null ? p.ci_upper * 100 : null,
    denominator_count: p.denominator_count,
    numerator_count: p.numerator_count,
  }));

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-text-ghost">
        Rate over time ({points.length} run{points.length === 1 ? "" : "s"})
      </div>
      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--border-default)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--text-ghost)" }}
              stroke="var(--border-default)"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "var(--text-ghost)" }}
              stroke="var(--border-default)"
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border-default)",
                fontSize: "11px",
              }}
              formatter={
                ((_value: number, _name: string, item: { payload: ChartPoint }) => {
                  const p = item.payload;
                  return [
                    formatRateWithCI(
                      p.rate != null ? p.rate / 100 : null,
                      p.ci_lower != null ? p.ci_lower / 100 : null,
                      p.ci_upper != null ? p.ci_upper / 100 : null,
                    ) + ` · N=${p.denominator_count.toLocaleString()}`,
                    "Rate",
                  ];
                }) as never
              }
            />
            {points.map((p, i) =>
              p.ci_lower != null && p.ci_upper != null ? (
                <ReferenceArea
                  key={i}
                  x1={p.label}
                  x2={p.label}
                  y1={p.ci_lower}
                  y2={p.ci_upper}
                  fill="var(--accent)"
                  fillOpacity={0.18}
                  stroke="none"
                />
              ) : null,
            )}
            <Line
              type="monotone"
              dataKey="rate"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--accent)" }}
              isAnimationActive={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
