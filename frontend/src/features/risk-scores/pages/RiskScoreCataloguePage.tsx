import { useState, useMemo } from "react";
import { Activity, Play, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSourceStore } from "@/stores/sourceStore";
import {
  useRiskScoreCatalogue,
  useRiskScoreEligibility,
  useRiskScoreResults,
} from "../hooks/useRiskScores";
import { CATEGORY_ORDER } from "../types/riskScore";
import { RiskScoreCard } from "../components/RiskScoreCard";
import { RiskScoreRunModal } from "../components/RiskScoreRunModal";

export default function RiskScoreCataloguePage() {
  const { activeSourceId } = useSourceStore();
  const sourceId = activeSourceId ?? 0;

  const { data: catalogue, isLoading: loadingCatalogue } =
    useRiskScoreCatalogue();
  const { data: eligibility } = useRiskScoreEligibility(sourceId);
  const { data: results } = useRiskScoreResults(sourceId);

  const [runModal, setRunModal] = useState<{
    open: boolean;
    scoreIds?: string[];
  }>({ open: false });

  // Group scores by category in CATEGORY_ORDER
  const groupedScores = useMemo(() => {
    if (!catalogue?.scores) return [];

    const groups = new Map<
      string,
      typeof catalogue.scores
    >();
    for (const score of catalogue.scores) {
      const list = groups.get(score.category) ?? [];
      list.push(score);
      groups.set(score.category, list);
    }

    // Sort by CATEGORY_ORDER, then any extras alphabetically
    const ordered: Array<{
      category: string;
      scores: typeof catalogue.scores;
    }> = [];

    for (const cat of CATEGORY_ORDER) {
      const list = groups.get(cat);
      if (list) {
        ordered.push({ category: cat, scores: list });
        groups.delete(cat);
      }
    }
    // Remaining categories not in CATEGORY_ORDER
    for (const [cat, list] of [...groups.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      ordered.push({ category: cat, scores: list });
    }

    return ordered;
  }, [catalogue]);

  // Build a lookup for results by score_id
  const resultLookup = useMemo(() => {
    if (!results?.by_category) return new Map<string, {
      score_id: string;
      score_name: string;
      category: string;
      total_eligible: number;
      computable_count: number;
      tiers: Array<{
        risk_tier: string;
        patient_count: number;
        tier_fraction: number | null;
        mean_score: number | null;
        p25_score: number | null;
        median_score: number | null;
        p75_score: number | null;
        mean_confidence: number | null;
        mean_completeness: number | null;
        missing_components: Record<string, number>;
      }>;
    }>();

    const map = new Map<string, {
      score_id: string;
      score_name: string;
      category: string;
      total_eligible: number;
      computable_count: number;
      tiers: Array<{
        risk_tier: string;
        patient_count: number;
        tier_fraction: number | null;
        mean_score: number | null;
        p25_score: number | null;
        median_score: number | null;
        p75_score: number | null;
        mean_confidence: number | null;
        mean_completeness: number | null;
        missing_components: Record<string, number>;
      }>;
    }>();
    for (const catScores of Object.values(results.by_category)) {
      for (const s of catScores) {
        map.set(s.score_id, s);
      }
    }
    return map;
  }, [results]);

  // Count eligible scores
  const eligibleCount = useMemo(() => {
    if (!eligibility || !catalogue?.scores) return 0;
    return catalogue.scores.filter(
      (s) => eligibility[s.score_id]?.eligible,
    ).length;
  }, [eligibility, catalogue]);

  // Eligible score IDs for "Run All"
  const eligibleScoreIds = useMemo(() => {
    if (!eligibility || !catalogue?.scores) return [];
    return catalogue.scores
      .filter((s) => eligibility[s.score_id]?.eligible)
      .map((s) => s.score_id);
  }, [eligibility, catalogue]);

  const handleRunSingle = (scoreId: string) => {
    setRunModal({ open: true, scoreIds: [scoreId] });
  };

  const handleRunAll = () => {
    setRunModal({ open: true, scoreIds: eligibleScoreIds });
  };

  if (loadingCatalogue) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
        <span className="ml-2 text-sm text-[#5A5650]">
          Loading risk score catalogue...
        </span>
      </div>
    );
  }

  const totalScores = catalogue?.scores.length ?? 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity size={24} className="text-[#2DD4BF]" />
          <div>
            <h1 className="text-xl font-semibold text-[#F0EDE8]">
              Population Risk Scores
            </h1>
            <p className="text-sm text-[#8A857D]">
              {totalScores} score{totalScores !== 1 ? "s" : ""} available
              {sourceId > 0 &&
                eligibility &&
                ` \u00B7 ${eligibleCount} eligible`}
            </p>
          </div>
        </div>

        {sourceId > 0 && eligibleCount > 0 && (
          <button
            type="button"
            onClick={handleRunAll}
            className="flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2 text-sm font-medium text-white hover:bg-[#B42240] transition-colors"
          >
            <Play size={14} />
            Run All Eligible ({eligibleCount})
          </button>
        )}
      </div>

      {/* No source banner */}
      {!sourceId && (
        <div className="flex items-center gap-3 rounded-xl border border-[#C9A227]/20 bg-[#C9A227]/5 px-5 py-4">
          <AlertTriangle size={18} className="text-[#C9A227] shrink-0" />
          <p className="text-sm text-[#C9A227]">
            Select a data source to check eligibility and compute risk
            scores.
          </p>
        </div>
      )}

      {/* Grouped cards */}
      {groupedScores.map(({ category, scores }) => (
        <div key={category}>
          <h2 className="text-sm font-medium text-[#8A857D] uppercase tracking-wider mb-3">
            {category}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scores.map((score) => (
              <RiskScoreCard
                key={score.score_id}
                score={score}
                sourceId={sourceId > 0 ? sourceId : null}
                eligibility={eligibility?.[score.score_id]}
                result={resultLookup.get(score.score_id)}
                lastRun={results?.last_run ?? null}
                onRun={handleRunSingle}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Empty state */}
      {totalScores === 0 && !loadingCatalogue && (
        <div className={cn(
          "flex flex-col items-center justify-center py-16 rounded-xl",
          "border border-dashed border-[#2A2A2F] bg-[#141418]",
        )}>
          <Activity size={32} className="text-[#5A5650] mb-3" />
          <p className="text-sm text-[#8A857D]">
            No risk scores configured.
          </p>
        </div>
      )}

      {/* Run modal */}
      {runModal.open && sourceId > 0 && (
        <RiskScoreRunModal
          sourceId={sourceId}
          scoreIds={runModal.scoreIds}
          onClose={() => setRunModal({ open: false })}
        />
      )}
    </div>
  );
}
