import { memo } from "react";
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("app");
  const d = (data ?? {}) as unknown as MappingEdgeData;

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
    ? "var(--success)" // teal
    : d.hasUnmappedRequired
      ? "#EF4444" // red
      : "var(--warning)"; // amber

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
            className="text-xs font-semibold px-3 py-1 rounded-full border shadow-lg"
            style={{
              backgroundColor: `${color}30`,
              borderColor: `${color}80`,
              color,
              backdropFilter: "blur(4px)",
            }}
          >
            {t("etl.aqueduct.nodes.edgeFields", {
              mapped: d.mappedFields,
              total: d.totalFields,
            })}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const MappingEdge = memo(MappingEdgeComponent);
