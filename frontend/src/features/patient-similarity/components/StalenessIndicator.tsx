import { AlertTriangle, RefreshCw } from "lucide-react";
import { useComputeStatus, useTriggerCompute } from "../hooks/usePatientSimilarity";

interface StalenessIndicatorProps {
  sourceId: number;
}

export function StalenessIndicator({ sourceId }: StalenessIndicatorProps) {
  const { data: status, isLoading } = useComputeStatus(sourceId);
  const computeMutation = useTriggerCompute();

  if (isLoading || !status) return null;

  if (status.staleness_warning) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[#C9A227]/10 border border-[#C9A227]/20 px-3 py-1.5">
        <AlertTriangle size={14} className="text-[#C9A227] shrink-0" />
        <span className="text-xs text-[#C9A227]">
          Features are stale
          {status.days_since_compute !== null
            ? ` (${status.days_since_compute}d ago)`
            : ""}
        </span>
        <button
          type="button"
          onClick={() => computeMutation.mutate({ sourceId, force: true })}
          disabled={computeMutation.isPending}
          className="text-xs text-[#C9A227] hover:text-[#D4AF37] font-medium transition-colors disabled:opacity-50"
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
    <span className="text-[10px] text-[#5A5650]">
      {status.days_since_compute !== null
        ? `Updated ${status.days_since_compute}d ago`
        : "Not yet computed"}
      {" \u00B7 "}
      {status.patient_count.toLocaleString()} patients
    </span>
  );
}
