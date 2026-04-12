import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { PathwayResult, PathwayEntry } from "../types/pathway";

// Color palette for event cohorts
const COHORT_COLORS = [
  "var(--success)", // teal
  "var(--accent)", // gold
  "var(--critical)", // crimson
  "var(--info)", // indigo
  "var(--warning)", // amber
  "var(--text-muted)", // gray
  "var(--domain-observation)", // violet
  "var(--success)", // emerald
  "var(--domain-device)", // orange
  "var(--domain-procedure)", // pink
];

function getCohortColor(index: number): string {
  return COHORT_COLORS[index % COHORT_COLORS.length];
}

interface SankeyDiagramProps {
  result: PathwayResult;
  onPathwaySelect?: (entry: PathwayEntry) => void;
  selectedPathway?: PathwayEntry | null;
}

export function SankeyDiagram({
  result,
  onPathwaySelect,
  selectedPathway,
}: SankeyDiagramProps) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  // Build color map from event cohort names
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const cohortNames = Object.values(result.event_cohorts);
    cohortNames.forEach((name, i) => {
      map[name] = getCohortColor(i);
    });
    // Also map by ID key
    Object.entries(result.event_cohorts).forEach(([key, name]) => {
      map[key] = map[name];
    });
    return map;
  }, [result.event_cohorts]);

  // Determine max steps across all pathways
  const maxSteps = useMemo(
    () => Math.max(...result.pathways.map((p) => p.path.length), 1),
    [result.pathways],
  );

  // Top pathways (max 25 for visualization)
  const topPathways = useMemo(
    () =>
      [...result.pathways]
        .sort((a, b) => b.count - a.count)
        .slice(0, 25),
    [result.pathways],
  );

  const maxCount = topPathways[0]?.count ?? 1;

  if (topPathways.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-surface-highlight bg-surface-raised">
        <p className="text-sm text-text-muted">No pathway data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border-default bg-surface-raised p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Unique Pathways
          </p>
          <p className="mt-1 text-xl font-bold text-success">
            {result.summary.unique_pathways.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-raised p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            With Events
          </p>
          <p className="mt-1 text-xl font-bold text-accent">
            {result.summary.persons_with_events.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-raised p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Without Events
          </p>
          <p className="mt-1 text-xl font-bold text-text-muted">
            {result.summary.persons_without_events.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Color Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        {Object.entries(result.event_cohorts).map(([key, name]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: colorMap[name] }}
            />
            <span className="text-xs text-text-secondary">{name}</span>
          </div>
        ))}
      </div>

      {/* Stacked Bar Pathway Visualization */}
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        {/* Step headers */}
        <div className="flex items-center bg-surface-overlay border-b border-border-default">
          <div className="w-12 shrink-0 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            #
          </div>
          <div className="flex-1 flex">
            {Array.from({ length: maxSteps }).map((_, i) => (
              <div
                key={i}
                className="flex-1 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted text-center"
              >
                Step {i + 1}
              </div>
            ))}
          </div>
          <div className="w-20 shrink-0 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted text-right">
            Count
          </div>
          <div className="w-16 shrink-0 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted text-right">
            %
          </div>
        </div>

        {/* Pathway rows */}
        {topPathways.map((entry, rowIdx) => {
          const isHovered = hoveredRow === rowIdx;
          const isSelected =
            selectedPathway &&
            selectedPathway.path.join("->") === entry.path.join("->");

          return (
            <div
              key={entry.path.join("->")}
              onMouseEnter={() => setHoveredRow(rowIdx)}
              onMouseLeave={() => setHoveredRow(null)}
              onClick={() => onPathwaySelect?.(entry)}
              className={cn(
                "flex items-center border-t border-border-subtle transition-colors cursor-pointer",
                rowIdx % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                isHovered && "bg-surface-overlay",
                isSelected && "ring-1 ring-inset ring-[#2DD4BF]/30",
              )}
            >
              {/* Rank */}
              <div className="w-12 shrink-0 px-2 py-2.5 text-xs text-text-ghost font-mono">
                {rowIdx + 1}
              </div>

              {/* Steps - stacked bar */}
              <div className="flex-1 flex items-center py-1.5 gap-0.5">
                {entry.path.map((step, stepIdx) => {
                  const color = colorMap[step] ?? "var(--text-ghost)";
                  const widthPercent =
                    ((entry.count / maxCount) * 100) / entry.path.length;

                  return (
                    <div
                      key={stepIdx}
                      className="flex-1 group relative"
                    >
                      <div
                        className={cn(
                          "h-8 rounded-sm flex items-center justify-center px-1 transition-all",
                          isHovered ? "opacity-100" : "opacity-85",
                        )}
                        style={{
                          backgroundColor: `${color}25`,
                          borderLeft: `3px solid ${color}`,
                          minWidth: `${Math.max(widthPercent, 20)}%`,
                        }}
                      >
                        <span
                          className="text-[10px] font-medium truncate"
                          style={{ color }}
                        >
                          {step}
                        </span>
                      </div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                        <div className="rounded-md bg-surface-base border border-surface-highlight px-2 py-1 shadow-lg whitespace-nowrap">
                          <p
                            className="text-[10px] font-medium"
                            style={{ color }}
                          >
                            {step}
                          </p>
                          <p className="text-[9px] text-text-muted">
                            Step {stepIdx + 1} of {entry.path.length}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Empty steps for alignment */}
                {Array.from({ length: maxSteps - entry.path.length }).map(
                  (_, i) => (
                    <div key={`empty-${i}`} className="flex-1" />
                  ),
                )}
              </div>

              {/* Count */}
              <div className="w-20 shrink-0 px-2 py-2.5 text-xs text-text-secondary text-right font-mono">
                {entry.count.toLocaleString()}
              </div>

              {/* Percent */}
              <div className="w-16 shrink-0 px-2 py-2.5 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <div className="w-8 h-1 rounded-full bg-surface-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full bg-success"
                      style={{ width: `${Math.min(entry.percent, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-text-muted font-mono w-10 text-right">
                    {entry.percent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
