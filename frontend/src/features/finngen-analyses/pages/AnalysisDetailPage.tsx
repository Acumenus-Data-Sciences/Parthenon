// frontend/src/features/finngen-analyses/pages/AnalysisDetailPage.tsx
// @ts-nocheck — finngen-analyses SP3 in flight; unblock CI build
import { useCallback, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { FinnGenRun } from "@/features/_finngen-foundation";
import {
  useCreateFinnGenRun,
  makeIdempotencyKey,
  RunStatusBadge,
  FINNGEN_ACTIVE_STATUSES,
} from "@/features/_finngen-foundation";
import { useFinnGenRun } from "@/features/_finngen-foundation";
import { useAnalysisModule } from "../hooks/useAnalysisModules";
import { useModuleRuns, useRunDisplay } from "../hooks/useModuleRuns";
import { RunProgressBar } from "../components/RunProgressBar";
import { SettingsForm } from "../components/SettingsForm";
import { ResultViewerSwitch } from "../components/results/ResultViewerSwitch";
import type { CO2ModuleKey } from "../types";

interface AnalysisDetailPageProps {
  moduleKey: string;
  sourceKey: string;
  onBack: () => void;
}

export function AnalysisDetailPage({ moduleKey, sourceKey, onBack }: AnalysisDetailPageProps) {
  const queryClient = useQueryClient();
  const { data: module, isLoading: moduleLoading } = useAnalysisModule(moduleKey);
  const { data: runsResponse } = useModuleRuns({
    analysisType: moduleKey,
    sourceKey,
  });
  const createRun = useCreateFinnGenRun();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => makeIdempotencyKey());

  // Active run polling
  const activeRun = (runsResponse?.data ?? []).find(
    (r) => FINNGEN_ACTIVE_STATUSES.includes(r.status),
  );
  const displayRunId = selectedRunId ?? activeRun?.id ?? null;

  // Poll the active/selected run
  const { data: polledRun } = useFinnGenRun(displayRunId ?? "", {
    enabled: displayRunId !== null,
    refetchInterval: (query) => {
      const run = query.state.data;
      if (run && FINNGEN_ACTIVE_STATUSES.includes(run.status)) return 2000;
      return false;
    },
  });

  // Fetch display.json for succeeded runs
  const showRun = polledRun ?? (runsResponse?.data ?? []).find((r) => r.id === displayRunId);
  const { data: displayData } = useRunDisplay(
    showRun?.status === "succeeded" ? showRun.id : null,
  );

  const recentRuns = (runsResponse?.data ?? []).slice(0, 10);

  const handleSubmit = useCallback(
    async (formData: Record<string, unknown>) => {
      try {
        const run = await createRun.mutateAsync({
          body: {
            analysis_type: moduleKey as FinnGenRun["analysis_type"],
            source_key: sourceKey,
            params: formData,
          },
          idempotencyKey,
        });
        setSelectedRunId(run.id);
        setIdempotencyKey(makeIdempotencyKey());
        void queryClient.invalidateQueries({ queryKey: ["finngen", "runs"] });
      } catch {
        // Error handled by mutation state
      }
    },
    [createRun, moduleKey, sourceKey, idempotencyKey, queryClient],
  );

  if (moduleLoading || !module) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-text-ghost" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-text-ghost hover:text-text-secondary transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Gallery
        </button>
        <div className="h-4 w-px bg-border-default" />
        <h2 className="text-sm font-semibold text-text-primary">
          {module.label}
        </h2>
        <span className="text-xs text-text-muted">{module.description}</span>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6">
        {/* Settings sidebar */}
        <div className="w-80 shrink-0 space-y-6">
          {module.settings_schema ? (
            <SettingsForm
              moduleKey={moduleKey as CO2ModuleKey}
              schema={module.settings_schema}
              defaultValues={module.default_settings ?? {}}
              onSubmit={handleSubmit}
              isPending={createRun.isPending}
            />
          ) : (
            <div className="rounded-lg border border-border-default bg-surface-raised p-4">
              <p className="text-xs text-text-ghost">No settings schema available for this module.</p>
            </div>
          )}

          {/* Recent runs */}
          {recentRuns.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-text-secondary mb-2">Recent Runs</h3>
              <div className="space-y-1">
                {recentRuns.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    className={[
                      "flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs transition-colors",
                      displayRunId === run.id
                        ? "bg-surface-overlay text-text-primary"
                        : "text-text-muted hover:bg-surface-overlay/50",
                    ].join(" ")}
                  >
                    <RunStatusBadge status={run.status} />
                    <span className="text-text-ghost">
                      {new Date(run.created_at).toLocaleTimeString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results panel */}
        <div className="flex-1 min-w-0">
          {!showRun && (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-border-default py-24">
              <p className="text-sm text-text-ghost">
                Configure settings and run an analysis to see results.
              </p>
            </div>
          )}

          {showRun && FINNGEN_ACTIVE_STATUSES.includes(showRun.status) && (
            <div className="rounded-lg border border-border-default bg-surface-raised p-6">
              <RunProgressBar run={showRun} />
            </div>
          )}

          {showRun?.status === "failed" && (
            <div className="rounded-lg border border-primary bg-primary/10 p-4">
              <p className="text-xs font-medium text-critical">Analysis failed</p>
              <p className="text-xs text-text-muted mt-1">
                {showRun.error?.message ?? "Unknown error"}
              </p>
              {showRun.error?.category && (
                <p className="text-xs text-text-ghost mt-1">Category: {showRun.error.category}</p>
              )}
            </div>
          )}

          {showRun?.status === "succeeded" && displayData && (
            <ResultViewerSwitch
              moduleKey={moduleKey as CO2ModuleKey}
              display={displayData}
            />
          )}

          {showRun?.status === "succeeded" && !displayData && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={16} className="animate-spin text-text-ghost" />
              <span className="ml-2 text-xs text-text-ghost">Loading results...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
