// frontend/src/features/finngen-workbench/components/CohortChip.tsx
import { X } from "lucide-react";
import type { CohortNode } from "../lib/operationTree";

interface CohortChipProps {
  node: CohortNode;
  cohortName?: string;
  onRemove: (id: string) => void;
}

export function CohortChip({ node, cohortName, onRemove }: CohortChipProps) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs">
      <span className="font-mono text-text-ghost">#{node.cohort_id}</span>
      {cohortName !== undefined && (
        <span className="text-text-primary">{cohortName}</span>
      )}
      <button
        type="button"
        onClick={() => onRemove(node.id)}
        className="ml-1 text-text-ghost hover:text-error transition-colors"
        aria-label="Remove cohort"
      >
        <X size={12} />
      </button>
    </div>
  );
}
