import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Play,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { IncidenceRateDesigner } from "../components/IncidenceRateDesigner";
import { IncidenceRateResults } from "../components/IncidenceRateResults";
import { ExecutionStatusBadge } from "../components/ExecutionStatusBadge";
import {
  useIncidenceRate,
  useDeleteIncidenceRate,
  useExecuteIncidenceRate,
  useIncidenceRateExecutions,
  useIncidenceRateExecution,
} from "../hooks/useIncidenceRates";

type Tab = "design" | "results";

export default function IncidenceRateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const irId = id ? Number(id) : null;

  const {
    data: analysis,
    isLoading,
    error,
  } = useIncidenceRate(irId);
  const deleteMutation = useDeleteIncidenceRate();
  const executeMutation = useExecuteIncidenceRate();

  const { data: executions } = useIncidenceRateExecutions(irId);

  const [activeTab, setActiveTab] = useState<Tab>("design");
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [activeExecId, setActiveExecId] = useState<number | null>(null);

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const { data: activeExec } = useIncidenceRateExecution(
    irId,
    activeExecId,
  );

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

  const handleDelete = () => {
    if (!irId) return;
    if (
      window.confirm(
        "Are you sure you want to delete this incidence rate analysis?",
      )
    ) {
      deleteMutation.mutate(irId, {
        onSuccess: () => navigate("/analyses"),
      });
    }
  };

  const handleExecute = () => {
    if (!irId || !sourceId) return;
    executeMutation.mutate(
      { id: irId, sourceId },
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p style={{ color: "var(--critical)" }}>
            Failed to load incidence rate analysis
          </p>
          <button
            type="button"
            onClick={() => navigate("/analyses")}
            className="btn btn-ghost btn-sm mt-4"
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
      <div className="page-header">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/analyses")}
            className="btn btn-ghost btn-sm mb-3"
          >
            <ArrowLeft size={14} />
            Analyses
          </button>
          <h1 className="page-title">
            {analysis.name}
          </h1>
          {analysis.description && (
            <p className="page-subtitle">
              {analysis.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Database
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-ghost)" }}
              />
              <select
                value={sourceId ?? ""}
                onChange={(e) =>
                  setSourceId(Number(e.target.value) || null)
                }
                disabled={loadingSources}
                className="form-input form-select"
                style={{ paddingLeft: "2rem" }}
              >
                <option value="">Source</option>
                {sources?.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.source_name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleExecute}
              disabled={
                !sourceId ||
                executeMutation.isPending ||
                isRunning
              }
              className="btn btn-primary btn-sm"
            >
              {executeMutation.isPending || isRunning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              Execute
            </button>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="btn btn-danger btn-sm"
          >
            {deleteMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Delete
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="tab-bar">
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
            className={cn("tab-item", activeTab === tab.key && "active")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "design" ? (
        <IncidenceRateDesigner analysis={analysis} />
      ) : (
        <div className="space-y-6">
          <IncidenceRateResults execution={activeExec} />

          {executions && executions.length > 0 && (
            <div>
              <h3 className="panel-title" style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-3)" }}>
                Execution History
              </h3>
              <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Source</th>
                      <th>Started</th>
                      <th>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map((exec) => (
                      <tr
                        key={exec.id}
                        onClick={() => {
                          if (exec.status === "completed") {
                            setActiveExecId(exec.id);
                          }
                        }}
                        className={cn(
                          exec.status === "completed" && "clickable",
                          activeExecId === exec.id && "selected",
                        )}
                      >
                        <td>
                          <ExecutionStatusBadge
                            status={exec.status}
                          />
                        </td>
                        <td>Source #{exec.source_id}</td>
                        <td>
                          {exec.started_at
                            ? new Date(exec.started_at).toLocaleString()
                            : "--"}
                        </td>
                        <td>
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
