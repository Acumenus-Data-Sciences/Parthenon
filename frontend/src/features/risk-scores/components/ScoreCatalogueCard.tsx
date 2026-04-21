import {
  CheckCircle2,
  Clock3,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("app");
  const isEligible = eligibility?.eligible === true;
  const patientCount = eligibility?.patient_count ?? 0;
  const hasCompletedResult = sourceResult != null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-lg border bg-surface-raised p-4 text-left transition-all",
        "border-border-default hover:border-success/30 hover:bg-surface-overlay",
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className="shrink-0 rounded px-1.5 py-0.5 font-['IBM_Plex_Mono',monospace] text-[10px]"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {score.score_id}
        </span>
        <h3 className="truncate text-sm font-medium text-text-primary transition-colors group-hover:text-success">
          {score.score_name}
        </h3>
      </div>
      <p className="mb-2 line-clamp-2 text-xs text-text-muted">
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
                {t("riskScores.hub.catalogue.eligibleCount", {
                  count: patientCount.toLocaleString(),
                })}
              </>
            ) : (
              <>
                <XCircle size={10} />
                {t("riskScores.scoreDetail.insufficientData")}
              </>
            )}
          </span>
        )}

        {sourceSelected && hasCompletedResult && (
          <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info">
            <Clock3 size={10} />
            {t("riskScores.common.status.completed")}
          </span>
        )}
      </div>
    </button>
  );
}
