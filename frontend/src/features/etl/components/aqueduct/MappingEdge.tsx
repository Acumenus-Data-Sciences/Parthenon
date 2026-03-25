import { memo } from "react";
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";

export interface MappingEdgeData {
  mappedFields: number;
  totalFields: number;
  hasUnmappedRequired: boolean;
  isComplete: boolean;
  isAiSuggested: boolean;
  isReviewed: boolean;
  onClick: () => void;
}

function MappingEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
}: EdgeProps) {
  const d = (data ?? {}) as MappingEdgeData;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Color by status
  const color = d.isComplete
    ? "#2DD4BF" // teal
    : d.hasUnmappedRequired
      ? "#EF4444" // red
      : "#F59E0B"; // amber

  const isDashed = d.isAiSuggested && !d.isReviewed;

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: isDashed ? "6 4" : undefined,
          cursor: "pointer",
        }}
        onClick={(e) => {
          e.stopPropagation();
          d.onClick?.();
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan cursor-pointer"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          onClick={(e) => {
            e.stopPropagation();
            d.onClick?.();
          }}
        >
          <div
            className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
            style={{
              backgroundColor: `${color}20`,
              borderColor: `${color}60`,
              color,
            }}
          >
            {d.mappedFields}/{d.totalFields} fields
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const MappingEdge = memo(MappingEdgeComponent);
