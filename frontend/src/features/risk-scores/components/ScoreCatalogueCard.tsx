import {
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskScoreModel, ScoreEligibility } from "../types/riskScore";

interface ScoreCatalogueCardProps {
  score: RiskScoreModel;
  color: string;
  eligibility: ScoreEligibility | undefined;
  sourceSelected: boolean;
  onClick: () => void;
}

export function ScoreCatalogueCard({
  score,
  color,
  eligibility,
  sourceSelected,
  onClick,
}: ScoreCatalogueCardProps) {
  const isEligible = eligibility?.eligible === true;
  const patientCount = eligibility?.patient_count ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border bg-[#151518] p-4 transition-all group",
        "border-[#232328] hover:border-[#2DD4BF]/30 hover:bg-[#1C1C20]",
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="font-['IBM_Plex_Mono',monospace] text-[10px] px-1.5 py-0.5 rounded shrink-0"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {score.score_id}
        </span>
        <h3 className="text-sm font-medium text-[#F0EDE8] truncate group-hover:text-[#2DD4BF] transition-colors">
          {score.score_name}
        </h3>
      </div>
      <p className="text-xs text-[#8A857D] line-clamp-2 mb-2">
        {score.description}
      </p>

      {/* Eligibility badge */}
      {sourceSelected && eligibility && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
            isEligible
              ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
              : "bg-[#5A5650]/10 text-[#5A5650]",
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
    </button>
  );
}
