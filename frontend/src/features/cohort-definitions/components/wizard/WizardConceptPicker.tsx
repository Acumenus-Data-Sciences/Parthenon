import { useState, useMemo, useCallback } from "react";
import { Search, Sparkles, GitBranch } from "lucide-react";
import { VocabularySearchPanel } from "@/features/vocabulary/components/VocabularySearchPanel";
import { SemanticSearchPanel } from "@/features/vocabulary/components/SemanticSearchPanel";
import { HierarchyBrowserPanel } from "@/features/vocabulary/components/HierarchyBrowserPanel";
import { getConcept } from "@/features/vocabulary/api/vocabularyApi";
import type { DomainCriterionType } from "../../types/cohortExpression";
import type { WizardEntryConcept } from "../../utils/buildExpression";
import type { Concept } from "@/features/vocabulary/types/vocabulary";
import { SelectedConceptsList } from "./SelectedConceptsList";

type SearchTab = "keyword" | "semantic" | "hierarchy";

const DOMAIN_MAP: Record<string, DomainCriterionType> = {
  Condition: "ConditionOccurrence",
  Drug: "DrugExposure",
  Procedure: "ProcedureOccurrence",
  Measurement: "Measurement",
  Observation: "Observation",
  Visit: "VisitOccurrence",
  Death: "Death",
};

function resolveDomain(domainId: string): DomainCriterionType {
  return DOMAIN_MAP[domainId] ?? "ConditionOccurrence";
}

interface WizardConceptPickerProps {
  concepts: WizardEntryConcept[];
  onAdd: (concept: Concept, domain: DomainCriterionType) => void;
  onRemove: (conceptId: number) => void;
  onUpdateOptions?: (
    conceptId: number,
    options: Partial<
      Pick<WizardEntryConcept, "includeDescendants" | "includeMapped" | "firstOccurrenceOnly">
    >,
  ) => void;
  showFirstOccurrence?: boolean;
  prompt?: string;
}

export function WizardConceptPicker({
  concepts,
  onAdd,
  onRemove,
  onUpdateOptions,
  showFirstOccurrence = false,
}: WizardConceptPickerProps) {
  const [activeTab, setActiveTab] = useState<SearchTab>("keyword");
  const [isAdding, setIsAdding] = useState(false);

  const selectedIds = useMemo(
    () => new Set(concepts.map((c) => c.concept.concept_id)),
    [concepts],
  );

  const handleAddConcept = useCallback(
    async (conceptId: number) => {
      if (selectedIds.has(conceptId) || isAdding) return;
      setIsAdding(true);
      try {
        const concept = await getConcept(conceptId);
        const domain = resolveDomain(concept.domain_id);
        onAdd(concept, domain);
      } catch (err) {
        console.error("Failed to fetch concept:", err);
      } finally {
        setIsAdding(false);
      }
    },
    [selectedIds, isAdding, onAdd],
  );

  const tabs = [
    {
      key: "keyword" as const,
      label: "Keyword",
      icon: Search,
      color: "rgba(155,27,48,0.3)",
    },
    {
      key: "semantic" as const,
      label: "Semantic (AI)",
      icon: Sparkles,
      color: "rgba(45,212,191,0.3)",
    },
    {
      key: "hierarchy" as const,
      label: "Browse Hierarchy",
      icon: GitBranch,
      color: "rgba(201,162,39,0.3)",
    },
  ];

  return (
    <div className="rounded-lg border border-[#2a2a3a] bg-[#0E0E11] p-4">
      {/* Tab selector */}
      <div className="mb-3 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] transition-colors ${
              activeTab === tab.key
                ? "border border-current bg-opacity-15 font-medium"
                : "text-[#555] hover:text-[#888]"
            }`}
            style={
              activeTab === tab.key
                ? {
                    borderColor: tab.color,
                    color: tab.color.replace("0.3", "1"),
                  }
                : undefined
            }
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search panel */}
      <div className="max-h-[400px] overflow-y-auto">
        {activeTab === "keyword" && (
          <VocabularySearchPanel
            mode="build"
            conceptSetItemIds={selectedIds}
            onAddToSet={handleAddConcept}
          />
        )}
        {activeTab === "semantic" && (
          <SemanticSearchPanel
            mode="build"
            conceptSetItemIds={selectedIds}
            onAddToSet={handleAddConcept}
          />
        )}
        {activeTab === "hierarchy" && (
          <HierarchyBrowserPanel
            mode="browse"
            onSelectConcept={(conceptId) => void handleAddConcept(conceptId)}
          />
        )}
      </div>

      {/* Selected concepts */}
      <div className="mt-3">
        <SelectedConceptsList
          concepts={concepts}
          onRemove={onRemove}
          onUpdateOptions={onUpdateOptions}
          showFirstOccurrence={showFirstOccurrence}
        />
      </div>

      {/* Tip */}
      {concepts.length > 0 && (
        <div className="mt-3 rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-3 py-2">
          <span className="text-[#C9A227]">💡</span>{" "}
          <span className="text-[11px] text-[#999]">
            <strong className="text-[#C9A227]">Tip:</strong> &ldquo;Include descendants&rdquo;
            automatically captures all sub-types. For example, selecting &ldquo;Type 2 diabetes
            mellitus&rdquo; with descendants includes all specific complications.
          </span>
        </div>
      )}
    </div>
  );
}
