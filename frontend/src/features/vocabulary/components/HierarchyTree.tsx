import { useState } from "react";
import { ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConceptHierarchyNode } from "../types/vocabulary";

interface HierarchyTreeProps {
  tree: ConceptHierarchyNode | null;
  isLoading: boolean;
  currentConceptId?: number;
}

interface TreeNodeProps {
  node: ConceptHierarchyNode;
  currentConceptId?: number;
  depth?: number;
}

function TreeNode({ node, currentConceptId, depth = 0 }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(
    node.is_current || depth < 2,
  );
  const hasChildren = node.children && node.children.length > 0;
  const isCurrent = node.concept_id === currentConceptId || node.is_current;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 py-1.5 px-2 rounded-md transition-colors cursor-pointer",
          isCurrent
            ? "bg-[#2DD4BF]/10 border border-[#2DD4BF]/30"
            : "hover:bg-[#1C1C20]",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            type="button"
            className="shrink-0 w-4 h-4 flex items-center justify-center text-[#8A857D]"
          >
            {expanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </button>
        ) : (
          <span className="shrink-0 w-4 h-4 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#323238]" />
          </span>
        )}

        {/* Concept Info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={cn(
              "font-['IBM_Plex_Mono',monospace] text-[10px] tabular-nums shrink-0",
              isCurrent ? "text-[#2DD4BF]" : "text-[#8A857D]",
            )}
          >
            {node.concept_id}
          </span>
          <span
            className={cn(
              "text-xs truncate",
              isCurrent
                ? "text-[#2DD4BF] font-medium"
                : "text-[#F0EDE8]",
            )}
          >
            {node.concept_name}
          </span>
          <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-[#60A5FA]/15 text-[#60A5FA] shrink-0">
            {node.domain_id}
          </span>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.concept_id}
              node={child}
              currentConceptId={currentConceptId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function HierarchyTree({
  tree,
  isLoading,
  currentConceptId,
}: HierarchyTreeProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-[#5A5650]">No hierarchy data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-2 overflow-x-auto">
      <TreeNode node={tree} currentConceptId={currentConceptId} />
    </div>
  );
}
