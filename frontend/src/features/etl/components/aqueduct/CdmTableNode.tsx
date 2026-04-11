import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

const DOMAIN_COLORS: Record<string, string> = {
  Person: "var(--success)",
  Visit: "#3B82F6",
  Condition: "var(--accent)",
  Drug: "var(--primary)",
  Procedure: "#A855F7",
  Measurement: "#8B5CF6",
  Observation: "#F59E0B",
  Device: "#EC4899",
  Death: "#6B7280",
  Cost: "#10B981",
  Location: "#6366F1",
  Vocabulary: "#E5E7EB",
  Cohort: "#78716C",
  Note: "#78716C",
  Specimen: "#A3A3A3",
  Other: "#6B7280",
};

export interface CdmTableNodeData {
  tableName: string;
  domain: string;
  requiredCount: number;
  mappedRequiredCount: number;
  dimmed?: boolean;
}

function CdmTableNodeComponent({ data }: NodeProps) {
  const d = data as unknown as CdmTableNodeData;
  const color = DOMAIN_COLORS[d.domain] ?? DOMAIN_COLORS.Other;
  const unmappedRequired = d.requiredCount - d.mappedRequiredCount;

  return (
    <div
      className={`rounded-lg border-2 px-4 py-3 min-w-[160px] transition-opacity ${
        d.dimmed ? "opacity-50" : "opacity-100"
      }`}
      style={{
        borderColor: color,
        backgroundColor: `${color}10`,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !border-2 hover:!scale-125 transition-transform"
        style={{ backgroundColor: color, borderColor: color }}
      />
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold text-white truncate">{d.tableName}</div>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
          style={{ backgroundColor: `${color}30`, color }}
        >
          {d.domain}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
        <span>req: {d.requiredCount}</span>
        {unmappedRequired > 0 && (
          <span className="text-red-400 font-medium">{unmappedRequired} unmapped</span>
        )}
      </div>
    </div>
  );
}

export const CdmTableNode = memo(CdmTableNodeComponent);
