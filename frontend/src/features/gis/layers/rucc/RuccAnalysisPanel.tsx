import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchRuccOutcomeComparison } from "./api";
import type { LayerAnalysisProps } from "../types";

const CATEGORY_COLORS: Record<string, string> = {
  metro: "var(--info)",
  micro: "var(--domain-observation)",
  rural: "var(--warning)",
};

export function RuccAnalysisPanel({ conceptId, metric }: LayerAnalysisProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "rucc", "outcomes", conceptId, metric],
    queryFn: () => fetchRuccOutcomeComparison(conceptId, metric),
    staleTime: 60_000,
  });

  if (isLoading) return <p className="text-xs text-text-ghost">Loading...</p>;
  if (!data?.length) return <p className="text-xs text-text-ghost">No data</p>;

  const chartData = data.map((d) => ({
    name: d.category.charAt(0).toUpperCase() + d.category.slice(1),
    rate: d.rate,
    fill: CATEGORY_COLORS[d.category] ?? "var(--text-muted)",
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-elevated)" />
        <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: "var(--surface-raised)", border: "1px solid #232328", borderRadius: 8, fontSize: 11 }} />
        <Bar dataKey="rate" radius={[2, 2, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
