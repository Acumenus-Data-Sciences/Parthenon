import { useConceptHierarchy } from "../../hooks/useConceptSearch";
import type { ConceptSearchResult } from "../../types";

const DOMAIN_BADGE_CLASSES: Record<string, string> = {
  Condition: "bg-[#9B1B30]/20 text-[#9B1B30] border border-[#9B1B30]/30",
  Drug: "bg-teal-900/30 text-teal-400 border border-teal-500/30",
  Measurement: "bg-yellow-900/30 text-[#C9A227] border border-yellow-600/30",
  Procedure: "bg-blue-900/30 text-blue-400 border border-blue-500/30",
  Observation: "bg-purple-900/30 text-purple-400 border border-purple-500/30",
  Device: "bg-orange-900/30 text-orange-400 border border-orange-500/30",
  Visit: "bg-surface-accent/50 text-zinc-300 border border-border-hover/30",
};

function domainBadgeClass(domain: string): string {
  return (
    DOMAIN_BADGE_CLASSES[domain] ??
    "bg-surface-accent/50 text-zinc-400 border border-border-hover/30"
  );
}

interface ConceptNodeProps {
  concept: ConceptSearchResult & { level?: number };
  indent: number;
  variant: "ancestor" | "selected" | "descendant";
}

function ConceptNode({ concept, indent, variant }: ConceptNodeProps) {
  const indentPx = indent * 16;

  const rowClass =
    variant === "selected"
      ? "border border-[#2DD4BF]/40 bg-[#2DD4BF]/5 rounded px-2 py-1.5"
      : "py-1";

  return (
    <div className="flex items-start" style={{ paddingLeft: `${indentPx}px` }}>
      {indent > 0 && (
        <div className="mr-1.5 mt-2 shrink-0 flex flex-col items-center">
          <div className="w-px h-2 bg-surface-accent" />
          <div className="w-2 h-px bg-surface-accent" />
        </div>
      )}
      <div className={`flex-1 min-w-0 ${rowClass}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`text-xs leading-snug ${
              variant === "selected"
                ? "text-zinc-100 font-medium"
                : variant === "ancestor"
                  ? "text-zinc-400"
                  : "text-zinc-300"
            }`}
          >
            {concept.concept_name}
          </span>
          <span
            className={`text-[10px] rounded px-1 py-0.5 leading-none ${domainBadgeClass(concept.domain_id)}`}
          >
            {concept.domain_id}
          </span>
          {variant === "selected" && (
            <span className="text-[10px] text-[#2DD4BF] font-semibold">
              (selected)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ConceptTreeProps {
  conceptId: number;
  conceptName?: string;
}

export function ConceptTree({ conceptId, conceptName }: ConceptTreeProps) {
  const { data: hierarchy, isLoading } = useConceptHierarchy(conceptId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-border-hover border-t-[#2DD4BF]" />
        Loading hierarchy…
      </div>
    );
  }

  if (!hierarchy) return null;

  const { ancestors, descendants } = hierarchy;

  // Sort ancestors by level descending (highest ancestors first)
  const sortedAncestors = [...ancestors].sort(
    (a, b) => (b.level ?? 0) - (a.level ?? 0),
  );

  return (
    <div className="space-y-0.5">
      {sortedAncestors.length === 0 && descendants.length === 0 && (
        <p className="text-xs text-zinc-600 py-1">
          No hierarchy data available for this concept.
        </p>
      )}

      {/* Ancestors — from most distant down to immediate parent */}
      {sortedAncestors.map((concept, i) => (
        <ConceptNode
          key={`anc-${concept.concept_id}`}
          concept={concept}
          indent={i}
          variant="ancestor"
        />
      ))}

      {/* Selected concept */}
      <ConceptNode
        concept={{
          concept_id: conceptId,
          concept_name: conceptName ?? `Concept ${conceptId}`,
          domain_id: "",
          vocabulary_id: "",
          concept_class_id: "",
          standard_concept: null,
          concept_code: "",
        }}
        indent={sortedAncestors.length}
        variant="selected"
      />

      {/* Descendants — indented below selected */}
      {descendants.map((concept) => (
        <ConceptNode
          key={`desc-${concept.concept_id}`}
          concept={concept}
          indent={sortedAncestors.length + 1 + Math.min((concept.level ?? 1) - 1, 4)}
          variant="descendant"
        />
      ))}
    </div>
  );
}
