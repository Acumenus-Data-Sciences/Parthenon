import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fetchAccessAnalysis } from "./api";
import type { LayerAnalysisProps } from "../types";

export function HospitalAnalysisPanel({ conceptId, metric }: LayerAnalysisProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "hospitals", "access", conceptId, metric],
    queryFn: () => fetchAccessAnalysis(conceptId, metric),
    staleTime: 60_000,
  });
  if (isLoading) return <p className="text-xs text-[#5A5650]">Loading...</p>;
  if (!data?.length) return <p className="text-xs text-[#5A5650]">No data</p>;
  const chartData = data.map((d) => ({ name: d.distance_bin, rate: d.rate }));
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#232328" />
        <XAxis dataKey="name" tick={{ fill: "#8A857D", fontSize: 9 }} />
        <YAxis tick={{ fill: "#8A857D", fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: "#141418", border: "1px solid #232328", borderRadius: 8, fontSize: 11 }} />
        <Bar dataKey="rate" fill="#3B82F6" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
