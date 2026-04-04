import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Sparkles, FolderTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { VocabularySearchPanel } from "../components/VocabularySearchPanel";
import { ConceptDetailPanel } from "../components/ConceptDetailPanel";
import { SemanticSearchPanel } from "../components/SemanticSearchPanel";
import { HierarchyBrowserPanel } from "../components/HierarchyBrowserPanel";
import { HelpButton } from "@/features/help";

type SearchTab = "keyword" | "semantic" | "browse";

export default function VocabularyPage() {
  const [searchParams] = useSearchParams();
  const conceptParam = searchParams.get("concept");

  const [selectedConceptId, setSelectedConceptId] = useState<number | null>(
    conceptParam ? Number(conceptParam) : null,
  );
  const [activeTab, setActiveTab] = useState<SearchTab>("keyword");

  // If the URL changes (e.g., navigated from a profile link), update selection
  useEffect(() => {
    if (conceptParam) {
      const id = Number(conceptParam);
      if (id > 0) setSelectedConceptId(id);
    }
  }, [conceptParam]);

  // When a concept is selected from semantic search, also show its detail
  const handleSelectConcept = (id: number) => {
    setSelectedConceptId(id);
  };

  const tabs: { id: SearchTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "keyword",
      label: "Keyword Search",
      icon: <Search size={13} />,
    },
    {
      id: "semantic",
      label: "Semantic Search",
      icon: <Sparkles size={13} />,
    },
    {
      id: "browse" as const,
      label: "Browse Hierarchy",
      icon: <FolderTree size={13} />,
    },
  ];

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
      <div
        className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden"
        style={{ height: "calc(100vh - 200px)" }}
      >
        <div className="flex h-full">
          {/* Left pane: tab switcher + search panel (40%) */}
          <div className="w-[40%] shrink-0 h-full overflow-hidden flex flex-col border-r border-[#232328]">
            {/* Tab switcher */}
            <div className="flex border-b border-[#232328] bg-[#0E0E11] shrink-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors flex-1 justify-center",
                    activeTab === tab.id
                      ? tab.id === "keyword"
                        ? "border-b-2 border-[#C9A227] text-[#C9A227] bg-[#C9A227]/5"
                        : "border-b-2 border-[#2DD4BF] text-[#2DD4BF] bg-[#2DD4BF]/5"
                      : "text-[#8A857D] hover:text-[#C5C0B8] hover:bg-[#1C1C20]",
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Active search panel */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "keyword" ? (
                <VocabularySearchPanel
                  mode="browse"
                  selectedConceptId={selectedConceptId}
                  onSelectConcept={handleSelectConcept}
                />
              ) : activeTab === "semantic" ? (
                <SemanticSearchPanel
                  mode="browse"
                  onSelectConcept={handleSelectConcept}
                />
              ) : activeTab === "browse" ? (
                <HierarchyBrowserPanel
                  mode="browse"
                  onSelectConcept={handleSelectConcept}
                  selectedConceptId={selectedConceptId}
                />
              ) : null}
            </div>
          </div>

          {/* Detail Panel (60%) */}
          <div className="flex-1 h-full overflow-hidden">
            <ConceptDetailPanel
              conceptId={selectedConceptId}
              onSelectConcept={handleSelectConcept}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
