import { useQuery } from "@tanstack/react-query";
import { fetchAqCountyDetail } from "./api";
import type { LayerDetailProps } from "../types";
import { useTranslation } from "react-i18next";

export function AirQualityDetailPanel({ fips }: LayerDetailProps) {
  const { t } = useTranslation("app");
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "aq", "detail", fips],
    queryFn: () => fetchAqCountyDetail(fips),
  });
  if (isLoading) return <p className="text-xs text-text-ghost">{t("gis.layers.airQuality.detail.loading")}</p>;
  if (!data) return <p className="text-xs text-text-ghost">{t("gis.layers.airQuality.detail.empty")}</p>;
  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex justify-between">
        <span className="text-text-muted">PM2.5</span>
        <span className="font-medium text-text-primary">{data.pm25_value?.toFixed(1) ?? "—"} µg/m³{/* i18n-exempt: measurement unit */}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-text-muted">{t("gis.layers.airQuality.detail.ozone")}</span>
        <span className="font-medium text-text-primary">{data.ozone_value?.toFixed(1) ?? "—"} ppb</span>
      </div>
    </div>
  );
}
