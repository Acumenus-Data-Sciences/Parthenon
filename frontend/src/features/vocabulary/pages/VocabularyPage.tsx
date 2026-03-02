import { useState } from "react";
import { VocabularySearchPanel } from "../components/VocabularySearchPanel";
import { ConceptDetailPanel } from "../components/ConceptDetailPanel";

export default function VocabularyPage() {
  const [selectedConceptId, setSelectedConceptId] = useState<number | null>(
    null,
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F0EDE8]">
          Vocabulary Browser
        </h1>
        <p className="mt-1 text-sm text-[#8A857D]">
          Search, explore, and navigate the OMOP standardized vocabulary
        </p>
      </div>

      {/* Split Pane Layout */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden" style={{ height: "calc(100vh - 200px)" }}>
        <div className="flex h-full">
          {/* Search Panel (40%) */}
          <div className="w-[40%] shrink-0 h-full overflow-hidden">
            <VocabularySearchPanel
              selectedConceptId={selectedConceptId}
              onSelectConcept={setSelectedConceptId}
            />
          </div>

          {/* Detail Panel (60%) */}
          <div className="flex-1 h-full overflow-hidden">
            <ConceptDetailPanel conceptId={selectedConceptId} />
          </div>
        </div>
      </div>
    </div>
  );
}
