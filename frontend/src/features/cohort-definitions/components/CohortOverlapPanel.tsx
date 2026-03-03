import { useState } from "react";
import { Loader2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCohortDefinitions, useCohortOverlap } from "../hooks/useCohortDefinitions";
import { VennDiagram } from "./VennDiagram";

interface CohortOverlapPanelProps {
  /** Pre-select this cohort (current definition) */
  currentCohortId?: number | null;
  /** Source to run overlap against */
  sourceId?: number | null;
}

export function CohortOverlapPanel({
  currentCohortId,
  sourceId,
}: CohortOverlapPanelProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(
    currentCohortId ? [currentCohortId] : [],
  );
  const [activeSourceId, setActiveSourceId] = useState<number | null>(
    sourceId ?? null,
  );

  const { data: cohortList } = useCohortDefinitions({ limit: 100 });
  const {
    data: overlap,
    isLoading,
    error,
  } = useCohortOverlap(selectedIds, activeSourceId);

  const toggleCohort = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const cohorts = cohortList?.items ?? [];
  const cohortNames = Object.fromEntries(
    cohorts.map((c) => [c.id, c.name]),
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[#F0EDE8] mb-2">
          Cohort Overlap Analysis
        </h3>
        <p className="text-xs text-[#8A857D]">
          Select 2-4 cohorts to compare membership overlap
        </p>
      </div>

      {/* Cohort selector chips */}
      {cohorts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cohorts.map((c) => {
            const selected = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCohort(c.id)}
                disabled={!selected && selectedIds.length >= 4}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  selected
                    ? "bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30"
                    : "bg-[#1A1A1E] text-[#8A857D] border border-[#232328] hover:text-[#C5C0B8] hover:border-[#5A5650]",
                  !selected &&
                    selectedIds.length >= 4 &&
                    "opacity-40 cursor-not-allowed",
                )}
              >
                <span
                  className={cn(
                    "inline-flex w-2 h-2 rounded-full",
                    selected ? "bg-[#2DD4BF]" : "bg-[#323238]",
                  )}
                />
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Trigger / status */}
      {selectedIds.length < 2 && (
        <div className="rounded-lg border border-dashed border-[#323238] bg-[#151518] p-8 text-center">
          <BarChart3 size={24} className="mx-auto text-[#323238] mb-3" />
          <p className="text-sm text-[#8A857D]">
            Select at least 2 cohorts to compute overlap
          </p>
        </div>
      )}

      {isLoading && selectedIds.length >= 2 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[#8A857D]" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/5 p-4">
          <p className="text-xs text-[#E85A6B]">
            Failed to compute overlap: {(error as Error).message}
          </p>
        </div>
      )}

      {/* Results */}
      {overlap && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {overlap.summary.cohort_ids.map((id) => (
              <div
                key={id}
                className="rounded-lg border border-[#232328] bg-[#151518] p-3"
              >
                <p className="text-[10px] uppercase tracking-wider text-[#5A5650] mb-1">
                  {cohortNames[id] ?? `Cohort ${id}`}
                </p>
                <p className="text-lg font-semibold text-[#F0EDE8] font-['IBM_Plex_Mono',monospace]">
                  {(overlap.cohort_counts[id] ?? 0).toLocaleString()}
                </p>
              </div>
            ))}
            <div className="rounded-lg border border-[#C9A227]/20 bg-[#C9A227]/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#C9A227]/70 mb-1">
                Total Unique
              </p>
              <p className="text-lg font-semibold text-[#C9A227] font-['IBM_Plex_Mono',monospace]">
                {overlap.summary.total_unique_subjects.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Venn diagrams for each pair */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {overlap.pairs.map((pair) => (
              <div
                key={`${pair.cohort_id_a}-${pair.cohort_id_b}`}
                className="rounded-lg border border-[#232328] bg-[#151518] p-4"
              >
                <VennDiagram
                  pair={pair}
                  labelA={cohortNames[pair.cohort_id_a] ?? `Cohort ${pair.cohort_id_a}`}
                  labelB={cohortNames[pair.cohort_id_b] ?? `Cohort ${pair.cohort_id_b}`}
                />
              </div>
            ))}
          </div>

          {/* Overlap matrix table */}
          <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
            <div className="px-4 py-2 bg-[#1A1A1E] border-b border-[#232328]">
              <span className="text-[10px] uppercase tracking-wider text-[#8A857D] font-semibold">
                Pairwise Overlap Matrix
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#232328]">
                    <th className="px-4 py-2 text-left text-[#5A5650] font-medium">
                      Cohort A
                    </th>
                    <th className="px-4 py-2 text-left text-[#5A5650] font-medium">
                      Cohort B
                    </th>
                    <th className="px-4 py-2 text-right text-[#5A5650] font-medium">
                      Only A
                    </th>
                    <th className="px-4 py-2 text-right text-[#5A5650] font-medium">
                      Overlap
                    </th>
                    <th className="px-4 py-2 text-right text-[#5A5650] font-medium">
                      Only B
                    </th>
                    <th className="px-4 py-2 text-right text-[#5A5650] font-medium">
                      Jaccard
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overlap.pairs.map((pair) => (
                    <tr
                      key={`${pair.cohort_id_a}-${pair.cohort_id_b}`}
                      className="border-b border-[#232328] last:border-b-0"
                    >
                      <td className="px-4 py-2 text-[#F0EDE8]">
                        {cohortNames[pair.cohort_id_a] ?? pair.cohort_id_a}
                      </td>
                      <td className="px-4 py-2 text-[#F0EDE8]">
                        {cohortNames[pair.cohort_id_b] ?? pair.cohort_id_b}
                      </td>
                      <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-[#2DD4BF]">
                        {pair.only_a.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-[#C9A227] font-semibold">
                        {pair.overlap_count.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-[#818CF8]">
                        {pair.only_b.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                        {pair.jaccard_index.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
