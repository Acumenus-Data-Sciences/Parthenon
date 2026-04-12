import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface AgePyramidData {
  group: string;
  male: number;
  female: number;
}

interface AgePyramidProps {
  data: AgePyramidData[];
  sourceName: string;
}

export default function AgePyramid({ data, sourceName }: AgePyramidProps) {
  if (data.length === 0) return null;

  // Male values should be negative for left side
  const chartData = data.map((d) => ({
    group: d.group,
    male: -Math.abs(d.male),
    female: Math.abs(d.female),
  }));

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
      <h4 className="mb-3 text-sm font-medium text-text-primary">{sourceName} -- Age Distribution</h4>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, bottom: 5, left: 60 }}
          >
            <XAxis
              type="number"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickFormatter={(v: number) => Math.abs(v).toLocaleString()}
            />
            <YAxis
              type="category"
              dataKey="group"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface-overlay)",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "var(--text-secondary)",
                fontSize: 12,
              }}
              formatter={((value: number) => [Math.abs(value).toLocaleString(), ""]) as never}
            />
            <ReferenceLine x={0} stroke="var(--surface-highlight)" />
            <Bar dataKey="male" fill="#7c8aed" name="Male" />
            <Bar dataKey="female" fill="var(--critical)" name="Female" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-info" /> Male
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-critical" /> Female
        </span>
      </div>
    </div>
  );
}
