import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatCompact, CHART, TOOLTIP_CLS } from "./chartUtils";

interface YearOfBirthHistogramProps {
  data: { year: string; count: number }[];
}

/** 3-point moving average for a smoothed density curve */
function smooth(values: number[], window = 3): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    let sum = 0;
    let cnt = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < values.length) {
        sum += values[j];
        cnt++;
      }
    }
    return sum / cnt;
  });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const bar = payload.find((p) => p.dataKey === "count");
  return (
    <div className={TOOLTIP_CLS}>
      <p className="text-xs text-text-muted">Year: {label}</p>
      {bar && (
        <p className="mt-0.5 font-['IBM_Plex_Mono',monospace] text-xs text-text-primary">
          {bar.value.toLocaleString()} persons
        </p>
      )}
    </div>
  );
}

export function YearOfBirthHistogram({ data }: YearOfBirthHistogramProps) {
  if (!data.length) return null;

  const smoothed = smooth(data.map((d) => d.count));
  const merged = data.map((d, i) => ({ ...d, smoothed: smoothed[i] }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart
        data={merged}
        margin={{ top: 8, right: 20, bottom: 0, left: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={CHART.grid}
          vertical={false}
        />
        <XAxis
          dataKey="year"
          tick={{ fill: CHART.text, fontSize: 10 }}
          axisLine={{ stroke: CHART.grid }}
          tickLine={{ stroke: CHART.grid }}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={formatCompact}
          tick={{ fill: CHART.text, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={55}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="count"
          fill={CHART.accent}
          fillOpacity={0.4}
          stroke={CHART.accent}
          strokeWidth={0.5}
          radius={[2, 2, 0, 0]}
        />
        <Area
          dataKey="smoothed"
          type="monotone"
          stroke={CHART.gold}
          strokeWidth={2}
          fill="none"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
