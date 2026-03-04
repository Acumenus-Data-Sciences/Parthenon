import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatCompact, CHART, TOOLTIP_CLS } from "./chartUtils";

interface PeriodCountBarProps {
  data: { count_value: string; persons: number }[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; persons: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={TOOLTIP_CLS}>
      <p className="text-xs text-[#8A857D]">{d.label} observation period(s)</p>
      <p className="mt-0.5 font-['IBM_Plex_Mono',monospace] text-xs text-[#F0EDE8]">
        {d.persons.toLocaleString()} persons
      </p>
    </div>
  );
}

export function PeriodCountBar({ data }: PeriodCountBarProps) {
  if (!data.length) return null;

  // Aggregate: show individual counts up to 5, then "6+" bucket
  const sorted = [...data].sort(
    (a, b) => Number(a.count_value) - Number(b.count_value),
  );

  const display: { label: string; persons: number }[] = [];
  let overflow = 0;
  for (const row of sorted) {
    const n = Number(row.count_value);
    if (n <= 5) {
      display.push({ label: String(n), persons: row.persons });
    } else {
      overflow += row.persons;
    }
  }
  if (overflow > 0) {
    display.push({ label: "6+", persons: overflow });
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={display}
        layout="vertical"
        margin={{ top: 4, right: 20, bottom: 0, left: 10 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={CHART.grid}
          horizontal={false}
        />
        <XAxis
          type="number"
          tickFormatter={formatCompact}
          tick={{ fill: CHART.text, fontSize: 10 }}
          axisLine={{ stroke: CHART.grid }}
          tickLine={{ stroke: CHART.grid }}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: CHART.text, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="persons"
          fill={CHART.accent}
          fillOpacity={0.7}
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
