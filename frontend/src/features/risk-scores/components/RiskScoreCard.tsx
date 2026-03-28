import { useState } from "react";
import { Link } from "react-router-dom";
import { Play, RefreshCw, BarChart3, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  RiskScoreModel,
  ScoreEligibility,
  RiskScoreTier,
} from "../types/riskScore";
import { TIER_COLORS, TIER_ORDER } from "../types/riskScore";

interface ScoreSummary {
  score_id: string;
  score_name: string;
  category: string;
  total_eligible: number;
  computable_count: number;
  tiers: RiskScoreTier[];
}

interface RiskScoreCardProps {
  score: RiskScoreModel;
  sourceId: number | null;
  eligibility: ScoreEligibility | undefined;
  result: ScoreSummary | undefined;
  lastRun: string | null;
  onRun: (scoreId: string) => void;
}

function MiniTierBar({ tiers }: { tiers: RiskScoreTier[] }) {
  const total = tiers.reduce((sum, t) => sum + t.patient_count, 0);
  if (total === 0) return null;

  // Sort tiers by TIER_ORDER
  const sorted = [...tiers].sort((a, b) => {
    const ai = TIER_ORDER.indexOf(
      a.risk_tier as (typeof TIER_ORDER)[number],
    );
    const bi = TIER_ORDER.indexOf(
      b.risk_tier as (typeof TIER_ORDER)[number],
    );
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#1A1A1F]">
      {sorted.map((t) => {
        const pct = (t.patient_count / total) * 100;
        if (pct < 0.5) return null;
        return (
          <div
            key={t.risk_tier}
            className="h-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              backgroundColor:
                TIER_COLORS[t.risk_tier] ?? TIER_COLORS.uncomputable,
            }}
            title={`${t.risk_tier}: ${t.patient_count} (${pct.toFixed(1)}%)`}
          />
        );
      })}
    </div>
  );
}

export function RiskScoreCard({
  score,
  sourceId,
  eligibility,
  result,
  lastRun,
  onRun,
}: RiskScoreCardProps) {
  const [showMissing, setShowMissing] = useState(false);

  const hasSource = sourceId != null && sourceId > 0;
  const isEligible = eligibility?.eligible ?? false;
  const hasResults = result != null && result.tiers.length > 0;
  const isIneligible = hasSource && eligibility != null && !isEligible;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        isIneligible
          ? "border-[#2A2A2F]/50 bg-[#141418]/50 opacity-60"
          : "border-[#2A2A2F] bg-[#141418] hover:bg-[#1A1A1F]",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#F0EDE8] truncate">
            {score.score_name}
          </h3>
          <span className="inline-block mt-0.5 rounded-md bg-[#1A1A1F] px-2 py-0.5 text-[10px] font-medium text-[#8A857D] uppercase tracking-wider">
            {score.category}
          </span>
        </div>

        {/* Action area */}
        {!hasSource && (
          <span className="text-[10px] text-[#5A5650] whitespace-nowrap pt-0.5">
            Select source
          </span>
        )}
        {hasSource && hasResults && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              to={`/risk-scores/${score.score_id}?source=${sourceId}`}
              className="rounded-lg p-1.5 text-[#2DD4BF] hover:bg-[#2DD4BF]/10 transition-colors"
              title="View details"
            >
              <BarChart3 size={14} />
            </Link>
            <button
              type="button"
              onClick={() => onRun(score.score_id)}
              className="rounded-lg p-1.5 text-[#8A857D] hover:text-[#C9A227] hover:bg-[#C9A227]/10 transition-colors"
              title="Re-run"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        )}
        {hasSource && isEligible && !hasResults && (
          <button
            type="button"
            onClick={() => onRun(score.score_id)}
            className="flex items-center gap-1.5 rounded-lg bg-[#9B1B30] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#B42240] transition-colors shrink-0"
          >
            <Play size={12} />
            Run
          </button>
        )}
        {isIneligible && (
          <button
            type="button"
            onClick={() => setShowMissing(!showMissing)}
            className="rounded-lg p-1.5 text-[#5A5650] hover:text-[#8A857D] transition-colors shrink-0"
            title="Show missing components"
          >
            <AlertTriangle size={14} />
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-[#8A857D] line-clamp-2 mb-3">
        {score.description}
      </p>

      {/* Results: tier bar + stats */}
      {hasResults && result && (
        <div className="space-y-2">
          <MiniTierBar tiers={result.tiers} />
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-['IBM_Plex_Mono',monospace] text-[#C5C0B8]">
              {result.computable_count.toLocaleString()} patients
            </span>
            {lastRun && (
              <span className="text-[#5A5650]">
                {new Date(lastRun).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Ineligible: missing tooltip */}
      {isIneligible && (
        <div className="mt-1">
          <span className="text-[10px] text-[#5A5650]">
            Insufficient data
          </span>
          {showMissing && eligibility?.missing && eligibility.missing.length > 0 && (
            <div className="mt-2 rounded-lg bg-[#0E0E11] border border-[#2A2A2F] p-2">
              <p className="text-[10px] text-[#8A857D] mb-1">
                Missing components:
              </p>
              <div className="flex flex-wrap gap-1">
                {eligibility.missing.map((m) => (
                  <span
                    key={m}
                    className="inline-block rounded bg-[#E85A6B]/10 px-1.5 py-0.5 text-[10px] text-[#E85A6B] font-['IBM_Plex_Mono',monospace]"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
