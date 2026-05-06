import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchCdmChoropleth } from "../../api";
import type { CdmMetricType } from "../../types";
import type { LayerAnalysisProps } from "../types";

function normalizeMetric(metric: string): CdmMetricType {
  if (metric === "deaths" || metric === "hospitalization" || metric === "patient_count") {
    return metric;
  }

  return "cases";
}

export function DiseaseBurdenAnalysisPanel({ conceptId, metric }: LayerAnalysisProps) {
  const { t } = useTranslation("app");
  const cdmMetric = normalizeMetric(metric);
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "disease-burden", "analysis", conceptId, cdmMetric],
    queryFn: () => fetchCdmChoropleth({ concept_id: conceptId, metric: cdmMetric }),
    staleTime: 60_000,
  });

  const topRegions = useMemo(() => (data ?? []).slice(0, 5), [data]);

  if (isLoading) {
    return <p className="text-xs text-text-ghost">{t("gis.layers.comorbidity.analysis.loading")}</p>;
  }

  if (topRegions.length === 0) {
    return <p className="text-xs text-text-ghost">{t("gis.layers.comorbidity.analysis.noData")}</p>;
  }

  return (
    <div className="space-y-1.5">
      {topRegions.map((item) => (
        <div key={item.gid} className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate text-text-muted">{item.name}</span>
          <span className="font-medium text-text-primary">{item.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
