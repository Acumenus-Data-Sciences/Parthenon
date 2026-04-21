import { useConceptHierarchy } from "../../hooks/useConceptSearch";
import { useTranslation } from "react-i18next";
import type { ConceptSearchResult } from "../../types";

const DOMAIN_BADGE_CLASSES: Record<string, string> = {
  Condition: "bg-primary/20 text-primary border border-primary/30",
  Drug: "bg-success/10 text-success border border-success/30",
  Measurement: "bg-yellow-900/30 text-accent border border-yellow-600/30",
  Procedure: "bg-blue-900/30 text-blue-400 border border-blue-500/30",
  Observation: "bg-purple-900/30 text-purple-400 border border-purple-500/30",
  Device: "bg-orange-900/30 text-orange-400 border border-orange-500/30",
  Visit: "bg-surface-accent/50 text-text-secondary border border-border-hover/30",
};

function domainBadgeClass(domain: string): string {
  return (
    DOMAIN_BADGE_CLASSES[domain] ??
    "bg-surface-accent/50 text-text-muted border border-border-hover/30"
  );
}

interface ConceptNodeProps {
  concept: ConceptSearchResult & { level?: number };
  indent: number;
  variant: "ancestor" | "selected" | "descendant";
  selectedLabel: string;
}

function ConceptNode({ concept, indent, variant, selectedLabel }: ConceptNodeProps) {
  const indentPx = indent * 16;

  const rowClass =
    variant === "selected"
      ? "border border-success/40 bg-success/5 rounded px-2 py-1.5"
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
                ? "text-text-primary font-medium"
                : variant === "ancestor"
                  ? "text-text-muted"
                  : "text-text-secondary"
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
            <span className="text-[10px] text-success font-semibold">
              {selectedLabel}
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
  const { t } = useTranslation("app");
  const { data: hierarchy, isLoading } = useConceptHierarchy(conceptId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-text-ghost py-2">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-border-hover border-t-success" />
        {t("investigation.phenotype.conceptTree.loadingHierarchy")}
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
        <p className="text-xs text-text-ghost py-1">
          {t("investigation.phenotype.conceptTree.noHierarchyData")}
        </p>
      )}

      {/* Ancestors — from most distant down to immediate parent */}
      {sortedAncestors.map((concept, i) => (
        <ConceptNode
          key={`anc-${concept.concept_id}`}
          concept={concept}
          indent={i}
          variant="ancestor"
          selectedLabel={t("investigation.phenotype.conceptTree.selected")}
        />
      ))}

      {/* Selected concept */}
      <ConceptNode
        concept={{
          concept_id: conceptId,
          concept_name:
            conceptName ??
            t("investigation.phenotype.conceptTree.conceptLabel", {
              id: conceptId,
            }),
          domain_id: "",
          vocabulary_id: "",
          concept_class_id: "",
          standard_concept: null,
          concept_code: "",
        }}
        indent={sortedAncestors.length}
        variant="selected"
        selectedLabel={t("investigation.phenotype.conceptTree.selected")}
      />

      {/* Descendants — indented below selected */}
      {descendants.map((concept) => (
        <ConceptNode
          key={`desc-${concept.concept_id}`}
          concept={concept}
          indent={sortedAncestors.length + 1 + Math.min((concept.level ?? 1) - 1, 4)}
          variant="descendant"
          selectedLabel={t("investigation.phenotype.conceptTree.selected")}
        />
      ))}
    </div>
  );
}
