import { X, FlaskConical, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getLayers } from "../layers/registry";
import { useLayerStore } from "../stores/layerStore";

interface ContextPanelProps {
  conceptId: number;
  diseaseName: string;
}

export function ContextPanel({ conceptId, diseaseName }: ContextPanelProps) {
  const navigate = useNavigate();
  const { activeLayers, selectedFips, selectedName, setSelectedRegion } =
    useLayerStore();
  const layers = getLayers();
  const activeLayerList = layers.filter((l) => activeLayers.has(l.id));

  return (
    <div className="flex w-56 flex-col gap-3 overflow-y-auto border-l border-border-default bg-surface-base p-3">
      {/* Disease info */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-3">
        <h3 className="text-xs font-semibold text-accent">{diseaseName}</h3>
        <p className="mt-1 text-[10px] text-text-ghost">
          {activeLayerList.length} analysis layer
          {activeLayerList.length !== 1 ? "s" : ""} active
        </p>
      </div>

      {/* Selected region detail panels */}
      {selectedFips && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-primary">
              {selectedName ?? selectedFips}
            </h3>
            <button
              onClick={() => setSelectedRegion(null, null)}
              className="rounded p-0.5 text-text-ghost hover:text-text-primary"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {activeLayerList.map((layer) => {
            const DetailPanel = layer.detailPanel;
            return (
              <div
                key={layer.id}
                className="rounded-lg border bg-surface-raised p-3"
                style={{ borderColor: `${layer.color}40` }}
              >
                <h4
                  className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: layer.color }}
                >
                  {layer.name}
                </h4>
                <DetailPanel fips={selectedFips} conceptId={conceptId} />
              </div>
            );
          })}

          {/* Research actions */}
          <div className="rounded-lg border border-border-default bg-surface-raised p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-ghost">
              Research Actions
            </h3>
            <div className="space-y-2">
              <button
                onClick={() =>
                  navigate(
                    `/studies/create?region=${selectedFips}&region_name=${encodeURIComponent(selectedName ?? "")}`
                  )
                }
                className="flex w-full items-center gap-2 rounded border border-border-default bg-surface-base px-3 py-2 text-xs text-accent hover:border-accent/50"
              >
                <FlaskConical className="h-3 w-3" />
                Create Study
              </button>
              <button
                onClick={() =>
                  navigate(`/cohort-definitions?region=${selectedFips}`)
                }
                className="flex w-full items-center gap-2 rounded border border-border-default bg-surface-base px-3 py-2 text-xs text-success hover:border-success/50"
              >
                <Search className="h-3 w-3" />
                Browse Cohorts
              </button>
            </div>
          </div>
        </>
      )}

      {/* Prompt when no region selected */}
      {!selectedFips && activeLayerList.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-3 text-center">
          <p className="text-xs text-text-ghost">
            Click a region on the map to see layer details
          </p>
        </div>
      )}
    </div>
  );
}
