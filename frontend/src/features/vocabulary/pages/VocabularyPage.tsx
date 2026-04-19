import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Sparkles, FolderTree } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { VocabularySearchPanel } from "../components/VocabularySearchPanel";
import { ConceptDetailPanel } from "../components/ConceptDetailPanel";
import { SemanticSearchPanel } from "../components/SemanticSearchPanel";
import { HierarchyBrowserPanel } from "../components/HierarchyBrowserPanel";
import { HelpButton } from "@/features/help";

type SearchTab = "keyword" | "semantic" | "browse";

export default function VocabularyPage() {
  const { t } = useTranslation("app");
  const [searchParams] = useSearchParams();
  const conceptParam = searchParams.get("concept");

  const [selectedConceptId, setSelectedConceptId] = useState<number | null>(
    conceptParam ? Number(conceptParam) : null,
  );
  const [activeTab, setActiveTab] = useState<SearchTab>("keyword");

  // If the URL changes (e.g., navigated from a profile link), update selection
  /* eslint-disable react-hooks/set-state-in-effect -- URL concept params are an external navigation source for the detail pane. */
  useEffect(() => {
    if (conceptParam) {
      const id = Number(conceptParam);
      if (id > 0) setSelectedConceptId(id);
    }
  }, [conceptParam]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // When a concept is selected from semantic search, also show its detail
  const handleSelectConcept = (id: number) => {
    setSelectedConceptId(id);
  };

  const tabs: { id: SearchTab; labelKey: string; icon: React.ReactNode }[] = [
    {
      id: "keyword",
      labelKey: "keyword",
      icon: <Search size={13} />,
    },
    {
      id: "semantic",
      labelKey: "semantic",
      icon: <Sparkles size={13} />,
    },
    {
      id: "browse" as const,
      labelKey: "browse",
      icon: <FolderTree size={13} />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {t("vocabulary.page.title")}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {t("vocabulary.page.subtitle")}
          </p>
        </div>
        <HelpButton helpKey="vocabulary-search" />
      </div>

      {/* Split Pane Layout */}
      <div
        className="rounded-lg border border-border-default bg-surface-raised overflow-hidden"
        style={{ height: "calc(100vh - 200px)" }}
      >
        <div className="flex h-full">
          {/* Left pane: tab switcher + search panel (40%) */}
          <div className="w-[40%] shrink-0 h-full overflow-hidden flex flex-col border-r border-border-default">
            {/* Tab switcher */}
            <div className="flex border-b border-border-default bg-surface-base shrink-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors flex-1 justify-center",
                    activeTab === tab.id
                      ? tab.id === "keyword"
                        ? "border-b-2 border-accent text-accent bg-accent/5"
                        : "border-b-2 border-success text-success bg-success/5"
                      : "text-text-muted hover:text-text-secondary hover:bg-surface-overlay",
                  )}
                >
                  {tab.icon}
                  {t(`vocabulary.page.tabs.${tab.labelKey}`)}
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
