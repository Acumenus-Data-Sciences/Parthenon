import { useState, useMemo } from "react";
import { ChevronRight, FolderTree, Loader2, Search, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConceptTree } from "../hooks/useConceptTree";
import type { ConceptTreeNode } from "../types/vocabulary";

interface HierarchyBrowserPanelProps {
  mode: "browse";
  onSelectConcept: (id: number) => void;
  selectedConceptId?: number | null;
}

interface BreadcrumbEntry {
  concept_id: number;
  concept_name: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  Condition: "#E5A84B",
  Drug: "#60A5FA",
  Procedure: "#2DD4BF",
  Measurement: "#A855F7",
  Observation: "#F472B6",
  Visit: "#34D399",
};

const DOMAIN_ICONS: Record<string, string> = {
  Condition: "Dx",
  Drug: "Rx",
  Procedure: "Px",
  Measurement: "Mx",
  Observation: "Ox",
  Visit: "Vx",
};

export function HierarchyBrowserPanel({
  onSelectConcept,
  selectedConceptId,
}: HierarchyBrowserPanelProps) {
  const [parentId, setParentId] = useState(0);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([]);
  const [filterText, setFilterText] = useState("");

  const { data: nodes, isLoading } = useConceptTree(parentId);

  const isRootLevel = parentId === 0;

  const sortedAndFilteredNodes = useMemo(() => {
    if (!nodes) return [];
    let filtered = [...nodes];
    if (filterText.trim()) {
      const lower = filterText.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.concept_name.toLowerCase().includes(lower) ||
          String(n.concept_id).includes(lower) ||
          n.vocabulary_id?.toLowerCase().includes(lower) ||
          n.concept_class_id?.toLowerCase().includes(lower),
      );
    }
    return filtered.sort((a, b) => a.concept_name.localeCompare(b.concept_name));
  }, [nodes, filterText]);

  const handleDrillDown = (node: ConceptTreeNode) => {
    setBreadcrumbs((prev) => [
      ...prev,
      { concept_id: node.concept_id, concept_name: node.concept_name },
    ]);
    setParentId(node.concept_id);
    setFilterText("");
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setBreadcrumbs([]);
      setParentId(0);
    } else {
      const entry = breadcrumbs[index];
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
      setParentId(entry.concept_id);
    }
    setFilterText("");
  };

  const handleRowClick = (node: ConceptTreeNode) => {
    // Virtual roots (negative IDs) always drill down — they don't exist in vocab.concept
    if (node.concept_id < 0) {
      handleDrillDown(node);
      return;
    }

    // Nodes with children: drill down into them
    if (node.child_count > 0) {
      handleDrillDown(node);
      return;
    }

    // Leaf nodes: select for detail
    onSelectConcept(node.concept_id);
  };

  const handleInfoClick = (e: React.MouseEvent, node: ConceptTreeNode) => {
    e.stopPropagation();
    // Only open detail for real concepts
    if (node.concept_id > 0) {
      onSelectConcept(node.concept_id);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 border-b border-[#232328] bg-[#0E0E11] px-4 py-2.5 text-xs shrink-0 flex-wrap min-h-[36px]">
        <button
          type="button"
          onClick={() => handleBreadcrumbClick(-1)}
          className={cn(
            "hover:text-[#F0EDE8] transition-colors",
            breadcrumbs.length === 0 ? "text-[#C9A227] font-medium" : "text-[#8A857D]",
          )}
        >
          All Domains
        </button>
        {breadcrumbs.map((bc, i) => (
          <span key={bc.concept_id} className="flex items-center gap-1">
            <ChevronRight size={10} className="text-[#5A5650]" />
            <button
              type="button"
              onClick={() => handleBreadcrumbClick(i)}
              className={cn(
                "hover:text-[#F0EDE8] transition-colors truncate max-w-[200px]",
                i === breadcrumbs.length - 1
                  ? "text-[#C9A227] font-medium"
                  : "text-[#8A857D]",
              )}
              title={bc.concept_name}
            >
              {bc.concept_name}
            </button>
          </span>
        ))}
      </div>

      {/* Inline filter — shown when there are enough items to warrant filtering */}
      {!isLoading && (nodes?.length ?? 0) > 8 && (
        <div className="px-3 py-2 border-b border-[#232328] bg-[#0E0E11] shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A5650]" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={`Filter ${nodes?.length ?? 0} items...`}
              className="w-full rounded-md border border-[#232328] bg-[#1A1A1E] py-1.5 pl-7 pr-7 text-xs text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#C9A227]/50 focus:outline-none focus:ring-1 focus:ring-[#C9A227]/25"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650] hover:text-[#8A857D]"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Item count badge */}
      {!isLoading && sortedAndFilteredNodes.length > 0 && (
        <div className="px-4 py-1.5 border-b border-[#232328] bg-[#0E0E11]/50 shrink-0">
          <span className="text-[10px] text-[#5A5650]">
            {filterText
              ? `${sortedAndFilteredNodes.length} of ${nodes?.length ?? 0} items`
              : `${sortedAndFilteredNodes.length} items`}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-[#8A857D]" />
          </div>
        ) : sortedAndFilteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p className="text-xs text-[#5A5650]">
              {filterText ? "No matching concepts" : "No concepts found"}
            </p>
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText("")}
                className="text-[10px] text-[#C9A227] hover:text-[#E5C84B] transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : isRootLevel ? (
          /* Domain root cards */
          <div className="grid grid-cols-2 gap-2 p-1">
            {sortedAndFilteredNodes.map((node) => {
              const color = DOMAIN_COLORS[node.domain_id] ?? "#8A857D";
              const icon = DOMAIN_ICONS[node.domain_id] ?? "?";
              return (
                <button
                  key={node.concept_id}
                  type="button"
                  onClick={() => handleDrillDown(node)}
                  className="flex flex-col items-start gap-2 rounded-lg border border-[#232328] bg-[#1A1A1E] p-3 text-left transition-all hover:bg-[#232328] hover:border-[#323238] group"
                >
                  <div className="flex items-center gap-2 w-full">
                    <span
                      className="flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {icon}
                    </span>
                    <span className="text-sm font-medium text-[#F0EDE8] truncate flex-1">
                      {node.concept_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] text-[#5A5650]">
                      {node.child_count.toLocaleString()} categories
                    </span>
                    <ChevronRight size={12} className="text-[#5A5650] group-hover:text-[#8A857D] transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Child concept list */
          <div className="space-y-0.5">
            {sortedAndFilteredNodes.map((node) => {
              const isSelected = selectedConceptId === node.concept_id && node.concept_id > 0;
              const hasChildren = node.child_count > 0;
              const color = DOMAIN_COLORS[node.domain_id] ?? "#8A857D";

              return (
                <div
                  key={node.concept_id}
                  className={cn(
                    "w-full flex items-center gap-1 rounded-md transition-colors group cursor-pointer",
                    isSelected
                      ? "bg-[#2DD4BF]/10 border border-[#2DD4BF]/30"
                      : "hover:bg-[#1C1C20] border border-transparent",
                  )}
                  onClick={() => handleRowClick(node)}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
                    {/* Domain color indicator */}
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />

                    {/* Folder / leaf icon */}
                    {hasChildren ? (
                      <FolderTree size={12} className="text-[#8A857D] shrink-0" />
                    ) : (
                      <span className="w-3 shrink-0" />
                    )}

                    {/* Name */}
                    <span className={cn(
                      "text-xs truncate flex-1",
                      isSelected ? "text-[#2DD4BF] font-medium" : "text-[#F0EDE8]",
                    )}>
                      {node.concept_name}
                    </span>

                    {/* Metadata badges */}
                    {node.vocabulary_id && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-[#C9A227]/10 text-[#C9A227]/70 shrink-0 hidden group-hover:inline-flex">
                        {node.vocabulary_id}
                      </span>
                    )}

                    {/* Concept ID (only for real concepts) */}
                    {node.concept_id > 0 && (
                      <span className="text-[9px] text-[#5A5650] font-['IBM_Plex_Mono',monospace] shrink-0">
                        {node.concept_id}
                      </span>
                    )}

                    {/* Child count */}
                    {hasChildren && (
                      <span className="text-[9px] text-[#8A857D] shrink-0">
                        ({node.child_count.toLocaleString()})
                      </span>
                    )}
                  </div>

                  {/* Info button — opens detail panel without drilling down */}
                  {node.concept_id > 0 && hasChildren && (
                    <button
                      type="button"
                      aria-label={`View details for ${node.concept_name}`}
                      onClick={(e) => handleInfoClick(e, node)}
                      className="shrink-0 px-2 py-2 text-[#5A5650] transition-colors hover:text-[#2DD4BF] opacity-0 group-hover:opacity-100"
                      title="View concept details"
                    >
                      <Info size={12} />
                    </button>
                  )}

                  {/* Drill indicator for items with children */}
                  {hasChildren && (
                    <ChevronRight
                      size={10}
                      className="shrink-0 mr-2 text-[#5A5650] group-hover:text-[#8A857D] transition-colors"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
