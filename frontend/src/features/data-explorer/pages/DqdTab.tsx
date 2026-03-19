import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  PlayCircle,
  History,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Shield,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDqdRuns,
  useDqdRun,
  useDqdResults,
  useDqdProgress,
} from "../hooks/useAchillesData";
import { dispatchDqdRun } from "../api/dqdApi";
import type { DqdProgress } from "../api/dqdApi";
import { DqdScorecard } from "../components/dqd/DqdScorecard";
import { DqdTableGrid } from "../components/dqd/DqdTableGrid";
import { DqdCategoryPanel } from "../components/dqd/DqdCategoryPanel";
import type { DqdCheckResult } from "../types/dataExplorer";

interface DqdTabProps {
  sourceId: number;
}

const CATEGORY_COLORS: Record<string, { bar: string; bg: string; label: string }> = {
  completeness: { bar: "#60A5FA", bg: "rgba(96,165,250,0.1)", label: "Completeness" },
  conformance: { bar: "#A855F7", bg: "rgba(168,85,247,0.1)", label: "Conformance" },
  plausibility: { bar: "#E5A84B", bg: "rgba(229,168,75,0.1)", label: "Plausibility" },
};

function ProgressPanel({ progress }: { progress: DqdProgress }) {
  const pct = progress.percentage;

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <div className="rounded-xl border border-[#232328] bg-[#151518] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Activity size={18} className="text-[#C9A227] animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[#F0EDE8]">
                DQD Analysis Running
              </h3>
              <p className="text-xs text-[#5A5650] mt-0.5">
                {progress.completed} of {progress.total} checks completed
              </p>
            </div>
          </div>
          <span className="text-2xl font-semibold font-['IBM_Plex_Mono',monospace] text-[#C9A227]">
            {pct.toFixed(1)}%
          </span>
        </div>

        {/* Main progress bar */}
        <div className="h-3 w-full overflow-hidden rounded-full bg-[#1A1A1E]">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #C9A227 0%, #2DD4BF 100%)",
            }}
          />
        </div>

        {/* Pass/fail counts */}
        <div className="flex items-center gap-6 mt-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-[#2DD4BF]" />
            <span className="text-xs font-['IBM_Plex_Mono',monospace] text-[#2DD4BF]">
              {progress.passed}
            </span>
            <span className="text-xs text-[#5A5650]">passed</span>
          </div>
          {progress.failed > 0 && (
            <div className="flex items-center gap-1.5">
              <XCircle size={12} className="text-[#E85A6B]" />
              <span className="text-xs font-['IBM_Plex_Mono',monospace] text-[#E85A6B]">
                {progress.failed}
              </span>
              <span className="text-xs text-[#5A5650]">failed</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Shield size={12} className="text-[#5A5650]" />
            <span className="text-xs font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
              {progress.total - progress.completed}
            </span>
            <span className="text-xs text-[#5A5650]">remaining</span>
          </div>
        </div>
      </div>

      {/* Per-category progress */}
      <div className="grid grid-cols-3 gap-4">
        {progress.by_category.map((cat) => {
          const meta = CATEGORY_COLORS[cat.category] ?? {
            bar: "#8A857D",
            bg: "rgba(138,133,125,0.1)",
            label: cat.category,
          };
          const catPct = cat.total > 0 ? (cat.completed / cat.total) * 100 : 0;

          return (
            <div
              key={cat.category}
              className="rounded-xl border border-[#232328] bg-[#151518] p-4"
              style={{ borderColor: cat.completed > 0 ? meta.bar + "33" : undefined }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: meta.bar }}>
                  {meta.label}
                </span>
                <span className="text-xs font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                  {cat.completed}/{cat.total}
                </span>
              </div>

              {/* Category progress bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#1A1A1E] mb-2">
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${catPct}%`,
                    backgroundColor: meta.bar,
                  }}
                />
              </div>

              {/* Category pass/fail */}
              <div className="flex items-center gap-3">
                {cat.passed > 0 && (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 size={10} className="text-[#2DD4BF]" />
                    <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-[#2DD4BF]">
                      {cat.passed}
                    </span>
                  </div>
                )}
                {cat.failed > 0 && (
                  <div className="flex items-center gap-1">
                    <XCircle size={10} className="text-[#E85A6B]" />
                    <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-[#E85A6B]">
                      {cat.failed}
                    </span>
                  </div>
                )}
                {cat.completed === 0 && (
                  <span className="text-[10px] text-[#5A5650]">Waiting...</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Latest check indicator */}
      {progress.latest_check && (
        <div className="flex items-center gap-2 rounded-lg border border-[#232328] bg-[#0E0E11] px-4 py-2.5">
          <Loader2 size={12} className="animate-spin text-[#C9A227]" />
          <span className="text-xs text-[#5A5650]">Running:</span>
          <span className="text-xs font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
            {progress.latest_check.cdm_table}
            {progress.latest_check.cdm_column
              ? `.${progress.latest_check.cdm_column}`
              : ""}
          </span>
          <span className="text-xs text-[#5A5650]">
            ({progress.latest_check.category})
          </span>
          {progress.latest_check.passed ? (
            <CheckCircle2 size={10} className="text-[#2DD4BF] ml-auto" />
          ) : (
            <AlertTriangle size={10} className="text-[#E5A84B] ml-auto" />
          )}
        </div>
      )}
    </div>
  );
}

export default function DqdTab({ sourceId }: DqdTabProps) {
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [activeRunId_live, setActiveRunIdLive] = useState<string | null>(null);
  const [showRunSelector, setShowRunSelector] = useState(false);

  // Fetch all runs for this source
  const dqdRuns = useDqdRuns(sourceId);

  // Auto-select latest run
  const activeRunId = selectedRunId ?? dqdRuns.data?.[0]?.run_id ?? null;

  // Auto-detect in-progress run on mount: if the latest run has fewer
  // results than the total expected (170), it's still running
  const latestRunForDetection = dqdRuns.data?.[0] ?? null;
  const detectRunId = latestRunForDetection?.run_id ?? null;
  const detectProgress = useDqdProgress(
    sourceId,
    // Only probe once — when we don't already have a live run and haven't selected one
    activeRunId_live === null && detectRunId !== null ? detectRunId : null,
  );

  useEffect(() => {
    if (
      activeRunId_live === null &&
      detectProgress.data &&
      (detectProgress.data.status === "running" || detectProgress.data.status === "pending")
    ) {
      setActiveRunIdLive(detectProgress.data.run_id);
    }
  }, [activeRunId_live, detectProgress.data]);

  // Fetch run summary + results (only when not live-tracking)
  const dqdRun = useDqdRun(sourceId, activeRunId_live ? null : activeRunId);
  const dqdResults = useDqdResults(sourceId, activeRunId_live ? null : activeRunId);

  // Live progress polling (1s interval)
  const progressQuery = useDqdProgress(sourceId, activeRunId_live);

  // When progress completes, stop polling and refresh runs list
  useEffect(() => {
    if (progressQuery.data?.status === "completed" && activeRunId_live) {
      const completedRunId = activeRunId_live;
      setActiveRunIdLive(null);
      setSelectedRunId(completedRunId);
      queryClient.invalidateQueries({ queryKey: ["dqd", "runs", sourceId] });
      queryClient.invalidateQueries({
        queryKey: ["dqd", "run", sourceId, completedRunId],
      });
      queryClient.invalidateQueries({
        queryKey: ["dqd", "results", sourceId, completedRunId],
      });
    }
  }, [progressQuery.data?.status, activeRunId_live, sourceId, queryClient]);

  // Dispatch new DQD run
  const runMutation = useMutation({
    mutationFn: () => dispatchDqdRun(sourceId),
    onSuccess: (data) => {
      setActiveRunIdLive(data.run_id);
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
  const isRunning = activeRunId_live != null;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending || isRunning}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2.5 text-sm font-medium text-[#F0EDE8]",
            "hover:bg-[#B82D42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {runMutation.isPending || isRunning ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <PlayCircle size={14} />
          )}
          {isRunning ? "Running..." : "Run DQD"}
        </button>

        {/* Run history selector */}
        {dqdRuns.data && dqdRuns.data.length > 0 && !isRunning && (
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
                      {new Date(run.started_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {runMutation.isError && (
          <span className="text-xs text-[#E85A6B]">Failed to dispatch DQD run</span>
        )}
      </div>

      {/* Live progress panel */}
      {isRunning && progressQuery.data && (
        <ProgressPanel progress={progressQuery.data} />
      )}

      {/* Loading state for completed run data */}
      {!isRunning && (dqdRun.isLoading || dqdResults.isLoading) && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-[#8A857D]" />
        </div>
      )}

      {/* No data state */}
      {!isRunning && !dqdRun.isLoading && !dqdRun.data && !activeRunId && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-16">
          <History size={32} className="text-[#5A5650] mb-3" />
          <p className="text-sm text-[#8A857D]">No DQD runs yet</p>
          <p className="mt-1 text-xs text-[#5A5650]">
            Click "Run DQD" to start a data quality analysis
          </p>
        </div>
      )}

      {/* DQD content (completed runs) */}
      {!isRunning && dqdRun.data && (
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
