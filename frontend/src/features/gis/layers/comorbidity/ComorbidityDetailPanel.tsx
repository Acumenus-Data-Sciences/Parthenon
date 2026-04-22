import type { LayerDetailProps } from "../types";
import { useTranslation } from "react-i18next";

export function ComorbidityDetailPanel({ fips }: LayerDetailProps) {
  const { t } = useTranslation("app");
  // Detail panel uses hotspot data from parent — simplified for now
  return (
    <div className="text-xs text-text-muted">
      <p>{t("gis.layers.comorbidity.detail.title", { fips })}</p>
      <p className="mt-1 text-[10px] text-text-ghost">
        {t("gis.layers.comorbidity.detail.subtitle")}
      </p>
    </div>
  );
}
