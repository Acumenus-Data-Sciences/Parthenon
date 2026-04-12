import { Loader2, MapPin, Layers, BarChart3 } from "lucide-react";
import type { RegionDetail as RegionDetailType } from "../types";

interface RegionDetailProps {
  detail: RegionDetailType | null;
  loading: boolean;
  onClose: () => void;
  onDrillDown: (gid: string) => void;
}

export function RegionDetail({
  detail,
  loading,
  onClose,
  onDrillDown,
}: RegionDetailProps) {
  if (!detail && !loading) return null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          {loading ? "Loading..." : detail?.name}
        </h3>
        <button
          onClick={onClose}
          className="text-xs text-text-ghost hover:text-text-primary"
        >
          Close
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-text-ghost">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading region details...
        </div>
      )}

      {detail && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-text-muted">
              <MapPin className="h-3 w-3" />
              {detail.country_name}
            </div>
            <div className="flex items-center gap-1.5 text-text-muted">
              <Layers className="h-3 w-3" />
              {detail.level} — {detail.type ?? "Region"}
            </div>
          </div>

          {detail.area_km2 !== null && (
            <div className="text-xs text-text-ghost">
              Area: {detail.area_km2.toLocaleString()} km²
            </div>
          )}

          {detail.child_count > 0 && (
            <button
              onClick={() => onDrillDown(detail.gid)}
              className="w-full rounded border border-border-default bg-surface-base px-3 py-1.5 text-xs text-accent hover:border-accent/50"
            >
              Drill down ({detail.child_count} sub-regions)
            </button>
          )}

          {detail.exposures.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-ghost">
                <BarChart3 className="h-3 w-3" />
                Exposures
              </div>
              <div className="space-y-1">
                {detail.exposures.map((exp) => (
                  <div
                    key={exp.concept_id}
                    className="flex items-center justify-between rounded bg-surface-base px-2 py-1 text-xs"
                  >
                    <span className="text-text-muted">
                      Concept {exp.concept_id}
                    </span>
                    <span className="text-text-primary">
                      avg: {exp.avg?.toFixed(2) ?? "—"} ({exp.count} records)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
