import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExecutionStatusBadge } from "@/features/analyses/components/ExecutionStatusBadge";
import {
  useEvidenceSynthesisAnalysis,
  useDeleteEvidenceSynthesis,
  useExecuteEvidenceSynthesis,
  useEvidenceSynthesisExecution,
} from "../hooks/useEvidenceSynthesis";
import { EvidenceSynthesisDesigner } from "../components/EvidenceSynthesisDesigner";
import { EvidenceSynthesisResults } from "../components/EvidenceSynthesisResults";

type Tab = "design" | "results";

export default function EvidenceSynthesisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const analysisId = id === "new" ? null : Number(id);
  const isNew = id === "new";

  const {
    data: analysis,
    isLoading,
    error,
  } = useEvidenceSynthesisAnalysis(analysisId);
  const deleteMutation = useDeleteEvidenceSynthesis();
  const executeMutation = useExecuteEvidenceSynthesis();

  const [activeTab, setActiveTab] = useState<Tab>("design");
  const [activeExecId, setActiveExecId] = useState<number | null>(null);

  // Auto-select latest completed execution
  useEffect(() => {
    if (analysis?.executions?.length && !activeExecId) {
      const completed = analysis.executions.find((e) => e.status === "completed");
      const latest = completed ?? analysis.executions[0];
      if (latest) setActiveExecId(latest.id);
    }
  }, [analysis?.executions, activeExecId]);

  const { data: activeExec } = useEvidenceSynthesisExecution(
    analysisId,
    activeExecId,
  );

  const handleDelete = () => {
    if (!analysisId) return;
    if (
      window.confirm(
        "Are you sure you want to delete this evidence synthesis?",
      )
    ) {
      deleteMutation.mutate(analysisId, {
        onSuccess: () => navigate("/analyses"),
      });
    }
  };

  const handleExecute = () => {
    if (!analysisId) return;
    executeMutation.mutate(analysisId, {
      onSuccess: (exec) => {
        setActiveExecId(exec.id);
        setActiveTab("results");
      },
    });
  };

  const isRunning =
    activeExec?.status === "running" ||
    activeExec?.status === "queued" ||
    activeExec?.status === "pending";

  if (isLoading && !isNew) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (!isNew && (error || !analysis)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-critical">
            Failed to load evidence synthesis
          </p>
          <button
            type="button"
            onClick={() => navigate("/analyses")}
            className="mt-4 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Back to analyses
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
            Analyses
          </button>
          <h1 className="text-2xl font-bold text-text-primary">
            {isNew ? "New Evidence Synthesis" : analysis?.name ?? "Evidence Synthesis"}
          </h1>
          {analysis?.description && (
            <p className="mt-1 text-sm text-text-muted">
              {analysis.description}
            </p>
          )}
        </div>

        {!isNew && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExecute}
              disabled={executeMutation.isPending || isRunning}
              className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
            >
              {executeMutation.isPending || isRunning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              Execute
            </button>

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
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Tab navigation */}
      {!isNew && (
        <div className="flex items-center gap-1 border-b border-border-default">
          {(
            [
              { key: "design" as const, label: "Design" },
              { key: "results" as const, label: "Results" },
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
      )}

      {/* Tab content */}
      {activeTab === "design" || isNew ? (
        <EvidenceSynthesisDesigner
          analysis={analysis}
          isNew={isNew}
          onSaved={(a) => {
            if (isNew) navigate(`/analyses/evidence-synthesis/${a.id}`);
          }}
        />
      ) : (
        <div className="space-y-6">
          <EvidenceSynthesisResults execution={activeExec ?? null} isLoading={!activeExec && !!activeExecId} />

          {/* Execution History */}
          {analysis?.executions && analysis.executions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                Execution History
              </h3>
              <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-overlay">
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                        Status
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                        Started
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                        Completed
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.executions.map((exec, i) => (
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
