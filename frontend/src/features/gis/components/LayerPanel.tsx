import { useCallback, useMemo } from "react";
import { Layers, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getLayers } from "../layers/registry";
import { useLayerStore } from "../stores/layerStore";
import { DiseaseSelector } from "./DiseaseSelector";
import { CohortGeographySelector } from "./CohortGeographySelector";
import { useGisLayerMetadata } from "../hooks/useGis";
import type { CdmMetricType, CohortGeographySelection } from "../types";

interface LayerPanelProps {
  selectedConceptId: number | null;
  metric: CdmMetricType;
  cohortGeography: CohortGeographySelection;
  onDiseaseSelect: (conceptId: number, name: string) => void;
  onMetricChange: (metric: CdmMetricType) => void;
  onCohortGeographyChange: (selection: CohortGeographySelection) => void;
}

const METRIC_OPTIONS: CdmMetricType[] = ["cases", "hospitalization", "deaths"];

export function LayerPanel({
  selectedConceptId,
  metric,
  cohortGeography,
  onDiseaseSelect,
  onMetricChange,
  onCohortGeographyChange,
}: LayerPanelProps) {
  const { t } = useTranslation("app");
  const { activeLayers, toggleLayer } = useLayerStore();
  const layers = getLayers();
  const { data: layerMetadata } = useGisLayerMetadata();
  const metadataById = useMemo(
    () => new Map(layerMetadata?.map((item) => [item.id, item]) ?? []),
    [layerMetadata]
  );

  const handleToggle = useCallback(
    (id: string) => {
      toggleLayer(id);
    },
    [toggleLayer]
  );

  return (
    <div className="flex w-56 flex-col gap-3 overflow-y-auto border-r border-border-default bg-surface-base p-3">
      {/* Disease selector */}
      <DiseaseSelector
        selectedConceptId={selectedConceptId}
        onSelect={onDiseaseSelect}
      />

      <CohortGeographySelector
        selection={cohortGeography}
        onChange={onCohortGeographyChange}
      />

      {selectedConceptId !== null && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-3">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-ghost">
            {/* i18n-exempt: compact GIS metric selector label */}
            Outcome metric
          </span>
          <select
            value={metric}
            onChange={(event) => onMetricChange(event.target.value as CdmMetricType)}
            className="w-full rounded border border-border-default bg-surface-base px-2 py-1.5 text-xs text-text-primary focus:border-accent/50 focus:outline-none"
          >
            {METRIC_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === "hospitalization"
                  ? t("gis.countyDetail.hospitalized")
                  : option === "deaths"
                    ? t("gis.diseaseSummary.deaths")
                    : t("gis.diseaseSummary.cases")}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Layer toggles */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-3">
        <div className="mb-2 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-text-ghost" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
            {t("gis.layerPanel.title")}
          </h3>
        </div>
        <div className="space-y-1">
          {layers.map((layer) => {
            const isActive = activeLayers.has(layer.id);
            const metadata = metadataById.get(layer.id);
            const needsDisease = layer.requiresConcept === true && selectedConceptId === null;
            const needsCohortGeography =
              layer.requiresCohortGeography === true &&
              cohortGeography.cohort_definition_id === undefined &&
              cohortGeography.concept_id === undefined;
            const hasBackendData = metadata?.available ?? true;
            const isDisabled = needsDisease || needsCohortGeography || !hasBackendData;
            const Icon = layer.icon;
            return (
              <button
                key={layer.id}
                onClick={() => {
                  if (!isDisabled) handleToggle(layer.id);
                }}
                disabled={isDisabled}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                  isActive
                    ? "border border-opacity-50 bg-opacity-10"
                    : "border border-transparent text-text-muted hover:bg-surface-elevated"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                style={
                  isActive && !isDisabled
                    ? {
                        borderColor: `${layer.color}80`,
                        backgroundColor: `${layer.color}15`,
                        color: layer.color,
                      }
                    : undefined
                }
                >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="flex-1 truncate">{layer.name}</span>
                {isDisabled && (
                  <span className="text-[9px] uppercase text-text-ghost">
                    {needsDisease
                      ? t("gis.diseaseSelector.title")
                      : needsCohortGeography
                        ? "Cohort"
                        : t("gis.layers.comorbidity.analysis.noData")}
                  </span>
                )}
                {isActive && !isDisabled && (
                  <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-50" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Suppression threshold (collapsed by default) */}
      {layers.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-ghost">
            {t("gis.layerPanel.privacy")}
          </h3>
          <p className="text-[10px] text-text-ghost">
            {t("gis.layerPanel.suppressionOff")}
          </p>
        </div>
      )}
    </div>
  );
}
