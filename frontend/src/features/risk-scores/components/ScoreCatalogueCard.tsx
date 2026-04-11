import {
  CheckCircle2,
  Clock3,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  RiskScoreModel,
  ScoreEligibility,
  RiskScoreSourceSummaryItem,
} from "../types/riskScore";

interface ScoreCatalogueCardProps {
  score: RiskScoreModel;
  color: string;
  eligibility: ScoreEligibility | undefined;
  sourceResult: RiskScoreSourceSummaryItem | undefined;
  sourceSelected: boolean;
  onClick: () => void;
}

export function ScoreCatalogueCard({
  score,
  color,
  eligibility,
  sourceResult,
  sourceSelected,
  onClick,
}: ScoreCatalogueCardProps) {
  const isEligible = eligibility?.eligible === true;
  const patientCount = eligibility?.patient_count ?? 0;
  const hasCompletedResult = sourceResult != null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border bg-surface-raised p-4 transition-all group",
        "border-border-default hover:border-success/30 hover:bg-surface-overlay",
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="font-['IBM_Plex_Mono',monospace] text-[10px] px-1.5 py-0.5 rounded shrink-0"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {score.score_id}
        </span>
        <h3 className="text-sm font-medium text-text-primary truncate group-hover:text-success transition-colors">
          {score.score_name}
        </h3>
      </div>
      <p className="text-xs text-text-muted line-clamp-2 mb-2">
        {score.description}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {sourceSelected && eligibility && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              isEligible
                ? "bg-success/10 text-success"
                : "bg-text-ghost/10 text-text-ghost",
            )}
          >
            {isEligible ? (
              <>
                <CheckCircle2 size={10} />
                {patientCount.toLocaleString()} eligible
              </>
            ) : (
              <>
                <XCircle size={10} />
                Insufficient data
              </>
            )}
          </span>
        )}

        {sourceSelected && hasCompletedResult && (
          <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info">
            <Clock3 size={10} />
            Completed
          </span>
        )}
      </div>
    </button>
  );
}
