import { useQuery } from "@tanstack/react-query";
import { fetchRuccCountyDetail } from "./api";
import type { LayerDetailProps } from "../types";
import { useTranslation } from "react-i18next";
import { getRuccCategoryLabel } from "../../lib/i18n";

export function RuccDetailPanel({ fips }: LayerDetailProps) {
  const { t } = useTranslation("app");
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "rucc", "detail", fips],
    queryFn: () => fetchRuccCountyDetail(fips),
  });

  if (isLoading) return <p className="text-xs text-text-ghost">{t("gis.layers.rucc.detail.loading")}</p>;
  if (!data) return <p className="text-xs text-text-ghost">{t("gis.layers.rucc.detail.empty")}</p>;

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex justify-between">
        <span className="text-text-muted">{t("gis.layers.rucc.detail.code")}</span>
        <span className="font-medium text-text-primary">{data.rucc_code}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-text-muted">{t("gis.layers.rucc.detail.classification")}</span>
        <span className="font-medium text-text-primary">{data.rucc_label}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-text-muted">{t("gis.layers.rucc.detail.category")}</span>
        <span className="font-medium capitalize text-text-primary">
          {getRuccCategoryLabel(t, data.category)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-text-muted">{t("gis.layers.rucc.detail.patients")}</span>
        <span className="font-medium text-text-primary">{data.patient_count?.toLocaleString()}</span>
      </div>
    </div>
  );
}
