import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { CharacterizationDesigner } from "../components/CharacterizationDesigner";
import { CharacterizationResults } from "../components/CharacterizationResults";
import { ExecutionStatusBadge } from "../components/ExecutionStatusBadge";
import {
  useCharacterization,
  useDeleteCharacterization,
  useExecuteCharacterization,
  useCharacterizationExecutions,
  useCharacterizationExecution,
} from "../hooks/useCharacterizations";
import type { DirectRunResult } from "../types/analysis";
import { useTranslation } from "react-i18next";

type Tab = "design" | "results";

export default function CharacterizationDetailPage() {
  const { t } = useTranslation("app");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const charId = id ? Number(id) : null;

  const {
    data: characterization,
    isLoading,
    error,
  } = useCharacterization(charId);
  const deleteMutation = useDeleteCharacterization();
  const executeMutation = useExecuteCharacterization();

  const { data: executions } = useCharacterizationExecutions(charId);

  const [activeTab, setActiveTab] = useState<Tab>("design");
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [activeExecId, setActiveExecId] = useState<number | null>(null);
  const [directResult, setDirectResult] = useState<DirectRunResult | null>(null);

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const { data: activeExec } = useCharacterizationExecution(
    charId,
    activeExecId,
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (executions && executions.length > 0 && !activeExecId) {
      const latest = executions.reduce((a, b) =>
        new Date(b.created_at) > new Date(a.created_at) ? b : a,
      );
      if (latest.status === "completed") {
        setActiveExecId(latest.id);
      }
    }
  }, [executions, activeExecId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDelete = () => {
    if (!charId) return;
    if (
      window.confirm(
        "Are you sure you want to delete this characterization?",
      )
    ) {
      deleteMutation.mutate(charId, {
        onSuccess: () => navigate("/analyses"),
      });
    }
  };

  const handleExecute = () => {
    if (!charId || !sourceId) return;
    executeMutation.mutate(
      { id: charId, sourceId },
      {
        onSuccess: (exec) => {
          setActiveExecId(exec.id);
          setActiveTab("results");
        },
      },
    );
  };

  const handleDirectResult = (result: DirectRunResult) => {
    setDirectResult(result);
    setActiveTab("results");
  };

  const isRunning =
    activeExec?.status === "running" ||
    activeExec?.status === "queued" ||
    activeExec?.status === "pending";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !characterization) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-critical">
            {t("analyses.auto.failedToLoadCharacterization_388116")}
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
            {characterization.name}
          </h1>
          {characterization.description && (
            <p className="mt-1 text-sm text-text-muted">
              {characterization.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
            {
              key: "results" as const,
              label: directResult ? "Results (Direct)" : "Results",
            },
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
        <CharacterizationDesigner
          characterization={characterization}
          sourceId={sourceId}
          onDirectResult={handleDirectResult}
        />
      ) : (
        <div className="space-y-6">
          <CharacterizationResults
            execution={directResult ? undefined : activeExec}
            directResult={directResult}
          />

          {/* Clear direct result to fall back to execution history */}
          {directResult && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDirectResult(null)}
                className="text-xs transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                {t("analyses.auto.clearDirectResultShowExecutionHistory_cfcd87")}
              </button>
            </div>
          )}

          {!directResult && executions && executions.length > 0 && (
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
                          activeExecId === exec.id &&
                            "ring-1 ring-inset ring-success/30",
                        )}
                      >
                        <td className="px-4 py-3">
                          <ExecutionStatusBadge
                            status={exec.status}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-text-muted">
                          {t("analyses.auto.source_1ec88c")}{exec.source_id}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-muted">
                          {exec.started_at
                            ? new Date(exec.started_at).toLocaleString()
                            : "--"}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-muted">
                          {exec.completed_at
                            ? new Date(exec.completed_at).toLocaleString()
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
