import { useCallback, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { tAuto } from "@/i18n/autoUserFacing";
import { AssetMatrixRow } from "./AssetMatrixRow";
import { AssetMatrixBatchBar } from "./AssetMatrixBatchBar";

// Generic table for asset state machines — used by Phenotypes (02),
// Concept Sets (03), and Analyses (06). Behavior:
//
//   - leading checkbox column; selection is component-local state
//   - row-action toolbar revealed on hover or when row selected
//   - sticky batch-action bar at the bottom when any row is selected
//   - empty state replaces the body when rows.length === 0
//   - keyboard: arrow keys move focus, space toggles selection,
//     Enter triggers the row's first non-disabled rowAction
//   - a11y: role="grid", scope="col" headers, aria-selected on rows,
//     status/aria-live on batch bar
//
// Spec: docs/lineage/design/specs/2026-05-12-studies-design-workbench-redesign.md

export interface AssetMatrixColumn<TRow> {
  key: string;
  label: string;
  /** Width hint — 'auto', '100px', '1fr', etc. */
  width?: string;
  /** Right-aligned columns for counts/dates. */
  align?: "left" | "right";
  /** Cell renderer; defaults to (row) => String(row[key]). */
  render?: (row: TRow) => React.ReactNode;
}

export interface AssetMatrixRowAction<TRow> {
  id: string;
  label: string;
  /** Lucide icon name; rendered if provided. */
  icon?: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  /** Disabled when this returns true. */
  disabled?: (row: TRow) => boolean;
  /** Click handler. */
  onClick: (row: TRow) => void;
  /** Optional tone: 'default' | 'gold' | 'teal'. */
  tone?: "default" | "gold" | "teal";
}

export interface AssetMatrixBatchAction<TRow> {
  id: string;
  label: string;
  disabled?: (rows: ReadonlyArray<TRow>) => boolean;
  onClick: (rows: ReadonlyArray<TRow>) => void;
}

export interface AssetMatrixHeaderAction {
  id: string;
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ size?: number }>;
  disabled?: boolean;
  title?: string;
}

export interface AssetMatrixEmptyState {
  title: string;
  description: string;
  cta?: { label: string; onClick: () => void; disabled?: boolean; title?: string };
}

export interface AssetMatrixProps<TRow extends { id: string | number }> {
  /** Stage eyebrow (legacy). No longer rendered — the wizard stepper labels the step. */
  stageLabel: string;
  /** Count summary, e.g. "Concept Sets — 4 drafts, 3 materialized". Rendered small + muted. */
  title: string;
  columns: ReadonlyArray<AssetMatrixColumn<TRow>>;
  rows: ReadonlyArray<TRow>;
  rowActions?: ReadonlyArray<AssetMatrixRowAction<TRow>>;
  batchActions?: ReadonlyArray<AssetMatrixBatchAction<TRow>>;
  /** When the table is empty. */
  emptyState: AssetMatrixEmptyState;
  /** Page-level header buttons (eg. "Draft from intent"). */
  headerActions?: ReadonlyArray<AssetMatrixHeaderAction>;
  isLoading?: boolean;
}

const GHOST_BUTTON =
  "inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-medium text-text-muted hover:text-text-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function AssetMatrix<TRow extends { id: string | number }>(
  props: AssetMatrixProps<TRow>,
): JSX.Element {
  const {
    title,
    columns,
    rows,
    rowActions = [],
    batchActions = [],
    emptyState,
    headerActions = [],
    isLoading = false,
  } = props;

  const [selectedIds, setSelectedIds] = useState<ReadonlyArray<string | number>>([]);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Build the grid track template: leading checkbox col (auto), one col per
  // column width hint (falling back to minmax(0, 1fr)), trailing actions col.
  const gridTemplateColumns = useMemo(() => {
    const dataCols = columns
      .map((column) => column.width ?? "minmax(0, 1fr)")
      .join(" ");
    const actionsCol = rowActions.length > 0 ? " auto" : "";
    return `auto ${dataCols}${actionsCol}`;
  }, [columns, rowActions.length]);

  // Map current row ids → selected status for fast lookup.
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedSet.has(row.id)),
    [rows, selectedSet],
  );

  // Keep selection set tight to rows that still exist (rows can change as
  // mutations resolve and parents re-render).
  const visibleIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const visibleIdSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  if (selectedIds.some((id) => !visibleIdSet.has(id))) {
    // Schedule a state update to drop stale ids; safe because the next
    // commit re-runs this hook with consistent state. We do it inline
    // (no effect) to avoid a flash where stale rows look selected.
    setSelectedIds((prev) => prev.filter((id) => visibleIdSet.has(id)));
  }

  const toggleRow = useCallback((id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => (prev.length === rows.length ? [] : rows.map((row) => row.id)));
  }, [rows]);

  const focusRowAt = useCallback((index: number) => {
    const target = rowRefs.current[index];
    if (target) {
      target.focus();
      setFocusedIndex(index);
    }
  }, []);

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRowAt(Math.min(rows.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRowAt(Math.max(0, index - 1));
    } else if (event.key === " ") {
      event.preventDefault();
      toggleRow(rows[index].id);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[index];
      const primary = rowActions.find((action) => !action.disabled?.(row));
      if (primary) primary.onClick(row);
    }
  };

  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const someSelected = selectedIds.length > 0 && !allSelected;
  const showBatchBar = selectedRows.length > 0 && batchActions.length > 0;

  return (
    <div className="flex flex-col gap-3 pb-16">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border-default pb-3">
        <p className="text-xs text-text-muted">{title}</p>
        {headerActions.length > 0 ? (
          <div className="flex items-center gap-2">
            {headerActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  className={cn(GHOST_BUTTON, "px-2.5 py-1.5 text-xs")}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  title={action.title}
                >
                  {Icon ? <Icon size={12} /> : null}
                  {action.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {isLoading ? (
        <div
          className="flex items-center justify-center gap-2 py-9 text-xs text-text-muted"
          role="status"
        >
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          <span>{tAuto("studies.v2.assetMatrix.loading")}</span>
        </div>
      ) : rows.length === 0 ? (
        <AssetMatrixEmpty state={emptyState} />
      ) : (
        <div
          role="grid"
          aria-label={title}
          aria-rowcount={rows.length + 1}
          aria-colcount={columns.length + 2}
          className="flex flex-col overflow-hidden rounded-lg border border-border-default bg-surface-base"
        >
          <div
            role="row"
            className="grid items-center border-b border-border-default bg-surface-elevated px-2.5 py-2"
            style={{ gridTemplateColumns }}
          >
            <span role="columnheader" className="flex items-center justify-center px-0">
              <input
                type="checkbox"
                aria-label={tAuto("studies.v2.assetMatrix.selectAll")}
                className="accent-accent cursor-pointer"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleAll}
              />
            </span>
            {columns.map((column) => (
              <span
                key={column.key}
                role="columnheader"
                className={cn(
                  "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap px-2 text-[11px] font-medium uppercase tracking-wide text-text-muted",
                  column.align === "right" && "text-right",
                )}
              >
                {column.label}
              </span>
            ))}
            {rowActions.length > 0 ? (
              <span
                role="columnheader"
                className="px-2 text-right text-[11px] font-medium uppercase tracking-wide text-text-muted"
              >
                {tAuto("studies.v2.assetMatrix.actions")}
              </span>
            ) : null}
          </div>

          {rows.map((row, index) => (
            <AssetMatrixRow
              key={row.id}
              ref={(el) => {
                rowRefs.current[index] = el;
              }}
              row={row}
              columns={columns}
              rowActions={rowActions}
              gridTemplateColumns={gridTemplateColumns}
              selected={selectedSet.has(row.id)}
              focused={index === focusedIndex}
              onToggleSelected={() => toggleRow(row.id)}
              onKeyDown={(event) => handleRowKeyDown(event, index)}
              onFocus={() => setFocusedIndex(index)}
            />
          ))}
        </div>
      )}

      {showBatchBar ? (
        <AssetMatrixBatchBar
          selectedCount={selectedRows.length}
          batchActions={batchActions}
          selectedRows={selectedRows}
          onClear={clearSelection}
        />
      ) : null}
    </div>
  );
}

function AssetMatrixEmpty({ state }: { state: AssetMatrixEmptyState }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-3 py-7 text-center">
      <p className="text-sm font-semibold text-text-primary">{state.title}</p>
      <p className="max-w-[480px] text-xs text-text-muted">{state.description}</p>
      {state.cta ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface-base transition-colors hover:bg-accent-light disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-text-ghost"
          onClick={state.cta.onClick}
          disabled={state.cta.disabled}
          title={state.cta.title}
        >
          {state.cta.label}
        </button>
      ) : null}
    </div>
  );
}
