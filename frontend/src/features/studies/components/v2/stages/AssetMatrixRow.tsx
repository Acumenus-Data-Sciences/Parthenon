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
  /** Grid track template shared with the header row. */
  gridTemplateColumns: string;
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

const ROW_ACTION_BASE =
  "inline-flex items-center gap-1.5 rounded-lg border border-border-default px-2.5 py-1.5 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-50";

function toneClasses(tone: AssetMatrixRowAction<{ id: string | number }>["tone"]): string | null {
  if (tone === "teal") return "text-success hover:text-success";
  if (tone === "gold") return "text-warning hover:text-warning";
  return null;
}

function AssetMatrixRowInner<TRow extends { id: string | number }>(
  props: AssetMatrixRowProps<TRow>,
  ref: React.ForwardedRef<HTMLDivElement>,
): JSX.Element {
  const {
    row,
    columns,
    rowActions,
    gridTemplateColumns,
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
      style={{ gridTemplateColumns }}
      className={cn(
        "group grid items-center border-t border-border-default px-2.5 py-2 outline-none transition-colors first:border-t-0 hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
        selected && "bg-accent/5",
      )}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      <span role="gridcell" className="flex items-center justify-center px-0">
        <input
          type="checkbox"
          aria-label={`Select row ${String(row.id)}`}
          className="accent-accent cursor-pointer"
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
            "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap px-2 text-[13px] text-text-primary",
            column.align === "right" && "text-right",
          )}
        >
          {renderCellValue(row, column)}
        </span>
      ))}
      {rowActions.length > 0 ? (
        <span
          role="gridcell"
          className={cn(
            "flex justify-end gap-1.5 px-2 opacity-0 transition-opacity",
            "group-hover:opacity-100 group-focus-within:opacity-100",
            selected && "opacity-100",
          )}
        >
          {rowActions.map((action) => {
            const Icon = action.icon;
            const disabled = action.disabled?.(row) ?? false;
            return (
              <button
                key={action.id}
                type="button"
                className={cn(ROW_ACTION_BASE, toneClasses(action.tone))}
                onClick={(event) => {
                  event.stopPropagation();
                  action.onClick(row);
                }}
                disabled={disabled}
                title={action.label}
                aria-label={action.label}
              >
                {Icon ? <Icon size={12} aria-hidden /> : null}
                <span>{action.label}</span>
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
