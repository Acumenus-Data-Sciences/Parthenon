import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
import { fetchAqRespiratoryOutcomes } from "./api";
import type { LayerAnalysisProps } from "../types";

export function AirQualityAnalysisPanel({ conceptId, metric }: LayerAnalysisProps) {
  const { t } = useTranslation("app");
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "aq", "respiratory", conceptId, metric],
    queryFn: () => fetchAqRespiratoryOutcomes(conceptId, "pm25"),
    staleTime: 60_000,
  });
  if (isLoading) return <p className="text-xs text-text-ghost">{t("gis.layers.airQuality.analysis.loading")}</p>;
  if (!data?.length) return <p className="text-xs text-text-ghost">{t("gis.layers.airQuality.analysis.noData")}</p>;
  const chartData = data.map((d) => ({ name: `T${d.tertile}`, rate: d.rate }));
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-elevated)" />
        <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: "var(--surface-raised)", border: "1px solid #232328", borderRadius: 8, fontSize: 11 }} />
        <Bar dataKey="rate" fill="var(--success)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
