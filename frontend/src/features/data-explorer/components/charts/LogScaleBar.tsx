import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from "recharts";
import type { RecordCount } from "../../types/dataExplorer";
import {
  formatCompact,
  formatTableName,
  DOMAIN_COLORS,
  tableToDomain,
  CHART,
  TOOLTIP_CLS,
} from "./chartUtils";

interface LogScaleBarProps {
  data: RecordCount[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: RecordCount }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={TOOLTIP_CLS}>
      <p className="text-xs text-[#C5C0B8]">{formatTableName(d.table)}</p>
      <p className="mt-0.5 font-['IBM_Plex_Mono',monospace] text-xs text-[#F0EDE8]">
        {d.count.toLocaleString()} records
      </p>
    </div>
  );
}

const LOG_REFS = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9];
const LOG_LABELS: Record<number, string> = {
  1e3: "1K",
  1e4: "10K",
  1e5: "100K",
  1e6: "1M",
  1e7: "10M",
  1e8: "100M",
  1e9: "1B",
};

export function LogScaleBar({ data }: LogScaleBarProps) {
  // Filter out zero-count tables and sort descending
  const filtered = data
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);

  if (!filtered.length) return null;

  const maxVal = Math.max(...filtered.map((d) => d.count));
  const height = Math.max(200, filtered.length * 28 + 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={filtered}
        layout="vertical"
        margin={{ top: 4, right: 30, bottom: 4, left: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={CHART.grid}
          horizontal={false}
        />
        <XAxis
          type="number"
          scale="log"
          domain={[100, "auto"]}
          tickFormatter={(v: number) => formatCompact(v)}
          tick={{ fill: CHART.text, fontSize: 10 }}
          axisLine={{ stroke: CHART.grid }}
          tickLine={{ stroke: CHART.grid }}
          allowDataOverflow
        />
        <YAxis
          type="category"
          dataKey="table"
          tickFormatter={formatTableName}
          tick={{ fill: CHART.textSec, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        {/* Power-of-10 reference lines */}
        {LOG_REFS.filter((v) => v <= maxVal * 2).map((v) => (
          <ReferenceLine
            key={v}
            x={v}
            stroke={CHART.grid}
            strokeDasharray="2 4"
            label={{
              value: LOG_LABELS[v],
              position: "top",
              fill: CHART.textDim,
              fontSize: 9,
            }}
          />
        ))}
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
          {filtered.map((entry) => (
            <Cell
              key={entry.table}
              fill={DOMAIN_COLORS[tableToDomain(entry.table)] ?? CHART.accent}
              fillOpacity={0.75}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
