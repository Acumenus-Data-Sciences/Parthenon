import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlayCircle, History, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDqdRuns, useDqdRun, useDqdResults } from "../hooks/useAchillesData";
import { dispatchDqdRun } from "../api/dqdApi";
import { DqdScorecard } from "../components/dqd/DqdScorecard";
import { DqdTableGrid } from "../components/dqd/DqdTableGrid";
import { DqdCategoryPanel } from "../components/dqd/DqdCategoryPanel";
import type { DqdCheckResult } from "../types/dataExplorer";

interface DqdTabProps {
  sourceId: number;
}

export default function DqdTab({ sourceId }: DqdTabProps) {
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showRunSelector, setShowRunSelector] = useState(false);

  // Fetch all runs for this source
  const dqdRuns = useDqdRuns(sourceId);

  // Auto-select latest run
  const activeRunId = selectedRunId ?? dqdRuns.data?.[0]?.run_id ?? null;

  // Fetch run summary + results
  const dqdRun = useDqdRun(sourceId, activeRunId);
  const dqdResults = useDqdResults(sourceId, activeRunId);

  // Dispatch new DQD run
  const runMutation = useMutation({
    mutationFn: () => dispatchDqdRun(sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dqd", "runs", sourceId] });
    },
  });

  // Group results by category
  const resultsByCategory = useMemo(() => {
    const results = dqdResults.data?.data ?? [];
    const groups: Record<string, DqdCheckResult[]> = {
      completeness: [],
      conformance: [],
      plausibility: [],
    };
    for (const r of results) {
      const cat = r.category;
      if (groups[cat]) {
        groups[cat].push(r);
      } else {
        groups[cat] = [r];
      }
    }
    return groups;
  }, [dqdResults.data]);

  const allResults = dqdResults.data?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2.5 text-sm font-medium text-[#F0EDE8]",
            "hover:bg-[#B82D42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {runMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <PlayCircle size={14} />
          )}
          Run DQD
        </button>

        {/* Run history selector */}
        {dqdRuns.data && dqdRuns.data.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowRunSelector(!showRunSelector)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#C5C0B8] hover:bg-[#1A1A1E] transition-colors"
            >
              <History size={14} className="text-[#8A857D]" />
              {activeRunId
                ? `Run ${activeRunId.slice(0, 8)}...`
                : "Select run"}
              <ChevronDown size={12} className="text-[#8A857D]" />
            </button>
            {showRunSelector && (
              <div className="absolute top-full left-0 z-10 mt-1 w-64 rounded-lg border border-[#232328] bg-[#1A1A1E] shadow-xl">
                {dqdRuns.data.map((run) => (
                  <button
                    key={run.run_id}
                    type="button"
                    onClick={() => {
                      setSelectedRunId(run.run_id);
                      setShowRunSelector(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-[#232328] transition-colors",
                      run.run_id === activeRunId
                        ? "text-[#C9A227]"
                        : "text-[#C5C0B8]",
                    )}
                  >
                    <span className="font-['IBM_Plex_Mono',monospace] text-xs">
                      {run.run_id.slice(0, 12)}
                    </span>
                    <span className="text-xs text-[#5A5650]">
                      {new Date(run.created_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {runMutation.isSuccess && (
          <span className="text-xs text-[#2DD4BF]">DQD run dispatched</span>
        )}
        {runMutation.isError && (
          <span className="text-xs text-[#E85A6B]">Failed to dispatch DQD run</span>
        )}
      </div>

      {/* Loading */}
      {(dqdRun.isLoading || dqdResults.isLoading) && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-[#8A857D]" />
        </div>
      )}

      {/* No data state */}
      {!dqdRun.isLoading && !dqdRun.data && !activeRunId && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-16">
          <History size={32} className="text-[#5A5650] mb-3" />
          <p className="text-sm text-[#8A857D]">No DQD runs yet</p>
          <p className="mt-1 text-xs text-[#5A5650]">
            Click "Run DQD" to start a data quality analysis
          </p>
        </div>
      )}

      {/* DQD content */}
      {dqdRun.data && (
        <>
          <DqdScorecard summary={dqdRun.data} />
          {allResults.length > 0 && <DqdTableGrid results={allResults} />}
          {Object.entries(resultsByCategory).map(([category, checks]) => {
            if (!checks.length) return null;
            return (
              <DqdCategoryPanel
                key={category}
                category={category}
                checks={checks}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
