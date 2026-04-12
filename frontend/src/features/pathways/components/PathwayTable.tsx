import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PathwayResult, PathwayEntry } from "../types/pathway";

// Matching color palette from SankeyDiagram
const COHORT_COLORS = [
  "#2DD4BF",
  "#C9A227",
  "#E85A6B",
  "#818CF8",
  "#F59E0B",
  "#94A3B8",
  "#A78BFA",
  "#34D399",
  "#FB923C",
  "#F472B6",
];

function getCohortColor(index: number): string {
  return COHORT_COLORS[index % COHORT_COLORS.length];
}

type SortField = "rank" | "count" | "percent";
type SortDir = "asc" | "desc";

interface PathwayTableProps {
  result: PathwayResult;
  onPathwaySelect?: (entry: PathwayEntry) => void;
  selectedPathway?: PathwayEntry | null;
}

export function PathwayTable({
  result,
  onPathwaySelect,
  selectedPathway,
}: PathwayTableProps) {
  const [sortField, setSortField] = useState<SortField>("count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Color map from event cohort names
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const cohortNames = Object.values(result.event_cohorts);
    cohortNames.forEach((name, i) => {
      map[name] = getCohortColor(i);
    });
    Object.entries(result.event_cohorts).forEach(([key, name]) => {
      map[key] = map[name];
    });
    return map;
  }, [result.event_cohorts]);

  const sorted = useMemo(() => {
    const withRank = result.pathways
      .map((p, i) => ({ ...p, rank: i + 1 }))
      .sort((a, b) => b.count - a.count)
      .map((p, i) => ({ ...p, rank: i + 1 }));

    const copy = [...withRank];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "rank":
          cmp = a.rank - b.rank;
          break;
        case "count":
          cmp = a.count - b.count;
          break;
        case "percent":
          cmp = a.percent - b.percent;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return copy.slice(0, 50);
  }, [result.pathways, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ChevronDown size={10} className="text-[#5A5650]" />;
    return sortDir === "asc" ? (
      <ChevronUp size={10} className="text-[#2DD4BF]" />
    ) : (
      <ChevronDown size={10} className="text-[#2DD4BF]" />
    );
  };

  if (result.pathways.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-[#323238] bg-[#151518]">
        <p className="text-sm text-[#8A857D]">No pathway data</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-[#1C1C20]">
            <th
              onClick={() => toggleSort("rank")}
              className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D] cursor-pointer hover:text-[#C5C0B8] w-16"
            >
              <span className="inline-flex items-center gap-1">
                Rank <SortIcon field="rank" />
              </span>
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
              Pathway
            </th>
            <th
              onClick={() => toggleSort("count")}
              className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D] cursor-pointer hover:text-[#C5C0B8] w-24"
            >
              <span className="inline-flex items-center gap-1 justify-end">
                Count <SortIcon field="count" />
              </span>
            </th>
            <th
              onClick={() => toggleSort("percent")}
              className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D] cursor-pointer hover:text-[#C5C0B8] w-36"
            >
              <span className="inline-flex items-center gap-1 justify-end">
                Percent <SortIcon field="percent" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => {
            const isSelected =
              selectedPathway &&
              selectedPathway.path.join("->") === entry.path.join("->");

            return (
              <tr
                key={entry.path.join("->")}
                onClick={() => onPathwaySelect?.(entry)}
                className={cn(
                  "border-t border-[#1C1C20] transition-colors cursor-pointer hover:bg-[#1C1C20]",
                  i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                  isSelected && "ring-1 ring-inset ring-[#2DD4BF]/30",
                )}
              >
                <td className="px-4 py-2.5 text-xs text-[#5A5650] font-mono">
                  {entry.rank}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {entry.path.map((step, stepIdx) => {
                      const color = colorMap[step] ?? "#5A5650";
                      return (
                        <span key={stepIdx} className="flex items-center gap-1">
                          {stepIdx > 0 && (
                            <span className="text-[10px] text-[#5A5650]">
                              &rarr;
                            </span>
                          )}
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `${color}15`,
                              color,
                              border: `1px solid ${color}30`,
                            }}
                          >
                            {step}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-[#C5C0B8] text-right font-mono">
                  {entry.count.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-[#232328] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#2DD4BF] transition-all"
                        style={{
                          width: `${Math.min(entry.percent, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-[#8A857D] font-mono w-12 text-right">
                      {entry.percent.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
