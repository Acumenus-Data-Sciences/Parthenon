import { type ReactNode } from 'react';

interface ConceptSetBuilderLayoutProps {
  searchPanel: ReactNode;
  contentsPanel: ReactNode;
}

export function ConceptSetBuilderLayout({
  searchPanel,
  contentsPanel,
}: ConceptSetBuilderLayoutProps) {
  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-0">
      {/* Left: Vocabulary Search (40%) */}
      <div className="w-2/5 overflow-y-auto border-r border-white/10 p-4">
        {searchPanel}
      </div>

      {/* Right: Set Contents (60%) */}
      <div className="w-3/5 overflow-y-auto p-4">
        {contentsPanel}
      </div>
    </div>
  );
}
