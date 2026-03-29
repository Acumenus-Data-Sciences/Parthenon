import { useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Activity,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSourceStore } from "@/stores/sourceStore";
import { useRiskScoreDetail } from "../hooks/useRiskScores";
import { TierBreakdownChart } from "../components/TierBreakdownChart";
import { RiskScoreRunModal } from "../components/RiskScoreRunModal";

export default function RiskScoreDetailPage() {
  const { scoreId } = useParams<{ scoreId: string }>();
  const [searchParams] = useSearchParams();
  const { activeSourceId, defaultSourceId } = useSourceStore();
  const querySourceId = searchParams.get("source");
  const sourceId = (querySourceId ? Number(querySourceId) : null) ?? activeSourceId ?? defaultSourceId ?? 0;

  const {
    data: detail,
    isLoading,
    isError,
  } = useRiskScoreDetail(sourceId, scoreId ?? "");

  const [showRunModal, setShowRunModal] = useState(false);

  if (!scoreId) {
    return (
      <div className="p-6">
        <Link
          to="/risk-scores"
          className="flex items-center gap-1.5 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to catalogue
        </Link>
        <p className="mt-8 text-center text-sm text-[#5A5650]">
          Invalid score ID.
        </p>
      </div>
    );
  }

  if (!sourceId) {
    return (
      <div className="p-6 space-y-4">
        <Link
          to="/risk-scores"
          className="flex items-center gap-1.5 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to catalogue
        </Link>
        <div className="flex items-center gap-3 rounded-xl border border-[#C9A227]/20 bg-[#C9A227]/5 px-5 py-4">
          <AlertTriangle
            size={18}
            className="text-[#C9A227] shrink-0"
          />
          <p className="text-sm text-[#C9A227]">
            Select a data source to view score results.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
        <span className="ml-2 text-sm text-[#5A5650]">
          Loading score details...
        </span>
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="p-6 space-y-4">
        <Link
          to="/risk-scores"
          className="flex items-center gap-1.5 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to catalogue
        </Link>
        <div
          className={cn(
            "flex flex-col items-center justify-center py-16 rounded-xl",
            "border border-dashed border-[#2A2A2F] bg-[#141418]",
          )}
        >
          <Activity size={32} className="text-[#5A5650] mb-3" />
          <p className="text-sm text-[#8A857D] mb-2">
            No results for this score.
          </p>
          <Link
            to="/risk-scores"
            className="text-sm text-[#2DD4BF] hover:underline"
          >
            Return to catalogue to run scores
          </Link>
        </div>
      </div>
    );
  }

  const completenessPercent =
    detail.completeness_rate != null
      ? (Number(detail.completeness_rate) * 100).toFixed(1)
      : null;

  return (
    <div className="space-y-6 p-6">
      {/* Back link */}
      <Link
        to="/risk-scores"
        className="flex items-center gap-1.5 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
      >
        <ArrowLeft size={14} />
        Back to catalogue
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-semibold text-[#F0EDE8]">
              {detail.score_name}
            </h1>
            <span className="inline-block rounded-md bg-[#1A1A1F] px-2.5 py-1 text-xs font-medium text-[#8A857D] uppercase tracking-wider">
              {detail.category}
            </span>
          </div>
          <p className="text-sm text-[#8A857D]">{detail.description}</p>
          {detail.last_run && (
            <p className="text-xs text-[#5A5650] mt-1">
              Last computed:{" "}
              {new Date(detail.last_run).toLocaleString()}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowRunModal(true)}
          className="flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2 text-sm font-medium text-white hover:bg-[#B42240] transition-colors shrink-0"
        >
          <RefreshCw size={14} />
          Re-run
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Eligible"
          value={detail.total_eligible.toLocaleString()}
          sub="patients"
        />
        <StatCard
          label="Computable"
          value={detail.total_computable.toLocaleString()}
          sub="patients"
        />
        <StatCard
          label="Completeness"
          value={
            completenessPercent != null ? `${completenessPercent}%` : "-"
          }
          sub="of eligible"
        />
        <StatCard
          label="Confidence"
          value={`${(Number(detail.mean_confidence) * 100).toFixed(1)}%`}
          sub="mean"
        />
      </div>

      {/* Tier breakdown */}
      {detail.tiers.length > 0 && (
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
          <h2 className="text-sm font-medium text-[#F0EDE8] mb-4">
            Tier Breakdown
          </h2>
          <TierBreakdownChart tiers={detail.tiers} />
        </div>
      )}

      {/* Required components */}
      {detail.required_components.length > 0 && (
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
          <h2 className="text-sm font-medium text-[#F0EDE8] mb-3">
            Required Components
          </h2>
          <div className="flex flex-wrap gap-2">
            {detail.required_components.map((comp) => (
              <span
                key={comp}
                className="inline-block rounded-lg bg-[#1A1A1F] border border-[#2A2A2F] px-3 py-1.5 text-xs text-[#C5C0B8] font-['IBM_Plex_Mono',monospace]"
              >
                {comp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Eligible population */}
      {detail.eligible_population && (
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
          <h2 className="text-sm font-medium text-[#F0EDE8] mb-2">
            Eligible Population
          </h2>
          <p className="text-sm text-[#8A857D]">
            {detail.eligible_population}
          </p>
        </div>
      )}

      {/* Run modal */}
      {showRunModal && (
        <RiskScoreRunModal
          sourceId={sourceId}
          scoreIds={[scoreId]}
          onClose={() => setShowRunModal(false)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-4">
      <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-lg font-semibold font-['IBM_Plex_Mono',monospace] text-[#F0EDE8]">
        {value}
      </p>
      <p className="text-[10px] text-[#8A857D]">{sub}</p>
    </div>
  );
}
