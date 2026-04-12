import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchAqRespiratoryOutcomes } from "./api";
import type { LayerAnalysisProps } from "../types";

export function AirQualityAnalysisPanel({ conceptId, metric }: LayerAnalysisProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "aq", "respiratory", conceptId, metric],
    queryFn: () => fetchAqRespiratoryOutcomes(conceptId, "pm25"),
    staleTime: 60_000,
  });
  if (isLoading) return <p className="text-xs text-text-ghost">Loading...</p>;
  if (!data?.length) return <p className="text-xs text-text-ghost">No data</p>;
  const chartData = data.map((d) => ({ name: `T${d.tertile}`, rate: d.rate }));
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
        <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: 'var(--surface-raised)', border: "1px solid var(--surface-elevated)", borderRadius: 8, fontSize: 11 }} />
        <Bar dataKey="rate" fill="#10B981" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
