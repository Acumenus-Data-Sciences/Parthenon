import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";

export interface SourceTableNodeData {
  tableName: string;
  columnCount: number;
  rowCount: number;
  dimmed?: boolean;
}

function SourceTableNodeComponent({ data }: NodeProps) {
  const { t } = useTranslation("app");
  const d = data as unknown as SourceTableNodeData;
  return (
    <div
      className={`rounded-lg border-2 border-accent bg-surface-overlay px-4 py-3 min-w-[160px] transition-opacity ${
        d.dimmed ? "opacity-50" : "opacity-100"
      }`}
    >
      <div className="text-sm font-semibold text-text-primary truncate">{d.tableName}</div>
      <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
        <span>{t("etl.aqueduct.nodes.sourceCols", { count: d.columnCount })}</span>
        <span>
          {d.rowCount > 0
            ? t("etl.aqueduct.nodes.sourceRows", {
              count: d.rowCount.toLocaleString(),
            })
            : t("etl.aqueduct.nodes.sourceEmpty")}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-accent !border-2 !border-accent hover:!scale-125 transition-transform"
      />
    </div>
  );
}

export const SourceTableNode = memo(SourceTableNodeComponent);
