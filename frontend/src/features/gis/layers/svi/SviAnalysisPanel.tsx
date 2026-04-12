import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchSviQuartileAnalysis } from "./api";
import type { LayerAnalysisProps } from "../types";

export function SviAnalysisPanel({ conceptId, metric }: LayerAnalysisProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "svi", "quartiles", conceptId, metric],
    queryFn: () => fetchSviQuartileAnalysis(conceptId, metric),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <p className="text-xs text-text-ghost">Loading...</p>;
  }

  if (!data?.length) {
    return <p className="text-xs text-text-ghost">No data available</p>;
  }

  const chartData = data.map((d) => ({
    name: `Q${d.quartile}`,
    rate: d.rate,
    patients: d.total_patients,
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
        <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--surface-raised)',
            border: "1px solid var(--surface-elevated)",
            borderRadius: 8,
            fontSize: 11,
          }}
        />
        <Bar dataKey="rate" fill="var(--critical)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
