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

const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  auto_accepted: {
    bg: "bg-[#2DD4BF]/15",
    text: "text-[#2DD4BF]",
    label: "Auto-Accepted",
  },
  quick_review: {
    bg: "bg-[#E5A84B]/15",
    text: "text-[#E5A84B]",
    label: "Quick Review",
  },
  full_review: {
    bg: "bg-[#E85A6B]/15",
    text: "text-[#E85A6B]",
    label: "Full Review",
  },
  unmappable: {
    bg: "bg-[#323238]",
    text: "text-[#5A5650]",
    label: "Unmappable",
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
  const topCandidate = mapping.candidates?.[0];
  const tier = mapping.review_tier
    ? TIER_STYLES[mapping.review_tier]
    : null;

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        mapping.is_reviewed
          ? "border-[#2DD4BF]/20 bg-[#151518]"
          : "border-[#232328] bg-[#151518]",
        isSelected && "ring-1 ring-[#9B1B30]/50",
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
              className="h-3.5 w-3.5 rounded border-[#323238] bg-[#0E0E11] accent-[#9B1B30]"
            />
          </div>
        )}

        {/* Expand toggle */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="pt-0.5 text-[#5A5650] hover:text-[#C5C0B8] transition-colors shrink-0"
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
            <span className="font-['IBM_Plex_Mono',monospace] text-sm font-bold text-[#F0EDE8]">
              {mapping.source_code}
            </span>
            {mapping.source_description && (
              <span className="text-sm text-[#C5C0B8] truncate">
                {mapping.source_description}
              </span>
            )}
          </div>

          {/* Source context */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {(mapping.source_table || mapping.source_column) && (
              <span className="text-xs text-[#5A5650] font-['IBM_Plex_Mono',monospace]">
                {[mapping.source_table, mapping.source_column]
                  .filter(Boolean)
                  .join(".")}
              </span>
            )}
            {mapping.source_frequency !== null && mapping.source_frequency > 0 && (
              <span className="text-xs text-[#8A857D]">
                Freq:{" "}
                <span className="text-[#C5C0B8] tabular-nums font-['IBM_Plex_Mono',monospace]">
                  {mapping.source_frequency.toLocaleString()}
                </span>
              </span>
            )}
            {mapping.strategy && (
              <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-[#5A5650] bg-[#232328] rounded px-1.5 py-0.5">
                {mapping.strategy}
              </span>
            )}
          </div>
        </div>

        {/* Top candidate summary */}
        <div className="shrink-0 flex items-center gap-3">
          {topCandidate && (
            <div className="text-right">
              <p className="text-sm text-[#C5C0B8] max-w-[200px] truncate">
                {topCandidate.concept_name}
              </p>
              <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
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
              {tier.label}
            </span>
          )}

          {/* Reviewed checkmark */}
          {mapping.is_reviewed && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#2DD4BF]/20">
              <Check size={12} className="text-[#2DD4BF]" />
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-1 pl-2 border-l border-[#232328]">
          <button
            type="button"
            onClick={() =>
              onReview(
                mapping.id,
                "approve",
                topCandidate?.target_concept_id,
              )
            }
            title="Accept top candidate"
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors",
              "text-[#2DD4BF] hover:bg-[#2DD4BF]/15",
            )}
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            onClick={() => onReview(mapping.id, "reject")}
            title="Reject mapping"
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors",
              "text-[#E85A6B] hover:bg-[#E85A6B]/15",
            )}
          >
            <X size={16} />
          </button>
          <button
            type="button"
            onClick={onOpenBrowser}
            title="Search for concept"
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors",
              "text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#1C1C20]",
            )}
          >
            <Search size={16} />
          </button>
        </div>
      </div>

      {/* Expanded candidates */}
      {isExpanded && mapping.candidates && mapping.candidates.length > 0 && (
        <div className="border-t border-[#232328] px-4 py-2 space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-[#5A5650] font-medium mb-1 px-3">
            Candidates ({mapping.candidates.length})
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
          <div className="border-t border-[#232328] px-4 py-6 text-center">
            <p className="text-xs text-[#5A5650]">
              No alternative candidates available
            </p>
          </div>
        )}
    </div>
  );
}
