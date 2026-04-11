import { useCallback } from "react";
import { Layers, ChevronRight } from "lucide-react";
import { getLayers } from "../layers/registry";
import { useLayerStore } from "../stores/layerStore";
import { DiseaseSelector } from "./DiseaseSelector";

interface LayerPanelProps {
  selectedConceptId: number | null;
  onDiseaseSelect: (conceptId: number, name: string) => void;
}

export function LayerPanel({ selectedConceptId, onDiseaseSelect }: LayerPanelProps) {
  const { activeLayers, toggleLayer } = useLayerStore();
  const layers = getLayers();

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

      {/* Layer toggles */}
      <div className="rounded-lg border border-border-default bg-[#141418] p-3">
        <div className="mb-2 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-text-ghost" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
            Analysis Layers
          </h3>
        </div>
        <div className="space-y-1">
          {layers.map((layer) => {
            const isActive = activeLayers.has(layer.id);
            const Icon = layer.icon;
            return (
              <button
                key={layer.id}
                onClick={() => handleToggle(layer.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                  isActive
                    ? "border border-opacity-50 bg-opacity-10"
                    : "border border-transparent text-text-muted hover:bg-surface-elevated"
                }`}
                style={
                  isActive
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
                {isActive && (
                  <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-50" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Suppression threshold (collapsed by default) */}
      {layers.length > 0 && (
        <div className="rounded-lg border border-border-default bg-[#141418] p-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-ghost">
            Privacy
          </h3>
          <p className="text-[10px] text-text-ghost">
            Suppression: off (synthetic data)
          </p>
        </div>
      )}
    </div>
  );
}
