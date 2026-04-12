import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, BarChart3, Database, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useCohortDefinitions, useCohortOverlap } from "../hooks/useCohortDefinitions";
import { VennDiagram } from "./VennDiagram";
import type { GenerationSource } from "../types/cohortExpression";

interface CohortOverlapPanelProps {
  /** Pre-select this cohort (current definition) */
  currentCohortId?: number | null;
  /** Generation sources for the current cohort (to suggest a default source) */
  generationSources?: GenerationSource[];
}

export function CohortOverlapPanel({
  currentCohortId,
  generationSources,
}: CohortOverlapPanelProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(
    currentCohortId ? [currentCohortId] : [],
  );

  // Auto-select if only one completed generation source
  const completedSources = useMemo(
    () =>
      (generationSources ?? []).filter(
        (s) => s.person_count != null && s.person_count > 0,
      ),
    [generationSources],
  );

  const [sourceId, setSourceId] = useState<number | null>(
    completedSources.length === 1 ? completedSources[0].source_id : null,
  );

  // Fetch all sources for the picker when no generation_sources provided
  const { data: allSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
    enabled: completedSources.length === 0,
  });

  const { data: cohortList } = useCohortDefinitions({ limit: 500 });
  const {
    data: overlap,
    isLoading,
    error,
  } = useCohortOverlap(selectedIds, sourceId);

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
        <h3 className="text-sm font-semibold text-text-primary mb-2">
          Cohort Overlap Analysis
        </h3>
        <p className="text-xs text-text-muted">
          Select a data source and 2-4 cohorts to compare membership overlap
        </p>
      </div>

      {/* Source selector */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <label className="block text-xs font-medium text-text-muted mb-1.5">
          Data Source
        </label>
        <div className="relative max-w-xs">
          <Database
            size={12}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
          />
          <select
            value={sourceId ?? ""}
            onChange={(e) => setSourceId(Number(e.target.value) || null)}
            className={cn(
              "w-full appearance-none rounded-lg border border-border-default bg-surface-base pl-8 pr-8 py-2 text-sm",
              "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
            )}
          >
            <option value="">Select a data source...</option>
            {completedSources.length > 0
              ? completedSources.map((src) => (
                  <option key={src.source_id} value={src.source_id}>
                    {src.source_name ?? src.source_key ?? `Source #${src.source_id}`}
                    {src.person_count != null
                      ? ` (${src.person_count.toLocaleString()} patients)`
                      : ""}
                  </option>
                ))
              : allSources?.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.source_name}
                  </option>
                ))}
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-ghost"
          />
        </div>
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
                    ? "bg-success/15 text-success border border-success/30"
                    : "bg-surface-overlay text-text-muted border border-border-default hover:text-text-secondary hover:border-text-ghost",
                  !selected &&
                    selectedIds.length >= 4 &&
                    "opacity-40 cursor-not-allowed",
                )}
              >
                <span
                  className={cn(
                    "inline-flex w-2 h-2 rounded-full",
                    selected ? "bg-success" : "bg-surface-highlight",
                  )}
                />
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Status messages */}
      {!sourceId && (
        <div className="rounded-lg border border-dashed border-surface-highlight bg-surface-raised p-8 text-center">
          <Database size={24} className="mx-auto text-surface-highlight mb-3" />
          <p className="text-sm text-text-muted">
            Select a data source to compute overlap
          </p>
        </div>
      )}

      {sourceId && selectedIds.length < 2 && (
        <div className="rounded-lg border border-dashed border-surface-highlight bg-surface-raised p-8 text-center">
          <BarChart3 size={24} className="mx-auto text-surface-highlight mb-3" />
          <p className="text-sm text-text-muted">
            Select at least 2 cohorts to compute overlap
          </p>
        </div>
      )}

      {isLoading && selectedIds.length >= 2 && sourceId && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-critical/30 bg-critical/5 p-4">
          <p className="text-xs text-critical">
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
                className="rounded-lg border border-border-default bg-surface-raised p-3"
              >
                <p className="text-[10px] uppercase tracking-wider text-text-ghost mb-1">
                  {cohortNames[id] ?? `Cohort ${id}`}
                </p>
                <p className="text-lg font-semibold text-text-primary font-['IBM_Plex_Mono',monospace]">
                  {(overlap.cohort_counts[id] ?? 0).toLocaleString()}
                </p>
              </div>
            ))}
            <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-accent/70 mb-1">
                Total Unique
              </p>
              <p className="text-lg font-semibold text-accent font-['IBM_Plex_Mono',monospace]">
                {overlap.summary.total_unique_subjects.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Venn diagrams for each pair */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {overlap.pairs.map((pair) => (
              <div
                key={`${pair.cohort_id_a}-${pair.cohort_id_b}`}
                className="rounded-lg border border-border-default bg-surface-raised p-4"
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
          <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
            <div className="px-4 py-2 bg-surface-overlay border-b border-border-default">
              <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                Pairwise Overlap Matrix
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="px-4 py-2 text-left text-text-ghost font-medium">
                      Cohort A
                    </th>
                    <th className="px-4 py-2 text-left text-text-ghost font-medium">
                      Cohort B
                    </th>
                    <th className="px-4 py-2 text-right text-text-ghost font-medium">
                      Only A
                    </th>
                    <th className="px-4 py-2 text-right text-text-ghost font-medium">
                      Overlap
                    </th>
                    <th className="px-4 py-2 text-right text-text-ghost font-medium">
                      Only B
                    </th>
                    <th className="px-4 py-2 text-right text-text-ghost font-medium">
                      Jaccard
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overlap.pairs.map((pair) => (
                    <tr
                      key={`${pair.cohort_id_a}-${pair.cohort_id_b}`}
                      className="border-b border-border-default last:border-b-0"
                    >
                      <td className="px-4 py-2 text-text-primary">
                        {cohortNames[pair.cohort_id_a] ?? pair.cohort_id_a}
                      </td>
                      <td className="px-4 py-2 text-text-primary">
                        {cohortNames[pair.cohort_id_b] ?? pair.cohort_id_b}
                      </td>
                      <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-success">
                        {pair.only_a.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-accent font-semibold">
                        {pair.overlap_count.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-info">
                        {pair.only_b.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-muted">
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
