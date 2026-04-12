import { useMemo } from "react";
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import type { ImagingMeasurement } from "../types";

// ── Constants ────────────────────────────────────────────────────────────

const MEASUREMENT_TYPE_LABELS: Record<string, string> = {
  tumor_volume: "Tumor Volume",
  suvmax: "SUVmax",
  opacity_score: "Opacity Score",
  lesion_count: "Lesion Count",
  longest_diameter: "Longest Diameter",
  perpendicular_diameter: "Perpendicular Diameter",
  density_hu: "Density (HU)",
  ground_glass_extent: "Ground Glass Extent",
  consolidation_extent: "Consolidation Extent",
  ct_severity_score: "CT Severity Score",
  metabolic_tumor_volume: "Metabolic Tumor Volume",
  total_lesion_glycolysis: "Total Lesion Glycolysis",
};

const TREND_COLORS = [
  "var(--success)", "var(--info)", "var(--domain-observation)", "var(--warning)", "var(--critical)",
  "var(--domain-procedure)", "var(--success)", "var(--domain-device)", "var(--info)", "#C084FC",
];

// ── Types ────────────────────────────────────────────────────────────────

interface TrendDataPoint {
  date: string;
  dateLabel: string;
  [key: string]: string | number | null;
}

interface MeasurementTrendChartProps {
  measurements: ImagingMeasurement[];
  measurementType: string;
  title?: string;
  height?: number;
  showBaseline?: boolean;
  showPercentChange?: boolean;
}

interface MultiTrendChartProps {
  measurements: ImagingMeasurement[];
  height?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

// ── Custom Tooltip ───────────────────────────────────────────────────────

function TrendTooltip({
  active,
  payload,
  label,
  unit,
  baselineValue,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string; dataKey: string }>;
  label?: string;
  unit: string;
  baselineValue?: number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-surface-highlight bg-surface-overlay px-3 py-2 shadow-lg min-w-[160px]">
      <p className="text-xs text-text-muted mb-1">{label ? formatDate(label) : ""}</p>
      {payload.map((p, idx) => {
        const pctChange = baselineValue && baselineValue !== 0
          ? ((p.value - baselineValue) / baselineValue) * 100
          : null;
        return (
          <div key={idx} className="flex items-center justify-between gap-3 mt-0.5">
            <span className="text-xs" style={{ color: p.color }}>
              {p.name}
            </span>
            <span className="font-mono text-xs text-text-primary">
              {p.value.toFixed(1)} {unit}
              {pctChange !== null && (
                <span className={`ml-1.5 text-[10px] ${pctChange > 0 ? "text-critical" : pctChange < 0 ? "text-success" : "text-accent"}`}>
                  ({pctChange > 0 ? "+" : ""}{pctChange.toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Single Measurement Trend Chart ───────────────────────────────────────

export function MeasurementTrendChart({
  measurements,
  measurementType,
  title,
  height = 220,
  showBaseline = true,
  showPercentChange = true,
}: MeasurementTrendChartProps) {
  const { data, unit, baselineValue, lastValue, percentChange, seriesNames, label } = useMemo(() => {
    const filtered = measurements
      .filter(m => m.measurement_type === measurementType && m.measured_at)
      .sort((a, b) => new Date(a.measured_at!).getTime() - new Date(b.measured_at!).getTime());

    if (filtered.length === 0) {
      return { data: [], unit: "", baselineValue: 0, lastValue: 0, percentChange: null, seriesNames: [], label: measurementType };
    }

    const measUnit = filtered[0].unit;
    const measLabel = MEASUREMENT_TYPE_LABELS[measurementType] ?? measurementType;

    // Group by measurement_name to support multiple series (e.g., multiple target lesions)
    const seriesMap = new Map<string, Map<string, number>>();
    const allDates = new Set<string>();

    filtered.forEach(m => {
      const seriesKey = m.measurement_name;
      if (!seriesMap.has(seriesKey)) seriesMap.set(seriesKey, new Map());
      const dateKey = m.measured_at!;
      seriesMap.get(seriesKey)!.set(dateKey, m.value_as_number);
      allDates.add(dateKey);
    });

    const sortedDates = Array.from(allDates).sort();
    const names = Array.from(seriesMap.keys());

    const chartData: TrendDataPoint[] = sortedDates.map(date => {
      const point: TrendDataPoint = { date, dateLabel: formatDate(date) };
      names.forEach(name => {
        point[name] = seriesMap.get(name)?.get(date) ?? null;
      });
      return point;
    });

    // Compute baseline (first non-null value of first series)
    const firstSeries = names[0];
    const firstPoint = chartData.find(d => d[firstSeries] !== null);
    const lastPoint = [...chartData].reverse().find(d => d[firstSeries] !== null);
    const baseline = firstPoint ? (firstPoint[firstSeries] as number) : 0;
    const last = lastPoint ? (lastPoint[firstSeries] as number) : 0;
    const pct = baseline !== 0 ? ((last - baseline) / baseline) * 100 : null;

    return {
      data: chartData,
      unit: measUnit,
      baselineValue: baseline,
      lastValue: last,
      percentChange: pct,
      seriesNames: names,
      label: measLabel,
    };
  }, [measurements, measurementType]);

  if (data.length === 0) return null;

  const chartTitle = title ?? label;

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
          {chartTitle}
        </h4>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-text-secondary">
            {lastValue.toFixed(1)} {unit}
          </span>
          {showPercentChange && percentChange !== null && (
            <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${
              percentChange > 5 ? "bg-critical/15 text-critical" :
              percentChange < -5 ? "bg-success/15 text-success" :
              "bg-accent/15 text-accent"
            }`}>
              {percentChange > 0 ? "+" : ""}{percentChange.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-elevated)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={{ stroke: "var(--surface-elevated)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={55}
            tickFormatter={v => `${v} ${unit}`}
          />
          <Tooltip content={<TrendTooltip unit={unit} baselineValue={showPercentChange ? baselineValue : undefined} />} />

          {/* Baseline reference */}
          {showBaseline && baselineValue > 0 && (
            <ReferenceLine
              y={baselineValue}
              stroke="var(--text-ghost)"
              strokeDasharray="6 4"
              label={{
                value: `Baseline: ${baselineValue.toFixed(1)}`,
                position: "right",
                fill: "var(--text-ghost)",
                fontSize: 9,
              }}
            />
          )}

          {/* Area fill for single series */}
          {seriesNames.length === 1 && (
            <Area
              type="monotone"
              dataKey={seriesNames[0]}
              fill={`${TREND_COLORS[0]}15`}
              stroke="none"
            />
          )}

          {/* Lines per measurement name */}
          {seriesNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              name={name}
              stroke={TREND_COLORS[i % TREND_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4, fill: TREND_COLORS[i % TREND_COLORS.length], stroke: "var(--surface-raised)", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: TREND_COLORS[i % TREND_COLORS.length], stroke: "var(--surface-raised)", strokeWidth: 2 }}
              connectNulls
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Series legend for multiple lesions */}
      {seriesNames.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-border-default">
          {seriesNames.map((name, i) => (
            <div key={name} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TREND_COLORS[i % TREND_COLORS.length] }} />
              <span className="text-[10px] text-text-muted">{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Multi-Trend Overview (all measurement types) ─────────────────────────

export function MultiTrendChart({ measurements, height = 200 }: MultiTrendChartProps) {
  const measurementTypes = useMemo(() => {
    const types = new Set<string>();
    measurements.forEach(m => types.add(m.measurement_type));
    return Array.from(types);
  }, [measurements]);

  if (measurementTypes.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-raised p-6 text-center text-sm text-text-ghost">
        No measurements recorded. Use AI Auto-Extract or enter measurements manually on individual studies.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-text-primary">Measurement Trends</h3>
        <span className="text-[10px] text-text-ghost uppercase tracking-wider">
          {measurementTypes.length} type{measurementTypes.length !== 1 ? "s" : ""} · {measurements.length} data points
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {measurementTypes.map(type => (
          <MeasurementTrendChart
            key={type}
            measurements={measurements}
            measurementType={type}
            height={height}
          />
        ))}
      </div>
    </div>
  );
}
