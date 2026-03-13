import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchRuccOutcomeComparison } from "./api";
import type { LayerAnalysisProps } from "../types";

const CATEGORY_COLORS: Record<string, string> = {
  metro: "#3B82F6",
  micro: "#8B5CF6",
  rural: "#F59E0B",
};

export function RuccAnalysisPanel({ conceptId, metric }: LayerAnalysisProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "rucc", "outcomes", conceptId, metric],
    queryFn: () => fetchRuccOutcomeComparison(conceptId, metric),
    staleTime: 60_000,
  });

  if (isLoading) return <p className="text-xs text-[#5A5650]">Loading...</p>;
  if (!data?.length) return <p className="text-xs text-[#5A5650]">No data</p>;

  const chartData = data.map((d) => ({
    name: d.category.charAt(0).toUpperCase() + d.category.slice(1),
    rate: d.rate,
    fill: CATEGORY_COLORS[d.category] ?? "#8A857D",
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#232328" />
        <XAxis dataKey="name" tick={{ fill: "#8A857D", fontSize: 10 }} />
        <YAxis tick={{ fill: "#8A857D", fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: "#141418", border: "1px solid #232328", borderRadius: 8, fontSize: 11 }} />
        <Bar dataKey="rate" radius={[2, 2, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
