import { useEffect, useMemo, useState } from "react";
import { useAutoSave } from "../hooks/useAutoSave";
import type { ConceptSearchResult, Investigation, PhenotypeState } from "../types";
import { CohortBuilder } from "./phenotype/CohortBuilder";
import { CodeWASRunner } from "./phenotype/CodeWASRunner";
import { ValidationChecklist } from "./phenotype/ValidationChecklist";
import { CohortOverlapMatrix } from "./phenotype/CohortOverlapMatrix";
import { ConceptExplorer } from "./phenotype/ConceptExplorer";
import {
  ConceptSetBuilder,
  type ConceptSetEntry,
} from "./phenotype/ConceptSetBuilder";
import {
  SchemaDensityHeatmap,
  buildDomainCounts,
} from "./phenotype/SchemaDensityHeatmap";
import { useCreatePin } from "../hooks/useEvidencePins";

type SubTab = "explore" | "build" | "validate";

const SUB_TABS: { id: SubTab; label: string; disabled?: boolean }[] = [
  { id: "explore", label: "Explore" },
  { id: "build", label: "Build" },
  { id: "validate", label: "Validate" },
];

interface ConceptSetData {
  name: string;
  entries: ConceptSetEntry[];
}

interface PhenotypePanelProps {
  investigation: Investigation;
}

function makeDefaultSet(): [string, ConceptSetData] {
  return [
    crypto.randomUUID(),
    { name: "Untitled concept set", entries: [] },
  ];
}

export function PhenotypePanel({ investigation }: PhenotypePanelProps) {
  const [activeTab, setActiveTab] = useState<SubTab>("explore");

  // Initialize Map from saved phenotype_state.concept_sets
  const [conceptSets, setConceptSets] = useState<Map<string, ConceptSetData>>(
    () => {
      const saved = investigation.phenotype_state.concept_sets;
      if (saved && saved.length > 0) {
        const entries = saved.map((cs) => [
          cs.id,
          {
            name: cs.name,
            entries: cs.concepts.map((c) => ({
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
          },
        ] as [string, ConceptSetData]);
        return new Map(entries);
      }
      // No saved sets — create a default one
      return new Map([makeDefaultSet()]);
    },
  );

  const [activeSetId, setActiveSetId] = useState<string>(() => {
    const saved = investigation.phenotype_state.concept_sets;
    if (saved && saved.length > 0) {
      return saved[0].id;
    }
    // Return the key of the first (only) entry in the default map
    const defaultEntry = makeDefaultSet();
    return defaultEntry[0];
  });

  // Ensure activeSetId is always a valid key; fall back to first set
  const resolvedActiveSetId = useMemo(() => {
    if (conceptSets.has(activeSetId)) return activeSetId;
    const first = conceptSets.keys().next().value;
    return first ?? "";
  }, [conceptSets, activeSetId]);

  // Re-hydrate if investigation changes and conceptSets currently holds only
  // an empty default (i.e. saved state arrived after initial render)
  useEffect(() => {
    const saved = investigation.phenotype_state.concept_sets;
    if (!saved || saved.length === 0) return;

    setConceptSets((prev) => {
      // Only re-hydrate if we have a single empty default set
      if (prev.size === 1) {
        const [firstId, firstSet] = [...prev.entries()][0];
        if (firstSet.entries.length === 0) {
          // Replace with saved data
          const newMap = new Map(
            saved.map((cs) => [
              cs.id,
              {
                name: cs.name,
                entries: cs.concepts.map((c) => ({
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
              },
            ] as [string, ConceptSetData]),
          );
          // Swap activeSetId to the first saved set's id
          setActiveSetId(saved[0].id);
          // Clean up the old default key if it doesn't collide
          if (!newMap.has(firstId)) {
            // nothing extra needed — newMap already has the right keys
          }
          return newMap;
        }
      }
      return prev;
    });
  }, [investigation.phenotype_state.concept_sets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived: active set data
  const activeSet = conceptSets.get(resolvedActiveSetId) ?? {
    name: "Untitled concept set",
    entries: [],
  };

  // Derived: savedSets summary for the dropdown
  const savedSets = useMemo(
    () =>
      [...conceptSets.entries()].map(([id, s]) => ({
        id,
        name: s.name,
        count: s.entries.length,
      })),
    [conceptSets],
  );

  // Helpers to update a specific set immutably
  function updateSet(id: string, updater: (prev: ConceptSetData) => ConceptSetData) {
    setConceptSets((prev) => {
      const existing = prev.get(id);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(id, updater(existing));
      return next;
    });
  }

  function handleEntriesChange(entries: ConceptSetEntry[]) {
    updateSet(resolvedActiveSetId, (s) => ({ ...s, entries }));
  }

  function handleSetNameChange(name: string) {
    updateSet(resolvedActiveSetId, (s) => ({ ...s, name }));
  }

  function handleSwitchSet(id: string) {
    if (conceptSets.has(id)) {
      setActiveSetId(id);
    }
  }

  function handleNewSet() {
    const [newId, newSet] = makeDefaultSet();
    setConceptSets((prev) => {
      const next = new Map(prev);
      next.set(newId, newSet);
      return next;
    });
    setActiveSetId(newId);
  }

  function handleAddConcept(concept: ConceptSearchResult) {
    updateSet(resolvedActiveSetId, (s) => {
      if (s.entries.some((e) => e.concept.concept_id === concept.concept_id)) {
        return s;
      }
      return {
        ...s,
        entries: [
          ...s.entries,
          { concept, includeDescendants: true, isExcluded: false },
        ],
      };
    });
  }

  // Extra phenotype state fields managed by Build/Validate tabs
  const [phenotypePartial, setPhenotypePartial] = useState<Partial<PhenotypeState>>({
    selected_cohort_ids: investigation.phenotype_state.selected_cohort_ids ?? [],
    primary_cohort_id: investigation.phenotype_state.primary_cohort_id ?? null,
    import_mode: investigation.phenotype_state.import_mode ?? "parthenon",
  });

  function handleStateChange(partial: Partial<PhenotypeState>) {
    setPhenotypePartial((prev) => ({ ...prev, ...partial }));
  }

  // Build phenotypeState for auto-save using the Map-based multi-set shape
  const phenotypeState = useMemo(() => {
    return {
      concept_sets: Array.from(conceptSets.entries()).map(([id, set]) => ({
        id,
        name: set.name,
        concepts: set.entries.map((e) => ({
          concept_id: e.concept.concept_id,
          include_descendants: e.includeDescendants,
          is_excluded: e.isExcluded,
        })),
      })),
      cohort_definition: null,
      selected_cohort_ids: phenotypePartial.selected_cohort_ids ?? [],
      primary_cohort_id: phenotypePartial.primary_cohort_id ?? null,
      matching_config: null,
      import_mode: (phenotypePartial.import_mode ?? "parthenon") as PhenotypeState["import_mode"],
      codewas_config: null,
      last_codewas_run_id: null,
    };
  }, [conceptSets, phenotypePartial]);

  const { status } = useAutoSave(investigation.id, "phenotype", phenotypeState);

  const createPin = useCreatePin(investigation.id);

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

            {/* Right: Concept Set Builder + Domain heatmap (narrower) */}
            <div className="flex-[2] min-w-0 overflow-hidden flex flex-col gap-3 border-l border-zinc-700/50 pl-4">
              <div className="flex-1 min-h-0 overflow-hidden">
                <ConceptSetBuilder
                  entries={activeSet.entries}
                  onEntriesChange={handleEntriesChange}
                  setName={activeSet.name}
                  onSetNameChange={handleSetNameChange}
                  savedSets={savedSets}
                  onSwitchSet={handleSwitchSet}
                  onNewSet={handleNewSet}
                />
              </div>
              <div className="shrink-0">
                <SchemaDensityHeatmap
                  domains={buildDomainCounts(activeSet.entries)}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "build" && (
          <CohortBuilder
            investigation={investigation}
            onStateChange={handleStateChange}
            onPinFinding={(finding) => {
              createPin.mutate({
                domain: finding.domain,
                section: finding.section,
                finding_type: finding.finding_type,
                finding_payload: finding.finding_payload,
              });
            }}
          />
        )}

        {activeTab === "validate" && (
          <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
            <CodeWASRunner
              investigation={investigation}
              onPinFinding={(finding) => {
                createPin.mutate({
                  domain: finding.domain,
                  section: finding.section,
                  finding_type: finding.finding_type,
                  finding_payload: finding.finding_payload,
                });
              }}
            />
            <ValidationChecklist investigation={investigation} />
            <CohortOverlapMatrix
              cohorts={investigation.phenotype_state.selected_cohort_ids.map((id) => ({
                id,
                name: `Cohort #${id}`,
                count: 0,
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
