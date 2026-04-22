import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
import { fetchAccessAnalysis } from "./api";
import type { LayerAnalysisProps } from "../types";

export function HospitalAnalysisPanel({ conceptId, metric }: LayerAnalysisProps) {
  const { t } = useTranslation("app");
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "hospitals", "access", conceptId, metric],
    queryFn: () => fetchAccessAnalysis(conceptId, metric),
    staleTime: 60_000,
  });
  if (isLoading) return <p className="text-xs text-text-ghost">{t("gis.layers.hospitalAccess.analysis.loading")}</p>;
  if (!data?.length) return <p className="text-xs text-text-ghost">{t("gis.layers.hospitalAccess.analysis.noData")}</p>;
  const chartData = data.map((d) => ({ name: d.distance_bin, rate: d.rate }));
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-elevated)" />
        <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 9 }} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: "var(--surface-raised)", border: "1px solid #232328", borderRadius: 8, fontSize: 11 }} />
        <Bar dataKey="rate" fill="var(--info)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
