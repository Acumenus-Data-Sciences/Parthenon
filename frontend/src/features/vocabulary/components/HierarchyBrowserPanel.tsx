import { useState, useMemo } from "react";
import { ChevronRight, FolderTree, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConceptTree } from "../hooks/useConceptTree";
import type { ConceptTreeNode } from "../types/vocabulary";

interface HierarchyBrowserPanelProps {
  mode: "browse";
  onSelectConcept: (id: number) => void;
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

export function HierarchyBrowserPanel({
  onSelectConcept,
}: HierarchyBrowserPanelProps) {
  const [parentId, setParentId] = useState(0);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([]);

  const { data: nodes, isLoading } = useConceptTree(parentId);

  const sortedNodes = useMemo(() => {
    if (!nodes) return [];
    return [...nodes].sort((a, b) => a.concept_name.localeCompare(b.concept_name));
  }, [nodes]);

  const handleDrillDown = (node: ConceptTreeNode) => {
    if (node.child_count > 0) {
      setBreadcrumbs((prev) => [
        ...prev,
        { concept_id: node.concept_id, concept_name: node.concept_name },
      ]);
      setParentId(node.concept_id);
    } else {
      onSelectConcept(node.concept_id);
    }
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
  };

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 border-b border-[#232328] bg-[#0E0E11] px-4 py-2.5 text-xs shrink-0 flex-wrap">
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-[#8A857D]" />
          </div>
        ) : sortedNodes.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-[#5A5650]">No concepts found</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sortedNodes.map((node) => (
              <button
                key={node.concept_id}
                type="button"
                onClick={() => handleDrillDown(node)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#1C1C20] transition-colors text-left group"
              >
                {/* Domain color indicator */}
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: DOMAIN_COLORS[node.domain_id] ?? "#8A857D",
                  }}
                />

                {/* Icon */}
                {node.child_count > 0 ? (
                  <FolderTree size={12} className="text-[#8A857D] shrink-0" />
                ) : (
                  <span className="w-3 shrink-0" />
                )}

                {/* Name */}
                <span className="text-xs text-[#F0EDE8] truncate flex-1">
                  {node.concept_name}
                </span>

                {/* Metadata */}
                <span className="text-[9px] text-[#5A5650] font-['IBM_Plex_Mono',monospace] shrink-0">
                  {node.concept_id}
                </span>

                {node.child_count > 0 && (
                  <span className="text-[9px] text-[#8A857D] shrink-0">
                    ({node.child_count})
                  </span>
                )}

                {node.child_count > 0 && (
                  <ChevronRight
                    size={10}
                    className="text-[#5A5650] group-hover:text-[#8A857D] shrink-0"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
