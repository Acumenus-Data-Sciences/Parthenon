import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronRight, CornerLeftUp } from "lucide-react";
import { formatCompact, CHART } from "./chartUtils";
import type { HierarchyNode } from "../../types/dataExplorer";

const LEVEL_PALETTE = [
  "var(--success)", "var(--accent)", "var(--info)", "#A855F7", "#E5A84B",
  "var(--critical)", "#34D399", "var(--domain-procedure)", "#8B5CF6", "#94A3B8",
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
      <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-raised py-12">
        <p className="text-sm text-text-muted">No hierarchy data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-6">
      {/* Header with breadcrumbs */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-semibold uppercase tracking-wider text-text-muted">
            {hasHierarchy ? "Classification Hierarchy" : "Top Concepts"}
          </span>
          {path.length > 0 && (
            <>
              {path.map((segment, i) => (
                <span key={i} className="flex items-center gap-1 text-text-secondary">
                  <ChevronRight size={12} className="text-text-ghost" />
                  <button
                    type="button"
                    onClick={() => setPath(path.slice(0, i + 1))}
                    className="transition-colors hover:text-text-primary"
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
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-secondary"
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
              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-overlay"
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
                  className="truncate text-xs text-text-secondary group-hover:text-text-primary"
                  title={d.name}
                >
                  {d.name}
                </span>
                {d.hasChildren && (
                  <ChevronRight size={12} className="shrink-0 text-text-ghost" />
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
                <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-secondary">
                  {formatCompact(d.size)}
                </span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-text-ghost">
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total row */}
      {chartData.length > 1 && (
        <div className="mt-2 flex items-center gap-3 border-t border-border-default px-2 pt-3">
          <div className="w-44 shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Total
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex w-28 shrink-0 items-baseline justify-end gap-2">
            <span className="font-['IBM_Plex_Mono',monospace] text-xs font-semibold text-text-primary">
              {formatCompact(total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
