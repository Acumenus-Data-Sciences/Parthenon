import { useQuery } from "@tanstack/react-query";
import { fetchSviTractDetail } from "./api";
import type { LayerDetailProps } from "../types";
import { useTranslation } from "react-i18next";
import { getSviThemeLabel } from "../../lib/i18n";

export function SviDetailPanel({ fips }: LayerDetailProps) {
  const { t } = useTranslation("app");
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "svi", "detail", fips],
    queryFn: () => fetchSviTractDetail(fips),
  });

  if (isLoading) return <p className="text-xs text-text-ghost">{t("gis.layers.svi.detail.loading")}</p>;
  if (!data) return <p className="text-xs text-text-ghost">{t("gis.layers.svi.detail.empty")}</p>;

  const themes = [data.svi_theme1, data.svi_theme2, data.svi_theme3, data.svi_theme4];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">{t("gis.layers.svi.detail.overall")}</span>
        <span className="font-medium text-text-primary">
          {data.svi_overall !== null ? (data.svi_overall * 100).toFixed(0) + "%" : "—"}
        </span>
      </div>
      {themes.map((val, i) => (
        <div key={i} className="space-y-0.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-text-ghost">{getSviThemeLabel(t, i)}</span>
            <span className="text-text-muted">
              {val !== null ? (val * 100).toFixed(0) + "%" : "—"}
            </span>
          </div>
          <div className="h-1 rounded-full bg-surface-elevated">
            <div
              className="h-1 rounded-full bg-critical"
              style={{ width: `${(val ?? 0) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
