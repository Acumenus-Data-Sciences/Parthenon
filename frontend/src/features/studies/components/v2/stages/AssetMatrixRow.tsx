import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import type {
  AssetMatrixColumn,
  AssetMatrixRowAction,
} from "./AssetMatrix";

// Single row in the AssetMatrix. Holds:
//   - leading checkbox cell
//   - one cell per column (using column.render or row[column.key])
//   - trailing actions toolbar (revealed on hover / when selected)
//
// The row is focusable so AssetMatrix arrow-key navigation works.

interface AssetMatrixRowProps<TRow extends { id: string | number }> {
  row: TRow;
  columns: ReadonlyArray<AssetMatrixColumn<TRow>>;
  rowActions: ReadonlyArray<AssetMatrixRowAction<TRow>>;
  selected: boolean;
  focused: boolean;
  onToggleSelected: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
}

function renderCellValue<TRow extends { id: string | number }>(
  row: TRow,
  column: AssetMatrixColumn<TRow>,
): React.ReactNode {
  if (column.render) return column.render(row);
  const raw = (row as Record<string, unknown>)[column.key];
  if (raw == null) return "—";
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return String(raw);
  }
  return "—";
}

function AssetMatrixRowInner<TRow extends { id: string | number }>(
  props: AssetMatrixRowProps<TRow>,
  ref: React.ForwardedRef<HTMLDivElement>,
): JSX.Element {
  const {
    row,
    columns,
    rowActions,
    selected,
    focused,
    onToggleSelected,
    onKeyDown,
    onFocus,
  } = props;

  return (
    <div
      role="row"
      ref={ref}
      tabIndex={focused ? 0 : -1}
      aria-selected={selected ? true : undefined}
      className={cn("asset-matrix-row", selected && "selected")}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      <span role="gridcell" className="asset-matrix-cell asset-matrix-cell-check">
        <input
          type="checkbox"
          aria-label={`Select row ${String(row.id)}`}
          checked={selected}
          onChange={onToggleSelected}
          onClick={(event) => event.stopPropagation()}
        />
      </span>
      {columns.map((column) => (
        <span
          key={column.key}
          role="gridcell"
          className={cn(
            "asset-matrix-cell",
            column.align === "right" && "align-right",
          )}
          style={column.width ? { width: column.width } : undefined}
        >
          {renderCellValue(row, column)}
        </span>
      ))}
      {rowActions.length > 0 ? (
        <span role="gridcell" className="asset-matrix-cell row-actions">
          {rowActions.map((action) => {
            const Icon = action.icon;
            const disabled = action.disabled?.(row) ?? false;
            const toneClass = action.tone && action.tone !== "default" ? `tone-${action.tone}` : null;
            return (
              <button
                key={action.id}
                type="button"
                className={cn("row-action", toneClass)}
                onClick={(event) => {
                  event.stopPropagation();
                  action.onClick(row);
                }}
                disabled={disabled}
                title={action.label}
                aria-label={action.label}
              >
                {Icon ? <Icon size={12} aria-hidden /> : null}
                <span className="row-action-label">{action.label}</span>
              </button>
            );
          })}
        </span>
      ) : null}
    </div>
  );
}

// forwardRef needs a manual cast to preserve the generic. This pattern is
// stable in React 18/19 and is the same approach React's own Table-like
// libraries use (React-Aria, TanStack Table).
export const AssetMatrixRow = forwardRef(AssetMatrixRowInner) as <
  TRow extends { id: string | number },
>(
  props: AssetMatrixRowProps<TRow> & { ref?: React.ForwardedRef<HTMLDivElement> },
) => JSX.Element;
