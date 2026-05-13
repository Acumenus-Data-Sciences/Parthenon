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

export function AssetMatrixBatchBar<TRow extends { id: string | number }>(
  props: AssetMatrixBatchBarProps<TRow>,
): JSX.Element {
  const { selectedCount, batchActions, selectedRows, onClear } = props;

  return (
    <div className="asset-matrix-batch-bar" role="status" aria-live="polite">
      <span className="asset-matrix-batch-count wb-mono">
        {tAuto("studies.v2.assetMatrix.selectedN")} {selectedCount}
      </span>
      <div className="asset-matrix-batch-actions">
        {batchActions.map((action) => {
          const disabled = action.disabled?.(selectedRows) ?? false;
          return (
            <button
              key={action.id}
              type="button"
              className="btn-ghost"
              onClick={() => action.onClick(selectedRows)}
              disabled={disabled}
            >
              {action.label}
            </button>
          );
        })}
        <button type="button" className="btn-ghost" onClick={onClear}>
          {tAuto("studies.v2.assetMatrix.clear")}
        </button>
      </div>
    </div>
  );
}
