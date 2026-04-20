import { useTranslation } from "react-i18next";
import type { ProjectedPoint3D } from "../../api/chromaStudioApi";

interface PointInspectorProps {
  points: ProjectedPoint3D[];
  selectedIds: Set<string>;
  accentColor?: string;
  outlierIds?: Set<string>;
  duplicateIds?: Set<string>;
  orphanIds?: Set<string>;
  loadingIds?: Set<string>;
  error?: string | null;
}

export default function PointInspector({
  points,
  selectedIds,
  accentColor = "var(--success)",
  outlierIds,
  duplicateIds,
  orphanIds,
  loadingIds,
  error,
}: PointInspectorProps) {
  const { t } = useTranslation("app");
  const selected = points.filter((p) => selectedIds.has(p.id));

  if (selected.length === 0) {
    return (
      <div className="text-sm text-text-ghost">
        {t("administration.vectorExplorer.inspector.selectPoint")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded border border-critical/30 bg-critical/10 px-3 py-2 text-xs text-critical">
          {error}
        </div>
      )}
      {selected.map((point) => {
        const flags: Array<"outlier" | "duplicate" | "orphan"> = [];
        if (outlierIds?.has(point.id)) flags.push("outlier");
        if (duplicateIds?.has(point.id)) flags.push("duplicate");
        if (orphanIds?.has(point.id)) flags.push("orphan");
        const isLoading = loadingIds?.has(point.id) ?? false;

        return (
          <div key={point.id} className="rounded border border-border-default bg-surface-base p-3">
            <div className="font-['IBM_Plex_Mono',monospace] text-xs" style={{ color: accentColor }}>
              {point.id}
            </div>
            {flags.length > 0 && (
              <div className="mt-1 flex gap-1">
                {flags.map((f) => (
                  <span
                    key={f}
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: f === "outlier" ? "#E85A6B20" : f === "duplicate" ? "#F59E0B20" : "#5A565020",
                      color: f === "outlier" ? "var(--critical)" : f === "duplicate" ? "var(--warning)" : "var(--text-ghost)",
                    }}
                  >
                    {t(`administration.vectorExplorer.inspector.flags.${f}`)}
                  </span>
                ))}
              </div>
            )}
            {Object.keys(point.metadata).length > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(point.metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-text-muted">{k}</span>
                    <span className="max-w-[60%] truncate text-text-secondary">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            {isLoading && (
              <div className="mt-2 text-xs text-text-ghost">
                {t("administration.vectorExplorer.inspector.loadingDetails")}
              </div>
            )}
            <div className="mt-2 font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">
              ({point.x.toFixed(3)}, {point.y.toFixed(3)}, {point.z.toFixed(3)})
            </div>
          </div>
        );
      })}
    </div>
  );
}
