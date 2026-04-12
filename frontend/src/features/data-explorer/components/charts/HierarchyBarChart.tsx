import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronRight, CornerLeftUp } from "lucide-react";
import { formatCompact, CHART } from "./chartUtils";
import type { HierarchyNode } from "../../types/dataExplorer";

const LEVEL_PALETTE = [
  "#2DD4BF", "#C9A227", "#60A5FA", "#A855F7", "#E5A84B",
  "#E85A6B", "#34D399", "#F472B6", "#8B5CF6", "#94A3B8",
  "#6EE7B7", "#FCD34D", "#93C5FD", "#C084FC", "#FCA5A5",
];

function colorForIndex(i: number): string {
  return LEVEL_PALETTE[i % LEVEL_PALETTE.length];
}

interface HierarchyBarChartProps {
  data: HierarchyNode[];
  hasHierarchy: boolean;
  domain: string;
}

export function HierarchyBarChart({ data, hasHierarchy, domain }: HierarchyBarChartProps) {
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

  // Build display data sorted by count
  const chartData = useMemo(() => {
    return currentNodes
      .filter((n) => n.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((node, i) => ({
        name: node.name,
        size: node.count,
        color: colorForIndex(i),
        hasChildren: (node.children?.length ?? 0) > 0,
      }));
  }, [currentNodes]);

  const total = useMemo(() => chartData.reduce((s, d) => s + d.size, 0), [chartData]);
  const max = chartData[0]?.size ?? 1;

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
                    className="transition-colors hover:text-[#F0EDE8]"
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
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#8A857D] transition-colors hover:bg-[#232328] hover:text-[#C5C0B8]"
          >
            <CornerLeftUp size={12} />
            Back
          </button>
        )}
      </div>

      {/* Bar chart */}
      <div className="max-h-[400px] space-y-1.5 overflow-y-auto">
        {chartData.map((d) => {
          const pct = total > 0 ? (d.size / total) * 100 : 0;
          const barWidth = (d.size / max) * 100;

          return (
            <div
              key={d.name}
              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#1A1A1E]"
              onClick={() => handleCellClick(d.name, d.hasChildren)}
              style={{ cursor: d.hasChildren ? "pointer" : "default" }}
              role={d.hasChildren ? "button" : undefined}
              tabIndex={d.hasChildren ? 0 : undefined}
              onKeyDown={
                d.hasChildren
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ")
                        handleCellClick(d.name, d.hasChildren);
                    }
                  : undefined
              }
            >
              {/* Color dot + label */}
              <div className="flex w-44 shrink-0 items-center gap-2 overflow-hidden">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: d.color }}
                />
                <span
                  className="truncate text-xs text-[#C5C0B8] group-hover:text-[#F0EDE8]"
                  title={d.name}
                >
                  {d.name}
                </span>
                {d.hasChildren && (
                  <ChevronRight size={12} className="shrink-0 text-[#5A5650]" />
                )}
              </div>

              {/* Bar */}
              <div className="relative flex-1">
                <div className="h-5 w-full rounded" style={{ backgroundColor: CHART.bgDarker }}>
                  <div
                    className="h-5 rounded transition-all duration-300"
                    style={{
                      width: `${Math.max(barWidth, 1.5)}%`,
                      backgroundColor: d.color,
                      opacity: 0.6,
                    }}
                  />
                </div>
              </div>

              {/* Count + percentage */}
              <div className="flex w-28 shrink-0 items-baseline justify-end gap-2">
                <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                  {formatCompact(d.size)}
                </span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#5A5650]">
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total row */}
      {chartData.length > 1 && (
        <div className="mt-2 flex items-center gap-3 border-t border-[#232328] px-2 pt-3">
          <div className="w-44 shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Total
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex w-28 shrink-0 items-baseline justify-end gap-2">
            <span className="font-['IBM_Plex_Mono',monospace] text-xs font-semibold text-[#F0EDE8]">
              {formatCompact(total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
