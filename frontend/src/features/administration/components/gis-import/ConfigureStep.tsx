import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSaveConfig } from "../../hooks/useGisImport";
import type { ImportConfig, ColumnSuggestion } from "../../types/gisImport";

interface Props {
  importId: number;
  suggestions: ColumnSuggestion[];
  onComplete: (config: ImportConfig) => void;
}

export function ConfigureStep({ importId, suggestions, onComplete }: Props) {
  const { t } = useTranslation("app");
  const valueSuggestion = suggestions.find((s) => s.purpose === "value");
  const geoSuggestion = suggestions.find((s) => s.purpose === "geography_code");

  const [config, setConfig] = useState<ImportConfig>({
    layer_name: valueSuggestion?.exposure_type ?? "",
    exposure_type: valueSuggestion?.exposure_type ?? "",
    geography_level: geoSuggestion?.geo_type === "fips_tract" ? "tract" : "county",
    value_type: "continuous",
    aggregation: "mean",
  });

  const saveMutation = useSaveConfig();

  const handleSave = useCallback(async () => {
    await saveMutation.mutateAsync({ importId, config });
    onComplete(config);
  }, [saveMutation, importId, config, onComplete]);

  const field = (label: string, children: React.ReactNode) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-muted">{label}</label>
      {children}
    </div>
  );

  const inputClass = "w-full rounded border border-surface-highlight bg-surface-overlay px-3 py-1.5 text-sm text-text-primary";

  return (
    <div className="space-y-4">
      <div className="rounded border border-border-default bg-surface-base p-4 space-y-4">
        {field(t("administration.gisImport.configure.fields.layerName"), (
          <input
            type="text"
            value={config.layer_name}
            onChange={(e) => setConfig((c) => ({ ...c, layer_name: e.target.value }))}
            placeholder={t("administration.gisImport.configure.placeholders.layerName")}
            className={inputClass}
          />
        ))}
        {field(t("administration.gisImport.configure.fields.exposureType"), (
          <input
            type="text"
            value={config.exposure_type}
            onChange={(e) => setConfig((c) => ({ ...c, exposure_type: e.target.value }))}
            placeholder={t("administration.gisImport.configure.placeholders.exposureType")}
            className={inputClass}
          />
        ))}
        {field(t("administration.gisImport.configure.fields.geographyLevel"), (
          <select
            value={config.geography_level}
            onChange={(e) => setConfig((c) => ({ ...c, geography_level: e.target.value }))}
            className={inputClass}
          >
            <option value="county">
              {t("administration.gisImport.configure.geographyLevels.county")}
            </option>
            <option value="tract">
              {t("administration.gisImport.configure.geographyLevels.tract")}
            </option>
            <option value="state">
              {t("administration.gisImport.configure.geographyLevels.state")}
            </option>
            <option value="country">
              {t("administration.gisImport.configure.geographyLevels.country")}
            </option>
            <option value="custom">
              {t("administration.gisImport.configure.geographyLevels.custom")}
            </option>
          </select>
        ))}
        {field(t("administration.gisImport.configure.fields.valueType"), (
          <select
            value={config.value_type}
            onChange={(e) => setConfig((c) => ({ ...c, value_type: e.target.value as ImportConfig["value_type"] }))}
            className={inputClass}
          >
            <option value="continuous">
              {t("administration.gisImport.configure.valueTypes.continuous")}
            </option>
            <option value="categorical">
              {t("administration.gisImport.configure.valueTypes.categorical")}
            </option>
            <option value="binary">
              {t("administration.gisImport.configure.valueTypes.binary")}
            </option>
          </select>
        ))}
        {field(t("administration.gisImport.configure.fields.aggregation"), (
          <select
            value={config.aggregation}
            onChange={(e) => setConfig((c) => ({ ...c, aggregation: e.target.value as ImportConfig["aggregation"] }))}
            className={inputClass}
          >
            <option value="mean">
              {t("administration.gisImport.configure.aggregations.mean")}
            </option>
            <option value="sum">
              {t("administration.gisImport.configure.aggregations.sum")}
            </option>
            <option value="max">
              {t("administration.gisImport.configure.aggregations.maximum")}
            </option>
            <option value="min">
              {t("administration.gisImport.configure.aggregations.minimum")}
            </option>
            <option value="latest">
              {t("administration.gisImport.configure.aggregations.latest")}
            </option>
          </select>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || !config.layer_name || !config.exposure_type}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-accent/90 disabled:opacity-50"
        >
          {saveMutation.isPending
            ? t("administration.gisImport.configure.saving")
            : t("administration.gisImport.configure.continue")}
        </button>
      </div>
    </div>
  );
}
