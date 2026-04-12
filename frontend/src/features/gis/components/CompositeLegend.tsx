import { getLayers } from "../layers/registry";
import { useLayerStore } from "../stores/layerStore";

export function CompositeLegend() {
  const { activeLayers } = useLayerStore();
  const layers = getLayers();
  const activeLayerList = layers.filter((l) => activeLayers.has(l.id));

  if (activeLayerList.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 z-10 max-w-xs rounded-lg border border-border-default bg-surface-base/90 p-3 backdrop-blur-sm">
      {activeLayerList.map((layer) => (
        <div key={layer.id} className="mb-2 last:mb-0">
          <h4
            className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: layer.color }}
          >
            {layer.name}
          </h4>
          <div className="space-y-0.5">
            {layer.legendItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-text-muted">
                {item.type === "gradient" && (
                  <div
                    className="h-2 w-8 rounded-sm"
                    style={{
                      background: `linear-gradient(to right, ${layer.color}30, ${layer.color})`,
                    }}
                  />
                )}
                {item.type === "category" && (
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                {item.type === "circle" && (
                  <div
                    className="h-2 w-2 rounded-full border"
                    style={{ borderColor: item.color }}
                  />
                )}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
