// frontend/src/features/finngen-workbench/components/OpContainer.tsx
import { useState, type ReactNode } from "react";
import { X, RotateCw, ChevronDown, ChevronRight } from "lucide-react";
import type { OpKind, OpNode } from "../lib/operationTree";

const OP_COLORS: Record<OpKind, string> = {
  UNION: "border-success/40 bg-success/5",
  INTERSECT: "border-info/40 bg-info/5",
  MINUS: "border-warning/40 bg-warning/5",
};

const OP_LABEL_COLORS: Record<OpKind, string> = {
  UNION: "text-success",
  INTERSECT: "text-info",
  MINUS: "text-warning",
};

interface OpContainerProps {
  node: OpNode;
  isRoot: boolean;
  errorCodes: string[];
  onCycleKind: (id: string) => void;
  onRemove: (id: string) => void;
  children: ReactNode;
  toolbar: ReactNode;
}

export function OpContainer({
  node,
  isRoot,
  errorCodes,
  onCycleKind,
  onRemove,
  children,
  toolbar,
}: OpContainerProps) {
  const colorClass = OP_COLORS[node.op];
  const labelColor = OP_LABEL_COLORS[node.op];
  const hasErrors = errorCodes.length > 0;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={[
        "rounded-lg border p-3 space-y-2",
        colorClass,
        hasErrors ? "ring-1 ring-error" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-text-ghost hover:text-text-secondary transition-colors"
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          type="button"
          onClick={() => onCycleKind(node.id)}
          className={[
            "flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold tracking-wider",
            "border border-border-default bg-surface-overlay hover:bg-surface-raised transition-colors",
            labelColor,
          ].join(" ")}
          title="Click to cycle UNION → INTERSECT → MINUS"
        >
          {node.op}
          <RotateCw size={10} />
        </button>
        <span className="text-[10px] text-text-ghost">
          {node.children.length} {node.children.length === 1 ? "child" : "children"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {!collapsed && toolbar}
          {!isRoot && (
            <button
              type="button"
              onClick={() => onRemove(node.id)}
              className="text-text-ghost hover:text-error transition-colors"
              aria-label="Remove op"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      {hasErrors && !collapsed && (
        <p className="text-[10px] text-error">
          {errorCodes.join(", ")}
        </p>
      )}
      {!collapsed && (
        <div className="flex flex-wrap items-center gap-2 border-l-2 border-border-default/50 pl-3">
          {children}
        </div>
      )}
    </div>
  );
}
