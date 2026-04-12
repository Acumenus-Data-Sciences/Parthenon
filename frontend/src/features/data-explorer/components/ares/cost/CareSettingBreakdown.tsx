import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CareSettingItem {
  setting: string;
  visit_concept_id: number;
  total_cost: number;
  record_count: number;
  avg_cost: number;
}

interface CareSettingBreakdownProps {
  settings: CareSettingItem[];
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

const CARE_COLORS: Record<string, string> = {
  "Inpatient Visit": "var(--primary)",
  "Outpatient Visit": "var(--success)",
  "Emergency Room Visit": "var(--accent)",
  "Emergency Room and Inpatient Visit": "#e85d75",
  "Pharmacy visit": "#7c8aed",
};

export default function CareSettingBreakdown({ settings }: CareSettingBreakdownProps) {
  if (settings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-10 text-center text-sm text-text-ghost">
        No care setting cost data available. Requires Visit-domain cost records joined with
        visit_occurrence.
      </div>
    );
  }

  const chartData = settings.map((s) => ({
    name: s.setting.replace(/ Visit$/, ""),
    total_cost: s.total_cost,
    avg_cost: s.avg_cost,
    record_count: s.record_count,
    fill: CARE_COLORS[s.setting] ?? "#666",
  }));

  return (
    <div>
      <div className="mb-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 40, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
            <XAxis
              dataKey="name"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              angle={-20}
              textAnchor="end"
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickFormatter={(v: number) => formatCurrency(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface-overlay)',
                border: "1px solid #333",
                borderRadius: "8px",
              }}
              labelStyle={{ color: 'var(--text-primary)' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: number | string) => [formatCurrency(Number(value)), "Total Cost"]) as any}
            />
            <Bar dataKey="total_cost" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <rect key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {settings.map((s) => (
          <div key={s.visit_concept_id} className="rounded border border-border-subtle bg-surface-base p-3">
            <p className="text-[10px] uppercase tracking-wider text-text-ghost">
              {s.setting.replace(/ Visit$/, "")}
            </p>
            <p className="text-sm font-semibold text-white">{formatCurrency(s.total_cost)}</p>
            <p className="text-[10px] text-text-ghost">
              {s.record_count.toLocaleString()} records | avg {formatCurrency(s.avg_cost)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
