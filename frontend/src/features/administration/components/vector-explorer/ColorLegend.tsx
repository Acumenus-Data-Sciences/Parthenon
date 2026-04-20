import type { ClusterInfo, QualityReport } from "../../api/chromaStudioApi";
import { QUALITY_COLORS, type CollectionTheme, type ExplorerMode } from "./constants";
import { useTranslation } from "react-i18next";

interface ColorLegendProps {
  mode: ExplorerMode;
  clusters: ClusterInfo[];
  quality: QualityReport | null;
  collectionTheme: CollectionTheme;
  clusterVisibility: Map<number, boolean>;
  selectedClusterId: number | null;
  onSelectCluster: (id: number) => void;
  onToggleCluster: (id: number) => void;
  totalSampled: number;
}

export default function ColorLegend({
  mode,
  clusters,
  quality,
  collectionTheme,
  clusterVisibility,
  selectedClusterId,
  onSelectCluster,
  onToggleCluster,
  totalSampled,
}: ColorLegendProps) {
  const { t } = useTranslation("app");

  if (mode === "clusters") {
    return (
      <div className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("administration.vectorExplorer.legend.clusters")}
        </h4>
        {clusters.map((c) => {
          const visible = clusterVisibility.get(c.id) ?? true;
          const selected = selectedClusterId === c.id;
          return (
            <div
              key={c.id}
              className={`rounded border transition-opacity ${
                selected ? "border-accent/35 bg-surface-raised" : "border-transparent"
              } ${visible ? "opacity-100" : "opacity-40"}`}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => onSelectCluster(c.id)}
                  className="flex min-w-0 flex-1 items-start gap-1.5 rounded px-1.5 py-1 text-left text-sm hover:bg-surface-raised"
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 rounded-full"
                    style={{ background: collectionTheme.palette[c.id % collectionTheme.palette.length] }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-text-secondary">{c.label}</div>
                    {c.summary?.subtitle && (
                      <div className="truncate text-xs text-text-ghost">{c.summary.subtitle}</div>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-2 px-1.5 py-1">
                  <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">{c.size}</span>
                  <button
                    type="button"
                    onClick={() => onToggleCluster(c.id)}
                    className="rounded border border-border-default px-2 py-0.5 text-[11px] text-text-muted hover:bg-surface-base hover:text-text-secondary"
                  >
                    {visible
                      ? t("administration.vectorExplorer.legend.hide")
                      : t("administration.vectorExplorer.legend.show")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (mode === "qa" && quality) {
    const items = [
      { labelKey: "outliers", color: QUALITY_COLORS.outlier, count: quality.outlier_ids.length },
      { labelKey: "duplicates", color: QUALITY_COLORS.duplicate, count: quality.duplicate_pairs.length },
      { labelKey: "orphans", color: QUALITY_COLORS.orphan, count: quality.orphan_ids.length },
      { labelKey: "normal", color: QUALITY_COLORS.normal, count: totalSampled - quality.outlier_ids.length - quality.orphan_ids.length },
    ];
    return (
      <div className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("administration.vectorExplorer.legend.quality")}
        </h4>
        {items.map((item) => (
          <div key={item.labelKey} className="flex items-center justify-between px-1.5 py-1 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              <span className="text-text-secondary">
                {t(`administration.vectorExplorer.quality.${item.labelKey}`)}
              </span>
            </div>
            <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">{item.count}</span>
          </div>
        ))}
      </div>
    );
  }

  if (mode === "query") {
    return (
      <div className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("administration.vectorExplorer.legend.similarity")}
        </h4>
        <div className="flex items-center gap-2 px-1.5 py-1">
          <div
            className="h-2 w-full rounded-full"
            style={{
              background: `linear-gradient(to right, #9B1B30, #C9A227, ${collectionTheme.accent})`,
            }}
          />
        </div>
        <div className="flex justify-between px-1.5 text-xs text-text-ghost">
          <span>0.0</span>
          <span>0.5</span>
          <span>1.0</span>
        </div>
      </div>
    );
  }

  return null;
}
