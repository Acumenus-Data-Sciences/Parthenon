import { useState } from "react";
import { ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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
            ? "bg-success/10 border border-success/30"
            : "hover:bg-surface-overlay",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            type="button"
            className="shrink-0 w-4 h-4 flex items-center justify-center text-text-muted"
          >
            {expanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </button>
        ) : (
          <span className="shrink-0 w-4 h-4 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-surface-highlight" />
          </span>
        )}

        {/* Concept Info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={cn(
              "font-['IBM_Plex_Mono',monospace] text-[10px] tabular-nums shrink-0",
              isCurrent ? "text-success" : "text-text-muted",
            )}
          >
            {node.concept_id}
          </span>
          <span
            className={cn(
              "text-xs truncate",
              isCurrent
                ? "text-success font-medium"
                : "text-text-primary",
            )}
          >
            {node.concept_name}
          </span>
          <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-info/15 text-info shrink-0">
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
  const { t } = useTranslation("app");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs text-text-ghost">
          {t("vocabulary.hierarchyTree.empty.noData")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-default bg-surface-base p-2 overflow-x-auto">
      <TreeNode node={tree} currentConceptId={currentConceptId} />
    </div>
  );
}
