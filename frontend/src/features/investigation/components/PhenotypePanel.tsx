import { useState } from "react";
import type { ConceptSearchResult } from "../types";
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

export function PhenotypePanel() {
  const [activeTab, setActiveTab] = useState<SubTab>("explore");
  const [conceptSetEntries, setConceptSetEntries] = useState<ConceptSetEntry[]>(
    [],
  );

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
      <div className="flex items-center gap-1 border-b border-zinc-700/50 px-4 pt-3 pb-0 shrink-0">
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
