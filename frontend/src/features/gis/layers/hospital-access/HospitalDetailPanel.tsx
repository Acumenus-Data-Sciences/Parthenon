import type { LayerDetailProps } from "../types";
import { useTranslation } from "react-i18next";

export function HospitalDetailPanel({ fips }: LayerDetailProps) {
  const { t } = useTranslation("app");
  return (
    <div className="text-xs text-text-muted">
      <p>{t("gis.layers.hospitalAccess.detail.title", { fips })}</p>
      <p className="mt-1 text-[10px] text-text-ghost">
        {t("gis.layers.hospitalAccess.detail.subtitle")}
      </p>
    </div>
  );
}
