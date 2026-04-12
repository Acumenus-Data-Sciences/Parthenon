import { type ReactNode } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type SearchTab = 'keyword' | 'semantic';

interface ConceptSetBuilderLayoutProps {
  activeTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  searchPanel: ReactNode;
  contentsPanel: ReactNode;
  itemCount?: number;
}

const tabs: { id: SearchTab; label: string; icon: ReactNode }[] = [
  { id: 'keyword', label: 'Keyword Search', icon: <Search size={13} /> },
  { id: 'semantic', label: 'Semantic Search', icon: <Sparkles size={13} /> },
];

export function ConceptSetBuilderLayout({
  activeTab,
  onTabChange,
  searchPanel,
  contentsPanel,
  itemCount,
}: ConceptSetBuilderLayoutProps) {
  return (
    <div
      className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden"
      style={{ height: 'calc(100vh - 220px)' }}
    >
      <div className="flex h-full">
        {/* Left pane: tab switcher + search panel (40%) */}
        <div className="w-[40%] shrink-0 h-full overflow-hidden flex flex-col border-r border-[#232328]">
          {/* Tab switcher — matches Vocabulary Browser */}
          <div className="flex border-b border-[#232328] bg-[#0E0E11] shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors flex-1 justify-center',
                  activeTab === tab.id
                    ? tab.id === 'semantic'
                      ? 'border-b-2 border-[#2DD4BF] text-[#2DD4BF] bg-[#2DD4BF]/5'
                      : 'border-b-2 border-[#C9A227] text-[#C9A227] bg-[#C9A227]/5'
                    : 'text-[#8A857D] hover:text-[#C5C0B8] hover:bg-[#1C1C20]',
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
          <div className="flex items-center justify-between border-b border-[#232328] bg-[#0E0E11] px-4 py-2.5 shrink-0">
            <span className="text-xs font-medium text-[#C9A227]">
              Set Contents
              {itemCount !== undefined && (
                <span className="ml-1.5 text-[#8A857D]">
                  ({itemCount} {itemCount === 1 ? 'concept' : 'concepts'})
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
