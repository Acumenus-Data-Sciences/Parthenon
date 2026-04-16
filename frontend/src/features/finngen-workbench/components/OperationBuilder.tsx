// frontend/src/features/finngen-workbench/components/OperationBuilder.tsx
//
// SP4 Phase B.4 — visual operation-tree builder. v0 ships with click-based
// controls (add cohort/op, cycle op kind, remove); drag-and-drop reordering
// is a polish follow-up that will plug into the same store mutators.
import { useMemo, useState } from "react";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import {
  appendChild,
  compile,
  findPathById,
  makeCohort,
  makeOp,
  removeNode,
  setOpKind,
  validate,
  type OpKind,
  type OperationNode,
  type ValidationError,
} from "../lib/operationTree";
import { CohortChip } from "./CohortChip";
import { OpContainer } from "./OpContainer";

interface OperationBuilderProps {
  tree: OperationNode | null;
  onChange: (next: OperationNode | null) => void;
  cohortNames?: Record<number, string>;
}

const NEXT_OP: Record<OpKind, OpKind> = {
  UNION: "INTERSECT",
  INTERSECT: "MINUS",
  MINUS: "UNION",
};

export function OperationBuilder({ tree, onChange, cohortNames }: OperationBuilderProps) {
  const [expressionOpen, setExpressionOpen] = useState(false);
  const [pendingCohortId, setPendingCohortId] = useState("");

  const errors = useMemo(() => validate(tree), [tree]);
  const errorsByNode = useMemo(() => {
    const m = new Map<string, ValidationError[]>();
    for (const e of errors) {
      const list = m.get(e.node_id) ?? [];
      list.push(e);
      m.set(e.node_id, list);
    }
    return m;
  }, [errors]);

  const expression = useMemo(() => {
    if (tree === null) return "";
    if (errors.length > 0) return "(invalid tree)";
    try {
      return compile(tree);
    } catch {
      return "(invalid tree)";
    }
  }, [tree, errors]);

  function addCohortToParent(parentId: string | null, cohortId: number) {
    const cohort = makeCohort(cohortId);
    if (tree === null) {
      onChange(cohort);
      return;
    }
    const parentPath = parentId === null ? [] : findPathById(tree, parentId);
    if (parentPath === null) return;
    onChange(appendChild(tree, parentPath, cohort));
  }

  function addOpToParent(parentId: string | null, op: OpKind) {
    const opNode = makeOp(op, []);
    if (tree === null) {
      onChange(opNode);
      return;
    }
    const parentPath = parentId === null ? [] : findPathById(tree, parentId);
    if (parentPath === null) return;
    onChange(appendChild(tree, parentPath, opNode));
  }

  function handleRemove(id: string) {
    if (tree === null) return;
    if (tree.id === id) {
      onChange(null);
      return;
    }
    onChange(removeNode(tree, id));
  }

  function handleCycleKind(id: string) {
    if (tree === null) return;
    const path = findPathById(tree, id);
    if (path === null) return;
    const node = path.length === 0 ? tree : null;
    const targetOp = node?.kind === "op" ? NEXT_OP[node.op] : null;
    if (targetOp !== null) {
      onChange(setOpKind(tree, id, targetOp));
      return;
    }
    // Walk to the node to read its current kind (path-based).
    let cur: OperationNode = tree;
    for (const idx of path) {
      if (cur.kind !== "op") return;
      cur = cur.children[idx];
    }
    if (cur.kind !== "op") return;
    onChange(setOpKind(tree, id, NEXT_OP[cur.op]));
  }

  function tryAddCohortFromInput(parentId: string | null) {
    const cid = parseInt(pendingCohortId, 10);
    if (!Number.isFinite(cid) || cid <= 0) return;
    addCohortToParent(parentId, cid);
    setPendingCohortId("");
  }

  function renderNode(node: OperationNode, isRoot: boolean): JSX.Element {
    if (node.kind === "cohort") {
      return (
        <CohortChip
          key={node.id}
          node={node}
          cohortName={cohortNames?.[node.cohort_id]}
          onRemove={handleRemove}
        />
      );
    }
    const childCodes = (errorsByNode.get(node.id) ?? []).map((e) => e.code);
    return (
      <OpContainer
        key={node.id}
        node={node}
        isRoot={isRoot}
        errorCodes={childCodes}
        onCycleKind={handleCycleKind}
        onRemove={handleRemove}
        toolbar={
          <NodeToolbar
            onAddCohort={() => {
              const cid = window.prompt("Cohort ID to add?");
              if (cid === null) return;
              const n = parseInt(cid, 10);
              if (Number.isFinite(n) && n > 0) addCohortToParent(node.id, n);
            }}
            onAddOp={(op) => addOpToParent(node.id, op)}
          />
        }
      >
        {node.children.map((c) => renderNode(c, false))}
      </OpContainer>
    );
  }

  return (
    <div className="space-y-3">
      {tree === null ? (
        <EmptyState
          pendingCohortId={pendingCohortId}
          setPendingCohortId={setPendingCohortId}
          onAddCohort={() => tryAddCohortFromInput(null)}
          onAddOp={(op) => addOpToParent(null, op)}
        />
      ) : (
        renderNode(tree, true)
      )}

      <ExpressionDisclosure
        open={expressionOpen}
        onToggle={() => setExpressionOpen((o) => !o)}
        expression={expression}
        errorCount={errors.length}
      />
    </div>
  );
}

function NodeToolbar({
  onAddCohort,
  onAddOp,
}: {
  onAddCohort: () => void;
  onAddOp: (op: OpKind) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <ToolbarButton onClick={onAddCohort} label="+ cohort" />
      <ToolbarButton onClick={() => onAddOp("UNION")} label="+ ∪" tone="success" />
      <ToolbarButton onClick={() => onAddOp("INTERSECT")} label="+ ∩" tone="info" />
      <ToolbarButton onClick={() => onAddOp("MINUS")} label="+ ∖" tone="warning" />
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  tone,
}: {
  onClick: () => void;
  label: string;
  tone?: "success" | "info" | "warning";
}) {
  const toneClass =
    tone === "success" ? "text-success hover:bg-success/10" :
    tone === "info" ? "text-info hover:bg-info/10" :
    tone === "warning" ? "text-warning hover:bg-warning/10" :
    "text-text-ghost hover:bg-surface-raised";
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors border border-border-default bg-surface-overlay",
        toneClass,
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function EmptyState({
  pendingCohortId,
  setPendingCohortId,
  onAddCohort,
  onAddOp,
}: {
  pendingCohortId: string;
  setPendingCohortId: (s: string) => void;
  onAddCohort: () => void;
  onAddOp: (op: OpKind) => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border-default p-6 text-center space-y-3">
      <p className="text-xs text-text-ghost">Empty operation tree. Start by adding a cohort or an operation.</p>
      <div className="flex items-center justify-center gap-2">
        <input
          type="number"
          value={pendingCohortId}
          onChange={(e) => setPendingCohortId(e.target.value)}
          placeholder="cohort id"
          className="w-24 rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={onAddCohort}
          className="flex items-center gap-1 rounded bg-success px-2 py-1 text-[10px] font-medium text-bg-canvas hover:bg-success/90 transition-colors"
        >
          <Plus size={10} /> cohort
        </button>
        <span className="text-text-ghost text-xs">or</span>
        {(["UNION", "INTERSECT", "MINUS"] as OpKind[]).map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => onAddOp(op)}
            className="rounded border border-border-default bg-surface-overlay px-2 py-1 text-[10px] font-medium text-text-secondary hover:bg-surface-raised transition-colors"
          >
            {op}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExpressionDisclosure({
  open,
  onToggle,
  expression,
  errorCount,
}: {
  open: boolean;
  onToggle: () => void;
  expression: string;
  errorCount: number;
}) {
  return (
    <div className="rounded border border-border-default bg-surface-raised">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-overlay transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>Show as expression</span>
        {errorCount > 0 && (
          <span className="ml-auto text-[10px] text-error">{errorCount} validation error{errorCount === 1 ? "" : "s"}</span>
        )}
      </button>
      {open && (
        <pre className="border-t border-border-default px-3 py-2 font-mono text-xs text-text-primary">
          {expression || "(empty)"}
        </pre>
      )}
    </div>
  );
}
