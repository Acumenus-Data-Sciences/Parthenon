import { AlertTriangle, RefreshCw } from "lucide-react";
import { useComputeStatus, useTriggerCompute } from "../hooks/usePatientSimilarity";

interface StalenessIndicatorProps {
  sourceId: number;
}

function daysSinceCompute(latestComputedAt: string | null): number | null {
  if (!latestComputedAt) return null;
  const computed = new Date(latestComputedAt);
  const now = new Date();
  return Math.floor((now.getTime() - computed.getTime()) / (1000 * 60 * 60 * 24));
}

export function StalenessIndicator({ sourceId }: StalenessIndicatorProps) {
  const { data: status, isLoading } = useComputeStatus(sourceId);
  const computeMutation = useTriggerCompute();

  if (isLoading || !status) return null;

  const daysAgo = daysSinceCompute(status.latest_computed_at);

  if (status.staleness_warning) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/20 px-3 py-1.5">
        <AlertTriangle size={14} className="text-accent shrink-0" />
        <span className="text-xs text-accent">
          Features are stale
          {daysAgo !== null
            ? ` (${daysAgo}d ago)`
            : ""}
        </span>
        <button
          type="button"
          onClick={() => computeMutation.mutate({ sourceId, force: true })}
          disabled={computeMutation.isPending}
          className="text-xs text-accent hover:text-[#D4AF37] font-medium transition-colors disabled:opacity-50"
        >
          {computeMutation.isPending ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : (
            "Recompute"
          )}
        </button>
      </div>
    );
  }

  return (
    <span className="text-[10px] text-text-ghost">
      {daysAgo !== null
        ? `Updated ${daysAgo}d ago`
        : "Not yet computed"}
      {" \u00B7 "}
      {status.total_vectors.toLocaleString()} patients
    </span>
  );
}
