import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface StemTableNodeData {
  tableName: string;
  columnCount: number;
  routingRules: number;
}

function StemTableNodeComponent({ data }: NodeProps) {
  const d = data as unknown as StemTableNodeData;
  return (
    <div className="rounded-lg border-2 border-dashed border-[#A855F7] bg-surface-overlay px-4 py-3 min-w-[180px]">
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-[#A855F7] !border-[#A855F7]" />
      <div className="text-sm font-semibold text-domain-observation">Stem Table</div>
      <div className="text-xs text-gray-400 mt-1">
        {d.columnCount} columns &bull; {d.routingRules} domain routes
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-[#A855F7] !border-[#A855F7]" />
    </div>
  );
}

export const StemTableNode = memo(StemTableNodeComponent);
