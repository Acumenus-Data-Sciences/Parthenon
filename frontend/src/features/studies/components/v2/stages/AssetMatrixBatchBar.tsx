import { tAuto } from "@/i18n/autoUserFacing";
import type { AssetMatrixBatchAction } from "./AssetMatrix";

// Sticky bottom batch-action bar. Rendered only when selectedRows.length > 0.
// `role="status"` + `aria-live="polite"` announces selection count to
// screen readers.

interface AssetMatrixBatchBarProps<TRow extends { id: string | number }> {
  selectedCount: number;
  batchActions: ReadonlyArray<AssetMatrixBatchAction<TRow>>;
  selectedRows: ReadonlyArray<TRow>;
  onClear: () => void;
}

const GHOST_BUTTON =
  "inline-flex items-center gap-2 rounded-lg border border-border-default px-2.5 py-1.5 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function AssetMatrixBatchBar<TRow extends { id: string | number }>(
  props: AssetMatrixBatchBarProps<TRow>,
): JSX.Element {
  const { selectedCount, batchActions, selectedRows, onClear } = props;

  return (
    <div
      className="sticky bottom-3 mt-2 flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-raised px-4 py-2"
      role="status"
      aria-live="polite"
    >
      <span className="text-xs text-text-muted">
        {tAuto("studies.v2.assetMatrix.selectedN")} {selectedCount}
      </span>
      <div className="flex items-center gap-2">
        {batchActions.map((action) => {
          const disabled = action.disabled?.(selectedRows) ?? false;
          return (
            <button
              key={action.id}
              type="button"
              className={GHOST_BUTTON}
              onClick={() => action.onClick(selectedRows)}
              disabled={disabled}
            >
              {action.label}
            </button>
          );
        })}
        <button type="button" className={GHOST_BUTTON} onClick={onClear}>
          {tAuto("studies.v2.assetMatrix.clear")}
        </button>
      </div>
    </div>
  );
}
