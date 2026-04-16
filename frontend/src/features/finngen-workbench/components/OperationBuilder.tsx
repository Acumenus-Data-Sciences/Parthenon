// frontend/src/features/finngen-workbench/components/OperationBuilder.tsx
//
// SP4 Phase B.4 — visual operation-tree builder.
// Phase C — Preview button + result panel when sourceKey is provided.
// Polish 1 — CohortPicker typeahead replaces window.prompt.
// Polish 3 — dnd-kit same-parent reordering. Each op container's children
// live in a SortableContext; drag a chip or sub-op to reorder among siblings.
// Cross-parent drag (reparent) is intentionally deferred — use the toolbar.
// Polish 4 — always-visible single-line live expression preview above the
// disclosure pane.
import { useMemo, useState } from "react";
import { Plus, ChevronDown, ChevronRight, Loader2, Eye, GripVertical } from "lucide-react";
import {
  appendChild,
  compile,
  findPathById,
  getNodeAt,
  makeCohort,
  makeOp,
  moveNode,
  removeNode,
  setOpKind,
  validate,
  type OpKind,
  type OperationNode,
  type ValidationError,
} from "../lib/operationTree";
import { usePreviewCounts } from "../hooks/usePreviewCounts";
import { CohortChip } from "./CohortChip";
import { OpContainer } from "./OpContainer";
import { CohortPicker } from "./CohortPicker";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface OperationBuilderProps {
  tree: OperationNode | null;
  onChange: (next: OperationNode | null) => void;
  cohortNames?: Record<number, string>;
  /** When set, exposes the Preview button + result panel. Optional so the
   * builder is still useful in pure-form contexts (e.g. matching subtrees). */
  sourceKey?: string;
}

// Sentinel parent id for "the root, but the tree is empty" — keyed picker UI.
const ROOT_PICK_KEY = "__root__";

const NEXT_OP: Record<OpKind, OpKind> = {
  UNION: "INTERSECT",
  INTERSECT: "MINUS",
  MINUS: "UNION",
};

export function OperationBuilder({ tree, onChange, cohortNames, sourceKey }: OperationBuilderProps) {
  const [expressionOpen, setExpressionOpen] = useState(false);
  // Tracks which container is currently in "picking a cohort" mode. When this
  // matches an op-node id (or ROOT_PICK_KEY for the empty-state root), an
  // inline CohortPicker is rendered next to its toolbar.
  const [pickingForId, setPickingForId] = useState<string | null>(null);
  const preview = usePreviewCounts(sourceKey ?? "");

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

  // Polish 3 — dnd-kit drag end. Only same-parent reorder is supported in v0;
  // cross-parent moves are rejected via findSharedParent returning null, and
  // the toolbar remains the way to reparent.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    if (tree === null) return;
    const { active, over } = event;
    if (over === null || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const activePath = findPathById(tree, activeId);
    const overPath = findPathById(tree, overId);
    if (activePath === null || overPath === null) return;
    if (activePath.length === 0 || overPath.length === 0) return; // can't move root

    // Same parent = same path except last index.
    const activeParentPath = activePath.slice(0, -1);
    const overParentPath = overPath.slice(0, -1);
    const sameParent =
      activeParentPath.length === overParentPath.length &&
      activeParentPath.every((v, i) => v === overParentPath[i]);
    if (!sameParent) return;

    const parent = getNodeAt(tree, activeParentPath);
    if (parent === null || parent.kind !== "op") return;

    const oldIndex = activePath[activePath.length - 1];
    const newIndex = overPath[overPath.length - 1];
    // moveNode preserves identity; arrayMove-style shuffle via remove+insert.
    onChange(moveNode(tree, activeId, parent.id, newIndex));
    // arrayMove is imported but we use moveNode; keep arrayMove import for
    // any sibling-only consumers (currently unused but harmless tree-shake).
    void arrayMove;
    void oldIndex;
  }

  // Polish 1 — cohort entry is now handled by CohortPicker; the legacy
  // tryAddCohortFromInput helper was removed with the raw number input.

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
    const childCohortIds = node.children
      .filter((c) => c.kind === "cohort")
      .map((c) => (c as { cohort_id: number }).cohort_id);
    const childIds = node.children.map((c) => c.id);
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
            onAddCohort={() => setPickingForId(node.id)}
            onAddOp={(op) => addOpToParent(node.id, op)}
          />
        }
      >
        <SortableContext items={childIds} strategy={horizontalListSortingStrategy}>
          {node.children.map((c) => (
            <SortableNode key={c.id} id={c.id}>
              {renderNode(c, false)}
            </SortableNode>
          ))}
        </SortableContext>
        {pickingForId === node.id && (
          <div className="w-full pt-1">
            <CohortPicker
              value={null}
              excludeIds={childCohortIds}
              onChange={(id) => {
                if (id !== null) addCohortToParent(node.id, id);
                setPickingForId(null);
              }}
              placeholder="add cohort by name or id…"
            />
          </div>
        )}
      </OpContainer>
    );
  }

  return (
    <div className="space-y-3">
      {tree === null ? (
        <EmptyState
          isPicking={pickingForId === ROOT_PICK_KEY}
          startPicking={() => setPickingForId(ROOT_PICK_KEY)}
          onAddCohort={(id) => {
            addCohortToParent(null, id);
            setPickingForId(null);
          }}
          cancelPicking={() => setPickingForId(null)}
          onAddOp={(op) => addOpToParent(null, op)}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {renderNode(tree, true)}
        </DndContext>
      )}

      {/* Polish 4 — always-visible single-line live preview of the compiled
          expression. The full disclosure below remains for the "expanded"
          pane view + the validation-error count badge. */}
      {tree !== null && (
        <div className="flex items-baseline gap-2 px-3 py-1 text-[10px] text-text-ghost">
          <span className="uppercase tracking-wide">Expression:</span>
          <span
            className={[
              "font-mono truncate",
              errors.length > 0 ? "text-error" : "text-text-secondary",
            ].join(" ")}
            title={expression}
          >
            {expression || "(empty)"}
          </span>
        </div>
      )}

      <ExpressionDisclosure
        open={expressionOpen}
        onToggle={() => setExpressionOpen((o) => !o)}
        expression={expression}
        errorCount={errors.length}
      />

      {sourceKey !== undefined && (
        <PreviewPanel
          disabled={tree === null || errors.length > 0 || preview.isPending}
          loading={preview.isPending}
          onPreview={() => {
            if (tree === null) return;
            preview.mutate({ tree });
          }}
          result={preview.data}
          error={preview.error}
        />
      )}
    </div>
  );
}

// Polish 3 — Sortable wrapper. Each sibling under an op container gets a
// small drag handle (GripVertical) and a translate/opacity style while
// dragging. Keeps the chip/container content identical — we only add a
// flex row with the handle on the left.
function SortableNode({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="inline-flex items-center gap-1">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-text-ghost hover:text-text-secondary active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={10} />
      </button>
      {children}
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
  isPicking,
  startPicking,
  onAddCohort,
  cancelPicking,
  onAddOp,
}: {
  isPicking: boolean;
  startPicking: () => void;
  onAddCohort: (id: number) => void;
  cancelPicking: () => void;
  onAddOp: (op: OpKind) => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border-default p-6 text-center space-y-3">
      <p className="text-xs text-text-ghost">Empty operation tree. Start by adding a cohort or an operation.</p>
      {isPicking ? (
        <div className="mx-auto flex max-w-sm items-center gap-2">
          <div className="flex-1">
            <CohortPicker
              value={null}
              onChange={(id) => {
                if (id !== null) onAddCohort(id);
                else cancelPicking();
              }}
              placeholder="search cohorts to add…"
            />
          </div>
          <button
            type="button"
            onClick={cancelPicking}
            className="rounded border border-border-default bg-surface-overlay px-2 py-1 text-[10px] text-text-ghost hover:text-text-secondary"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={startPicking}
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
      )}
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

// SP4 Phase C — preview panel
function PreviewPanel({
  disabled,
  loading,
  onPreview,
  result,
  error,
}: {
  disabled: boolean;
  loading: boolean;
  onPreview: () => void;
  result: import("../api").PreviewCountsResponse | undefined;
  error: import("../hooks/usePreviewCounts").PreviewError | null;
}) {
  return (
    <div className="rounded border border-border-default bg-surface-raised">
      <div className="flex items-center gap-2 border-b border-border-default px-3 py-2">
        <button
          type="button"
          onClick={onPreview}
          disabled={disabled}
          className={[
            "flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
            disabled
              ? "bg-surface-overlay text-text-ghost cursor-not-allowed"
              : "bg-success text-bg-canvas hover:bg-success/90",
          ].join(" ")}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
          Preview row count
        </button>
        {result !== undefined && !loading && (
          <span className="text-[10px] text-text-ghost">
            (last preview: {result.total.toLocaleString()} subjects)
          </span>
        )}
      </div>
      <div className="px-3 py-2 text-xs space-y-1">
        {result !== undefined && !loading && error === null && (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-success">
                {result.total.toLocaleString()}
              </span>
              <span className="text-text-ghost">subjects</span>
            </div>
            <div className="text-[10px] text-text-ghost">
              <span className="font-mono text-text-secondary">{result.operation_string}</span>
              <span className="ml-2">— references {result.cohort_ids.length} cohort{result.cohort_ids.length === 1 ? "" : "s"}</span>
            </div>
          </>
        )}
        {error !== null && (
          <div className="space-y-1 text-error">
            <div className="font-medium">{error.message}</div>
            {error.kind === "validation" && error.validation && (
              <ul className="list-disc pl-4 text-[10px]">
                {error.validation.map((v, i) => (
                  <li key={i}>
                    <span className="font-mono">{v.code}</span> @ {v.node_id}: {v.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {result === undefined && error === null && !loading && (
          <p className="text-[10px] text-text-ghost">
            Click Preview to compute the row count for this tree.
          </p>
        )}
      </div>
    </div>
  );
}
