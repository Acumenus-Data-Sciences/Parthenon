import { useState, useEffect, useMemo, useCallback } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronRight, CornerLeftUp } from "lucide-react";
import { formatCompact, CHART, TOOLTIP_CLS } from "./chartUtils";
import type { HierarchyNode } from "../../types/dataExplorer";

// Muted color palette for hierarchy levels — distinct hues, dark-theme safe
const LEVEL_PALETTE = [
  "#2DD4BF", "#C9A227", "#60A5FA", "#A855F7", "#E5A84B",
  "#E85A6B", "#34D399", "#F472B6", "#8B5CF6", "#94A3B8",
  "#6EE7B7", "#FCD34D", "#93C5FD", "#C084FC", "#FCA5A5",
];

function colorForIndex(i: number): string {
  return LEVEL_PALETTE[i % LEVEL_PALETTE.length];
}

interface TreemapCellProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  size: number;
  color: string;
  hasChildren: boolean;
  onCellClick?: (name: string, hasChildren: boolean) => void;
}

function TreemapCell(props: TreemapCellProps) {
  const { x, y, width, height, name, size, color, hasChildren, onCellClick } = props;

  if (width < 8 || height < 8) return null;

  const showLabel = width > 50 && height > 24;
  const showCount = width > 60 && height > 42;

  return (
    <g
      onClick={(e) => { e.stopPropagation(); onCellClick?.(name, hasChildren); }}
      style={{ cursor: hasChildren ? "pointer" : "default" }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.7}
        stroke={CHART.border}
        strokeWidth={1.5}
        rx={3}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showCount ? 7 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0E0E11"
          fontSize={Math.min(12, width / 8)}
          fontWeight={600}
        >
          {name.length > width / 7 ? name.slice(0, Math.floor(width / 7)) + "\u2026" : name}
        </text>
      )}
      {showCount && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 11}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0E0E11"
          fontSize={10}
          fontFamily="'IBM Plex Mono', monospace"
          opacity={0.7}
        >
          {formatCompact(size)}
        </text>
      )}
      {hasChildren && width > 30 && height > 30 && (
        <text
          x={x + width - 12}
          y={y + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0E0E11"
          fontSize={10}
          opacity={0.5}
        >
          +
        </text>
      )}
    </g>
  );
}

function CellTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; size: number; hasChildren: boolean } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={TOOLTIP_CLS}>
      <p className="text-xs font-medium text-[#F0EDE8]">{d.name}</p>
      <p className="mt-0.5 font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
        {d.size.toLocaleString()} records
      </p>
      {d.hasChildren && (
        <p className="mt-0.5 text-[10px] text-[#8A857D]">Click to drill down</p>
      )}
    </div>
  );
}

interface HierarchyTreemapProps {
  data: HierarchyNode[];
  hasHierarchy: boolean;
  domain: string;
}

export function HierarchyTreemap({ data, hasHierarchy, domain }: HierarchyTreemapProps) {
  // Breadcrumb path for drill-down navigation
  const [path, setPath] = useState<string[]>([]);

  // Reset path when domain changes
  useEffect(() => { setPath([]); }, [domain]);

  // Navigate to the current level based on path
  const currentNodes = useMemo(() => {
    let nodes = data;
    for (const segment of path) {
      const found = nodes.find((n) => n.name === segment);
      if (found?.children?.length) {
        nodes = found.children;
      } else {
        break;
      }
    }
    return nodes;
  }, [data, path]);

  // Build recharts-compatible data with colors
  const chartData = useMemo(() => {
    return currentNodes
      .filter((n) => n.count > 0)
      .map((node, i) => ({
        name: node.name,
        size: node.count,
        color: colorForIndex(i),
        hasChildren: (node.children?.length ?? 0) > 0,
      }));
  }, [currentNodes]);

  const handleCellClick = useCallback(
    (name: string, hasChildren: boolean) => {
      if (hasChildren) {
        setPath((prev) => [...prev, name]);
      }
    },
    [],
  );

  const handleBack = useCallback(() => {
    setPath((prev) => prev.slice(0, -1));
  }, []);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-12">
        <p className="text-sm text-[#8A857D]">No hierarchy data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#232328] bg-[#151518] p-6">
      {/* Header with breadcrumbs */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-semibold uppercase tracking-wider text-[#8A857D]">
            {hasHierarchy ? "Classification Hierarchy" : "Top Concepts"}
          </span>
          {path.length > 0 && (
            <>
              {path.map((segment, i) => (
                <span key={i} className="flex items-center gap-1 text-[#C5C0B8]">
                  <ChevronRight size={12} className="text-[#5A5650]" />
                  <button
                    type="button"
                    onClick={() => setPath(path.slice(0, i + 1))}
                    className="hover:text-[#F0EDE8] transition-colors"
                  >
                    {segment.length > 30 ? segment.slice(0, 30) + "\u2026" : segment}
                  </button>
                </span>
              ))}
            </>
          )}
        </div>
        {path.length > 0 && (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#8A857D] hover:bg-[#232328] hover:text-[#C5C0B8] transition-colors"
          >
            <CornerLeftUp size={12} />
            Back
          </button>
        )}
      </div>

      {/* Treemap */}
      <ResponsiveContainer width="100%" height={340}>
        <Treemap
          data={chartData}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke={CHART.border}
          content={
            <TreemapCell
              name=""
              size={0}
              color=""
              hasChildren={false}
              onCellClick={handleCellClick}
              x={0}
              y={0}
              width={0}
              height={0}
            />
          }
        >
          <Tooltip content={<CellTooltip />} />
        </Treemap>
      </ResponsiveContainer>

      {/* Summary table below treemap */}
      <div className="mt-4 max-h-48 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#232328] text-[#8A857D]">
              <th className="pb-1 text-left font-medium">Name</th>
              <th className="pb-1 text-right font-medium">Records</th>
              {hasHierarchy && currentNodes.some((n) => n.children?.length) && (
                <th className="pb-1 text-right font-medium w-8" />
              )}
            </tr>
          </thead>
          <tbody>
            {chartData.map((d) => (
              <tr
                key={d.name}
                className={`border-b border-[#1A1A1E] ${d.hasChildren ? "cursor-pointer hover:bg-[#1A1A1E]" : ""}`}
                onClick={() => handleCellClick(d.name, d.hasChildren)}
              >
                <td className="py-1.5 text-[#C5C0B8]">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="truncate">{d.name}</span>
                  </div>
                </td>
                <td className="py-1.5 text-right font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                  {d.size.toLocaleString()}
                </td>
                {hasHierarchy && currentNodes.some((n) => n.children?.length) && (
                  <td className="py-1.5 text-right">
                    {d.hasChildren && (
                      <ChevronRight size={12} className="text-[#5A5650]" />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
