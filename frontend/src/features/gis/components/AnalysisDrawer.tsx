import { ChevronUp, ChevronDown, BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getLayers } from "../layers/registry";
import { useLayerStore } from "../stores/layerStore";
import { getAnalysisDrawerTitle } from "../lib/i18n";

interface AnalysisDrawerProps {
  conceptId: number;
  metric: string;
}

export function AnalysisDrawer({ conceptId, metric }: AnalysisDrawerProps) {
  const { t } = useTranslation("app");
  const { activeLayers, drawerOpen, setDrawerOpen } = useLayerStore();
  const layers = getLayers();
  const activeLayerList = layers.filter((l) => activeLayers.has(l.id));

  if (activeLayerList.length === 0) return null;

  return (
    <div
      className={`border-t border-border-default bg-surface-base transition-all duration-200 ${
        drawerOpen ? "h-52" : "h-8"
      }`}
    >
      {/* Toggle bar */}
      <button
        onClick={() => setDrawerOpen(!drawerOpen)}
        className="flex h-8 w-full items-center justify-between px-4 text-xs text-text-muted hover:text-text-primary"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" />
          <span>
            {getAnalysisDrawerTitle(t, activeLayerList.length)}
          </span>
        </div>
        {drawerOpen ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Panels */}
      {drawerOpen && (
        <div className="flex h-[calc(100%-2rem)] gap-3 overflow-x-auto px-4 pb-3">
          {activeLayerList.map((layer) => {
            const Panel = layer.analysisPanel;
            return (
              <div
                key={layer.id}
                className="min-w-[320px] flex-shrink-0 rounded-lg border bg-surface-raised p-3"
                style={{ borderColor: `${layer.color}40` }}
              >
                <h4
                  className="mb-2 text-xs font-semibold"
                  style={{ color: layer.color }}
                >
                  {layer.name}
                </h4>
                <Panel conceptId={conceptId} metric={metric} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
