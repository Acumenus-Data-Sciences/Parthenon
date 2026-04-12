import { useState, useCallback } from "react";
import { useSaveConfig } from "../../hooks/useGisImport";
import type { ImportConfig, ColumnSuggestion } from "../../types/gisImport";

interface Props {
  importId: number;
  suggestions: ColumnSuggestion[];
  onComplete: (config: ImportConfig) => void;
}

export function ConfigureStep({ importId, suggestions, onComplete }: Props) {
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
      <label className="mb-1 block text-xs font-medium text-[#8A857D]">{label}</label>
      {children}
    </div>
  );

  const inputClass = "w-full rounded border border-[#323238] bg-[#1C1C20] px-3 py-1.5 text-sm text-[#E8E4DC]";

  return (
    <div className="space-y-4">
      <div className="rounded border border-[#232328] bg-[#0E0E11] p-4 space-y-4">
        {field("Layer Name", (
          <input
            type="text"
            value={config.layer_name}
            onChange={(e) => setConfig((c) => ({ ...c, layer_name: e.target.value }))}
            placeholder="e.g., Social Vulnerability Index"
            className={inputClass}
          />
        ))}
        {field("Exposure Type", (
          <input
            type="text"
            value={config.exposure_type}
            onChange={(e) => setConfig((c) => ({ ...c, exposure_type: e.target.value }))}
            placeholder="e.g., svi_overall"
            className={inputClass}
          />
        ))}
        {field("Geography Level", (
          <select
            value={config.geography_level}
            onChange={(e) => setConfig((c) => ({ ...c, geography_level: e.target.value }))}
            className={inputClass}
          >
            <option value="county">County</option>
            <option value="tract">Census Tract</option>
            <option value="state">State</option>
            <option value="country">Country</option>
            <option value="custom">Custom</option>
          </select>
        ))}
        {field("Value Type", (
          <select
            value={config.value_type}
            onChange={(e) => setConfig((c) => ({ ...c, value_type: e.target.value as ImportConfig["value_type"] }))}
            className={inputClass}
          >
            <option value="continuous">Continuous (choropleth)</option>
            <option value="categorical">Categorical (discrete colors)</option>
            <option value="binary">Binary (presence/absence)</option>
          </select>
        ))}
        {field("Aggregation", (
          <select
            value={config.aggregation}
            onChange={(e) => setConfig((c) => ({ ...c, aggregation: e.target.value as ImportConfig["aggregation"] }))}
            className={inputClass}
          >
            <option value="mean">Mean</option>
            <option value="sum">Sum</option>
            <option value="max">Maximum</option>
            <option value="min">Minimum</option>
            <option value="latest">Latest</option>
          </select>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || !config.layer_name || !config.exposure_type}
          className="rounded bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#C9A227]/90 disabled:opacity-50"
        >
          {saveMutation.isPending ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
