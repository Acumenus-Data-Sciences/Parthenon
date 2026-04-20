import { useTranslation } from "react-i18next";
import { Check, X, Search, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConceptMapping, MappingAction } from "@/types/ingestion";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { CandidateRow } from "./CandidateRow";

interface MappingCardProps {
  mapping: ConceptMapping;
  onReview: (
    mappingId: number,
    action: MappingAction,
    targetConceptId?: number,
  ) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onOpenBrowser?: () => void;
}

const TIER_STYLES: Record<string, { bg: string; text: string; labelKey: string }> = {
  auto_accepted: {
    bg: "bg-success/15",
    text: "text-success",
    labelKey: "ingestion.mappingCard.autoAccepted",
  },
  quick_review: {
    bg: "bg-warning/15",
    text: "text-warning",
    labelKey: "ingestion.mappingCard.quickReview",
  },
  full_review: {
    bg: "bg-critical/15",
    text: "text-critical",
    labelKey: "ingestion.mappingCard.fullReview",
  },
  unmappable: {
    bg: "bg-surface-highlight",
    text: "text-text-ghost",
    labelKey: "ingestion.mappingCard.unmappable",
  },
};

export function MappingCard({
  mapping,
  onReview,
  isExpanded,
  onToggleExpand,
  isSelected,
  onToggleSelect,
  onOpenBrowser,
}: MappingCardProps) {
  const { t } = useTranslation("app");
  const topCandidate = mapping.candidates?.[0];
  const tier = mapping.review_tier
    ? TIER_STYLES[mapping.review_tier]
    : null;

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        mapping.is_reviewed
          ? "border-success/20 bg-surface-raised"
          : "border-border-default bg-surface-raised",
        isSelected && "ring-1 ring-primary/50",
      )}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Checkbox */}
        {onToggleSelect && (
          <div className="pt-1">
            <input
              type="checkbox"
              checked={isSelected ?? false}
              onChange={onToggleSelect}
              className="h-3.5 w-3.5 rounded border-surface-highlight bg-surface-base accent-primary"
            />
          </div>
        )}

        {/* Expand toggle */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="pt-0.5 text-text-ghost hover:text-text-secondary transition-colors shrink-0"
        >
          {isExpanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </button>

        {/* Source info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-['IBM_Plex_Mono',monospace] text-sm font-bold text-text-primary">
              {mapping.source_code}
            </span>
            {mapping.source_description && (
              <span className="text-sm text-text-secondary truncate">
                {mapping.source_description}
              </span>
            )}
          </div>

          {/* Source context */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {(mapping.source_table || mapping.source_column) && (
              <span className="text-xs text-text-ghost font-['IBM_Plex_Mono',monospace]">
                {[mapping.source_table, mapping.source_column]
                  .filter(Boolean)
                  .join(".")}
              </span>
            )}
            {mapping.source_frequency !== null && mapping.source_frequency > 0 && (
              <span className="text-xs text-text-muted">
                {t("ingestion.mappingCard.frequency")}{" "}
                <span className="text-text-secondary tabular-nums font-['IBM_Plex_Mono',monospace]">
                  {mapping.source_frequency.toLocaleString()}
                </span>
              </span>
            )}
            {mapping.strategy && (
              <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-text-ghost bg-surface-elevated rounded px-1.5 py-0.5">
                {mapping.strategy}
              </span>
            )}
          </div>
        </div>

        {/* Top candidate summary */}
        <div className="shrink-0 flex items-center gap-3">
          {topCandidate && (
            <div className="text-right">
              <p className="text-sm text-text-secondary max-w-[200px] truncate">
                {topCandidate.concept_name}
              </p>
              <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-text-muted">
                {topCandidate.target_concept_id}
              </span>
            </div>
          )}

          <ConfidenceBadge score={mapping.confidence} />

          {/* Review tier */}
          {tier && (
            <span
              className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium",
                tier.bg,
                tier.text,
              )}
            >
              {t(tier.labelKey)}
            </span>
          )}

          {/* Reviewed checkmark */}
          {mapping.is_reviewed && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-success/20">
              <Check size={12} className="text-success" />
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-1 pl-2 border-l border-border-default">
          <button
            type="button"
            onClick={() =>
              onReview(
                mapping.id,
                "approve",
                topCandidate?.target_concept_id,
              )
            }
            title={t("ingestion.mappingCard.acceptTopCandidate")}
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors",
              "text-success hover:bg-success/15",
            )}
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            onClick={() => onReview(mapping.id, "reject")}
            title={t("ingestion.mappingCard.rejectMapping")}
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors",
              "text-critical hover:bg-critical/15",
            )}
          >
            <X size={16} />
          </button>
          <button
            type="button"
            onClick={onOpenBrowser}
            title={t("ingestion.mappingCard.searchForConcept")}
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors",
              "text-text-muted hover:text-text-primary hover:bg-surface-overlay",
            )}
          >
            <Search size={16} />
          </button>
        </div>
      </div>

      {/* Expanded candidates */}
      {isExpanded && mapping.candidates && mapping.candidates.length > 0 && (
        <div className="border-t border-border-default px-4 py-2 space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-text-ghost font-medium mb-1 px-3">
            {t("ingestion.common.candidates", {
              count: mapping.candidates.length,
            })}
          </p>
          {mapping.candidates.map((candidate) => (
            <CandidateRow
              key={candidate.id}
              candidate={candidate}
              isSelected={candidate.target_concept_id === mapping.target_concept_id}
              onSelect={(conceptId) =>
                onReview(mapping.id, "remap", conceptId)
              }
            />
          ))}
        </div>
      )}

      {isExpanded &&
        (!mapping.candidates || mapping.candidates.length === 0) && (
          <div className="border-t border-border-default px-4 py-6 text-center">
            <p className="text-xs text-text-ghost">
              {t("ingestion.mappingCard.noAlternatives")}
            </p>
          </div>
        )}
    </div>
  );
}
