import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface SourceTableNodeData {
  tableName: string;
  columnCount: number;
  rowCount: number;
  dimmed?: boolean;
}

function SourceTableNodeComponent({ data }: NodeProps) {
  const d = data as unknown as SourceTableNodeData;
  return (
    <div
      className={`rounded-lg border-2 border-[#C9A227] bg-[#1e1a14] px-4 py-3 min-w-[160px] transition-opacity ${
        d.dimmed ? "opacity-30" : "opacity-100"
      }`}
    >
      <div className="text-sm font-semibold text-white truncate">{d.tableName}</div>
      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
        <span>{d.columnCount} cols</span>
        <span>{d.rowCount > 0 ? d.rowCount.toLocaleString() + " rows" : "empty"}</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-[#C9A227] !border-[#C9A227]"
      />
    </div>
  );
}

export const SourceTableNode = memo(SourceTableNodeComponent);
