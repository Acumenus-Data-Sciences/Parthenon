import { useEffect, useMemo, useState } from "react";
import { useAutoSave } from "../hooks/useAutoSave";
import type { ConceptSearchResult, Investigation } from "../types";
import { ConceptExplorer } from "./phenotype/ConceptExplorer";
import {
  ConceptSetBuilder,
  type ConceptSetEntry,
} from "./phenotype/ConceptSetBuilder";

type SubTab = "explore" | "build" | "validate";

const SUB_TABS: { id: SubTab; label: string; disabled?: boolean }[] = [
  { id: "explore", label: "Explore" },
  { id: "build", label: "Build", disabled: true },
  { id: "validate", label: "Validate", disabled: true },
];

interface PhenotypePanelProps {
  investigation: Investigation;
}

export function PhenotypePanel({ investigation }: PhenotypePanelProps) {
  const [activeTab, setActiveTab] = useState<SubTab>("explore");
  const [conceptSetEntries, setConceptSetEntries] = useState<ConceptSetEntry[]>(
    () => {
      // Hydrate from saved phenotype_state on mount
      const saved = investigation.phenotype_state.concept_sets;
      if (!saved || saved.length === 0) return [];

      // Flatten all concepts from saved concept sets into entries
      return saved.flatMap((cs) =>
        cs.concepts.map((c) => ({
          concept: {
            concept_id: c.concept_id,
            concept_name: "",
            domain_id: "",
            vocabulary_id: "",
            concept_class_id: "",
            standard_concept: null,
            concept_code: "",
          } satisfies ConceptSearchResult,
          includeDescendants: c.include_descendants,
          isExcluded: c.is_excluded,
        })),
      );
    },
  );

  // Keep hydration in sync if investigation changes (e.g. refetch after save)
  // Only re-hydrate if entries are empty and saved state is non-empty
  useEffect(() => {
    const saved = investigation.phenotype_state.concept_sets;
    if (saved && saved.length > 0 && conceptSetEntries.length === 0) {
      setConceptSetEntries(
        saved.flatMap((cs) =>
          cs.concepts.map((c) => ({
            concept: {
              concept_id: c.concept_id,
              concept_name: "",
              domain_id: "",
              vocabulary_id: "",
              concept_class_id: "",
              standard_concept: null,
              concept_code: "",
            } satisfies ConceptSearchResult,
            includeDescendants: c.include_descendants,
            isExcluded: c.is_excluded,
          })),
        ),
      );
    }
  }, [investigation.phenotype_state.concept_sets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build phenotypeState for auto-save (only concept_sets serialized for now)
  const phenotypeState = useMemo(() => {
    return {
      concept_sets:
        conceptSetEntries.length > 0
          ? [
              {
                id: "default",
                name: "Concept Set",
                concepts: conceptSetEntries.map((e) => ({
                  concept_id: e.concept.concept_id,
                  include_descendants: e.includeDescendants,
                  is_excluded: e.isExcluded,
                })),
              },
            ]
          : [],
      cohort_definition: null,
      selected_cohort_ids: [],
      primary_cohort_id: null,
      matching_config: null,
      import_mode: "parthenon" as const,
      codewas_config: null,
      last_codewas_run_id: null,
    };
  }, [conceptSetEntries]);

  const { status } = useAutoSave(investigation.id, "phenotype", phenotypeState);

  function handleAddConcept(concept: ConceptSearchResult) {
    setConceptSetEntries((prev) => {
      if (prev.some((e) => e.concept.concept_id === concept.concept_id)) {
        return prev;
      }
      return [
        ...prev,
        { concept, includeDescendants: true, isExcluded: false },
      ];
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar */}
      <div className="flex items-center justify-between border-b border-zinc-700/50 px-4 pt-3 pb-0 shrink-0">
        <div className="flex items-center gap-1">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              className={`relative px-3 py-2 text-xs font-medium transition-colors rounded-t ${
                tab.disabled
                  ? "text-zinc-600 cursor-not-allowed"
                  : activeTab === tab.id
                    ? "text-[#2DD4BF]"
                    : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
              {tab.disabled && (
                <span className="ml-1.5 text-[9px] text-zinc-700 font-normal">
                  Phase 1b
                </span>
              )}
              {activeTab === tab.id && !tab.disabled && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2DD4BF] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Save status badge */}
        {status !== "idle" && (
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
              status === "saving"
                ? "text-amber-400 bg-amber-900/20 border-amber-600/30"
                : status === "saved"
                  ? "text-[#2DD4BF] bg-teal-900/20 border-teal-600/30"
                  : "text-[#9B1B30] bg-red-900/20 border-red-700/30"
            }`}
          >
            {status === "saving"
              ? "Saving..."
              : status === "saved"
                ? "Saved"
                : "Error"}
          </span>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        {activeTab === "explore" && (
          <div className="flex h-full gap-4">
            {/* Left: Concept Explorer (wider) */}
            <div className="flex-[3] min-w-0 overflow-hidden flex flex-col">
              <ConceptExplorer onAddConcept={handleAddConcept} />
            </div>

            {/* Right: Concept Set Builder (narrower) */}
            <div className="flex-[2] min-w-0 overflow-hidden flex flex-col border-l border-zinc-700/50 pl-4">
              <ConceptSetBuilder
                entries={conceptSetEntries}
                onEntriesChange={setConceptSetEntries}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
