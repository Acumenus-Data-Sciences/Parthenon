import { useTranslation } from "react-i18next";
import { useCountyDetail } from "../../hooks/useGis";
import type { LayerDetailProps } from "../types";

export function DiseaseBurdenDetailPanel({ fips, conceptId }: LayerDetailProps) {
  const { t } = useTranslation("app");
  const { data, isLoading } = useCountyDetail(fips, conceptId);

  if (isLoading) {
    return <p className="text-xs text-text-ghost">{t("gis.layers.comorbidity.analysis.loading")}</p>;
  }

  if (!data) {
    return <p className="text-xs text-text-ghost">{t("gis.layers.comorbidity.analysis.noData")}</p>;
  }

  const cases = data.metrics.cases;
  const deaths = data.metrics.deaths;
  const cfr = data.metrics.cfr;
  const hospitalizations = data.metrics.hospitalization;

  return (
    <div className="space-y-1.5 text-xs">
      <Metric label={t("gis.countyDetail.cases")} value={cases?.value} />
      <Metric label={t("gis.countyDetail.hospitalized")} value={hospitalizations?.value} />
      <Metric label={t("gis.countyDetail.deaths")} value={deaths?.value} />
      <Metric label={t("gis.countyDetail.cfr")} value={cfr?.rate ?? cfr?.value} suffix="%" />
    </div>
  );
}

function Metric({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number | null | undefined;
  suffix?: string;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-primary">
        {value === null || value === undefined ? "-" : `${value.toLocaleString()}${suffix}`}
      </span>
    </div>
  );
}
