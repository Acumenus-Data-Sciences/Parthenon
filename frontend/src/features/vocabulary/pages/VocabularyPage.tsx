import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { VocabularySearchPanel } from "../components/VocabularySearchPanel";
import { ConceptDetailPanel } from "../components/ConceptDetailPanel";
import { HelpButton } from "@/features/help";

export default function VocabularyPage() {
  const [searchParams] = useSearchParams();
  const conceptParam = searchParams.get("concept");

  const [selectedConceptId, setSelectedConceptId] = useState<number | null>(
    conceptParam ? Number(conceptParam) : null,
  );

  // If the URL changes (e.g., navigated from a profile link), update selection
  useEffect(() => {
    if (conceptParam) {
      const id = Number(conceptParam);
      if (id > 0) setSelectedConceptId(id);
    }
  }, [conceptParam]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">
            Vocabulary Browser
          </h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Search, explore, and navigate the OMOP standardized vocabulary
          </p>
        </div>
        <HelpButton helpKey="vocabulary-search" />
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
            <ConceptDetailPanel conceptId={selectedConceptId} onSelectConcept={setSelectedConceptId} />
          </div>
        </div>
      </div>
    </div>
  );
}
