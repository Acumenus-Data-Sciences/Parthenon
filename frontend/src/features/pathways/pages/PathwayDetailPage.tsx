import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Play,
  Database,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { ExecutionStatusBadge } from "@/features/analyses/components/ExecutionStatusBadge";
import { PathwayDesigner } from "../components/PathwayDesigner";
import { SankeyDiagram } from "../components/SankeyDiagram";
import { PathwayTable } from "../components/PathwayTable";
import {
  usePathway,
  useDeletePathway,
  useExecutePathway,
  usePathwayExecutions,
  usePathwayExecution,
} from "../hooks/usePathways";
import type { PathwayResult, PathwayEntry } from "../types/pathway";

type Tab = "design" | "results";

export default function PathwayDetailPage() {
  const { t } = useTranslation("app");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pathwayId = id ? Number(id) : null;

  const {
    data: pathway,
    isLoading,
    error,
  } = usePathway(pathwayId);
  const deleteMutation = useDeletePathway();
  const executeMutation = useExecutePathway();

  const { data: executions } = usePathwayExecutions(pathwayId);

  const [activeTab, setActiveTab] = useState<Tab>("design");
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [activeExecId, setActiveExecId] = useState<number | null>(null);
  const [selectedPathway, setSelectedPathway] =
    useState<PathwayEntry | null>(null);

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const autoSelectedExecId = useMemo(() => {
    if (!executions?.length) return null;
    const latest = executions.reduce((a, b) =>
      new Date(b.created_at) > new Date(a.created_at) ? b : a,
    );
    return latest.status === "completed" ? latest.id : null;
  }, [executions]);
  const selectedExecId = activeExecId ?? autoSelectedExecId;

  const { data: activeExec } = usePathwayExecution(pathwayId, selectedExecId);

  const handleDelete = () => {
    if (!pathwayId) return;
    if (
      window.confirm(
        t("analyses.auto.areYouSureYouWantToDeleteThisPathwayAnalysis_940614"),
      )
    ) {
      deleteMutation.mutate(pathwayId, {
        onSuccess: () => navigate("/analyses"),
      });
    }
  };

  const handleExecute = () => {
    if (!pathwayId || !sourceId) return;
    executeMutation.mutate(
      { id: pathwayId, sourceId },
      {
        onSuccess: (exec) => {
          setActiveExecId(exec.id);
          setActiveTab("results");
        },
      },
    );
  };

  const isRunning =
    activeExec?.status === "running" ||
    activeExec?.status === "queued" ||
    activeExec?.status === "pending";

  const pathwayResult = activeExec?.result_json as unknown as PathwayResult | null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !pathway) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-critical">
            {t("analyses.auto.failedToLoadPathwayAnalysis_8a2818")}
          </p>
          <button
            type="button"
            onClick={() => navigate("/analyses")}
            className="mt-4 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            {t("analyses.auto.backToAnalyses_cdf536")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/analyses")}
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-3"
          >
            <ArrowLeft size={14} />
            {t("analyses.auto.analyses_86859f")}
          </button>
          <h1 className="text-2xl font-bold text-text-primary">
            {pathway.name}
          </h1>
          {pathway.description && (
            <p className="mt-1 text-sm text-text-muted">
              {pathway.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Execute Controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Database
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
              />
              <select
                value={sourceId ?? ""}
                onChange={(e) =>
                  setSourceId(Number(e.target.value) || null)
                }
                disabled={loadingSources}
                className={cn(
                  "appearance-none rounded-lg border border-border-default bg-surface-base pl-8 pr-8 py-2 text-sm",
                  "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
                )}
              >
                <option value="">{t("analyses.auto.source_f31bbd")}</option>
                {sources?.map((src) => (
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
            <button
              type="button"
              onClick={handleExecute}
              disabled={
                !sourceId ||
                executeMutation.isPending ||
                isRunning
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
            >
              {executeMutation.isPending || isRunning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              {t("analyses.auto.execute_40cd01")}
            </button>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-muted hover:text-critical hover:border-critical/30 transition-colors disabled:opacity-50"
          >
            {deleteMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {t("analyses.auto.delete_f2a6c4")}
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-border-default">
        {(
          [
            { key: "design" as const, label: t("analyses.auto.design_1afa74") },
            { key: "results" as const, label: t("analyses.auto.results_fd69c5") },
          ]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "text-success"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-success" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "design" ? (
        <PathwayDesigner pathway={pathway} />
      ) : (
        <div className="space-y-6">
          {/* Execution Status */}
          {activeExec && (
            <div className="flex items-center gap-3">
              <ExecutionStatusBadge status={activeExec.status} />
              {activeExec.fail_message && (
                <p className="text-xs text-critical">
                  {activeExec.fail_message}
                </p>
              )}
            </div>
          )}

          {/* Results */}
          {pathwayResult ? (
            <>
              <SankeyDiagram
                result={pathwayResult}
                onPathwaySelect={setSelectedPathway}
                selectedPathway={selectedPathway}
              />
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">
                  {t("analyses.auto.pathwayDetails_4a01a3")}
                </h3>
                <PathwayTable
                  result={pathwayResult}
                  onPathwaySelect={setSelectedPathway}
                  selectedPathway={selectedPathway}
                />
              </div>
            </>
          ) : !activeExec ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
              <p className="text-sm text-text-muted">
                {t(
                  "analyses.auto.noResultsYetSelectADataSourceAndClickExecuteToRunThePathwayAnalysis_ca1a70",
                )}
              </p>
            </div>
          ) : isRunning ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
              <Loader2
                size={24}
                className="animate-spin text-accent mb-3"
              />
              <p className="text-sm text-text-muted">
                {t("analyses.auto.pathwayAnalysisIsRunning_f3d1d6")}
              </p>
            </div>
          ) : null}

          {/* Execution History */}
          {executions && executions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                {t("analyses.auto.executionHistory_1e5b64")}
              </h3>
              <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-overlay">
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                        {t("analyses.auto.status_ec53a8")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                        {t("analyses.auto.source_f31bbd")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                        {t("analyses.auto.started_842855")}
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                        {t("analyses.auto.completed_07ca50")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map((exec, i) => (
                      <tr
                        key={exec.id}
                        onClick={() => {
                          if (exec.status === "completed") {
                            setActiveExecId(exec.id);
                          }
                        }}
                        className={cn(
                          "border-t border-border-subtle transition-colors",
                          exec.status === "completed" &&
                            "cursor-pointer hover:bg-surface-overlay",
                          i % 2 === 0
                            ? "bg-surface-raised"
                            : "bg-surface-overlay",
                          selectedExecId === exec.id &&
                            "ring-1 ring-inset ring-success/30",
                        )}
                      >
                        <td className="px-4 py-3">
                          <ExecutionStatusBadge
                            status={exec.status}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-text-muted">
                          {t("analyses.auto.source_1ec88c")}
                          {exec.source_id}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-muted">
                          {exec.started_at
                            ? new Date(
                                exec.started_at,
                              ).toLocaleString()
                            : "--"}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-muted">
                          {exec.completed_at
                            ? new Date(
                                exec.completed_at,
                              ).toLocaleString()
                            : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
