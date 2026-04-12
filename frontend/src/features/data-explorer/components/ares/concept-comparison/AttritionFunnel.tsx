import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface FunnelStep {
  concept_name: string;
  remaining_patients: number;
  percentage: number;
}

interface AttritionFunnelProps {
  data: Array<{
    source_id: number;
    source_name: string;
    steps: FunnelStep[];
  }>;
}

const FUNNEL_COLORS = ["var(--success)", "var(--accent)", "var(--critical)", "#7c8aed", "#59c990"];

export default function AttritionFunnel({ data }: AttritionFunnelProps) {
  if (data.length === 0) return null;

  return (
    <div className="space-y-4">
      {data.map((source) => (
        <div key={source.source_id} className="rounded-lg border border-border-subtle bg-surface-raised p-4">
          <h4 className="mb-3 text-sm font-medium text-text-primary">{source.source_name}</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={source.steps}
                layout="vertical"
                margin={{ top: 5, right: 40, bottom: 5, left: 120 }}
              >
                <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="concept_name"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface-overlay)",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    color: "var(--text-secondary)",
                    fontSize: 12,
                  }}
                  formatter={((value: number) => [
                    `${value.toLocaleString()} patients`,
                    "Remaining",
                  ]) as never}
                />
                <Bar dataKey="remaining_patients" radius={[0, 4, 4, 0]}>
                  {source.steps.map((_entry, index) => (
                    <Cell key={index} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
