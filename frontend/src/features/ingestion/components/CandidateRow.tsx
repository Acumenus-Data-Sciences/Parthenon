import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { MappingCandidate } from "@/types/ingestion";

interface CandidateRowProps {
  candidate: MappingCandidate;
  onSelect?: (conceptId: number) => void;
  isSelected?: boolean;
}

function scoreColor(score: number) {
  if (score >= 0.95) return "var(--success)";
  if (score >= 0.7) return "var(--warning)";
  if (score > 0) return "var(--critical)";
  return "var(--text-ghost)";
}

export function CandidateRow({
  candidate,
  onSelect,
  isSelected,
}: CandidateRowProps) {
  const { t } = useTranslation("app");
  const color = scoreColor(candidate.score);
  const isStandard = candidate.standard_concept === "S";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(candidate.target_concept_id)}
      className={cn(
        "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left transition-colors",
        "hover:bg-surface-overlay",
        isSelected
          ? "bg-surface-elevated border border-primary/50"
          : "bg-transparent border border-transparent",
      )}
    >
      {/* Concept ID */}
      <span
        className={cn(
          "shrink-0 font-['IBM_Plex_Mono',monospace] text-xs tabular-nums",
          isStandard ? "text-accent" : "text-text-muted",
        )}
      >
        {candidate.target_concept_id}
      </span>

      {/* Concept name + badges */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">
          {candidate.concept_name}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          {/* Domain badge */}
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-info/15 text-info">
            {candidate.domain_id}
          </span>
          {/* Vocabulary badge */}
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent/15 text-accent">
            {candidate.vocabulary_id}
          </span>
          {/* Standard badge */}
          {isStandard && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-success/15 text-success">
              {t("ingestion.conceptBrowser.standard")}
            </span>
          )}
        </div>
      </div>

      {/* Score bar */}
      <div className="shrink-0 flex items-center gap-2 w-28">
        <div className="flex-1 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.round(candidate.score * 100)}%`,
              backgroundColor: color,
            }}
          />
        </div>
        <span
          className="text-[10px] font-['IBM_Plex_Mono',monospace] tabular-nums w-8 text-right"
          style={{ color }}
        >
          {(candidate.score * 100).toFixed(0)}%
        </span>
      </div>

      {/* Strategy */}
      <span className="shrink-0 text-[10px] font-['IBM_Plex_Mono',monospace] text-text-ghost w-16 text-right truncate">
        {candidate.strategy}
      </span>
    </button>
  );
}
