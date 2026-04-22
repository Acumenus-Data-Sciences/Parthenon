import { type ReactNode } from "react";
import { Search, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getConceptSetBuilderTabLabel } from "../lib/i18n";

type SearchTab = "keyword" | "semantic";

interface ConceptSetBuilderLayoutProps {
  activeTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  searchPanel: ReactNode;
  contentsPanel: ReactNode;
  itemCount?: number;
}

export function ConceptSetBuilderLayout({
  activeTab,
  onTabChange,
  searchPanel,
  contentsPanel,
  itemCount,
}: ConceptSetBuilderLayoutProps) {
  const { t } = useTranslation("app");
  const tabs: { id: SearchTab; label: string; icon: ReactNode }[] = [
    {
      id: "keyword",
      label: getConceptSetBuilderTabLabel(t, "keyword"),
      icon: <Search size={13} />,
    },
    {
      id: "semantic",
      label: getConceptSetBuilderTabLabel(t, "semantic"),
      icon: <Sparkles size={13} />,
    },
  ];

  return (
    <div
      className="rounded-lg border border-border-default bg-surface-raised overflow-hidden"
      style={{ height: "calc(100vh - 220px)" }}
    >
      <div className="flex h-full">
        {/* Left pane: tab switcher + search panel (40%) */}
        <div className="w-[40%] shrink-0 h-full overflow-hidden flex flex-col border-r border-border-default">
          {/* Tab switcher — matches Vocabulary Browser */}
          <div className="flex border-b border-border-default bg-surface-base shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors flex-1 justify-center",
                  activeTab === tab.id
                    ? tab.id === "semantic"
                      ? "border-b-2 border-success text-success bg-success/5"
                      : "border-b-2 border-accent text-accent bg-accent/5"
                    : "text-text-muted hover:text-text-secondary hover:bg-surface-overlay",
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search panel content */}
          <div className="flex-1 overflow-y-auto">
            {searchPanel}
          </div>
        </div>

        {/* Right pane: Set Contents (60%) */}
        <div className="flex-1 h-full overflow-hidden flex flex-col">
          {/* Right pane header */}
          <div className="flex items-center justify-between border-b border-border-default bg-surface-base px-4 py-2.5 shrink-0">
            <span className="text-xs font-medium text-accent">
              {t("conceptSets.builder.setContents")}
              {itemCount !== undefined && (
                <span className="ml-1.5 text-text-muted">
                  ({t("conceptSets.builder.concept", { count: itemCount })})
                </span>
              )}
            </span>
          </div>

          {/* Set contents */}
          <div className="flex-1 overflow-y-auto p-4">
            {contentsPanel}
          </div>
        </div>
      </div>
    </div>
  );
}
