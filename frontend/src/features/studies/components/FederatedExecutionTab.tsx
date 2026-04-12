import { useState } from "react";
import { Loader2, Globe2, CheckCircle2, XCircle, Clock, Play, Eye, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useArachneNodes, useDistributeStudy, useArachneStatus, useArachneResults } from "../hooks/useArachne";
import type { ArachneSubmission } from "../types/study";

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

const SUBMISSION_STATUS_STYLE: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  PENDING: { bg: "color-mix(in srgb, var(--text-muted) 8%, transparent)", text: "var(--text-muted)", icon: Clock },
  EXECUTING: { bg: "#F59E0B15", text: "#F59E0B", icon: Loader2 },
  COMPLETED: { bg: "#34D39915", text: "#34D399", icon: CheckCircle2 },
  FAILED: { bg: "color-mix(in srgb, var(--critical) 8%, transparent)", text: "var(--critical)", icon: XCircle },
};

function SubmissionBadge({ status }: { status: string }) {
  const style = SUBMISSION_STATUS_STYLE[status] ?? SUBMISSION_STATUS_STYLE.PENDING;
  const Icon = style.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      <Icon size={12} className={status === "EXECUTING" ? "animate-spin" : ""} />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Results viewer (inline expansion)
// ---------------------------------------------------------------------------

function ResultsPreview({ studySlug, executionId }: { studySlug: string; executionId: number }) {
  const { data, isLoading, error } = useArachneResults(studySlug, executionId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-xs text-text-muted">
        <Loader2 size={12} className="animate-spin" /> Loading results...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-3 px-4 text-xs text-critical">
        Failed to load results: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div className="py-3 px-4">
      <pre className="text-xs text-text-secondary bg-surface-base rounded p-3 overflow-auto max-h-64">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FederatedExecutionTab({ studySlug }: { studySlug: string }) {
  const { data: nodes, isLoading: nodesLoading, error: nodesError } = useArachneNodes();
  const { data: statusData, isLoading: statusLoading } = useArachneStatus(studySlug);
  const distributeMutation = useDistributeStudy();

  const [selectedNodes, setSelectedNodes] = useState<Set<number>>(new Set());
  const [expandedExecution, setExpandedExecution] = useState<number | null>(null);

  const toggleNode = (nodeId: number) => {
    setSelectedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleDistribute = () => {
    if (selectedNodes.size === 0) return;
    if (!window.confirm(`Distribute study to ${selectedNodes.size} data node(s)?`)) return;

    distributeMutation.mutate({
      study_slug: studySlug,
      node_ids: Array.from(selectedNodes),
    });
  };

  const executions = statusData?.executions ?? [];

  // -------------------------------------------------------------------------
  // Empty / error states
  // -------------------------------------------------------------------------

  if (nodesError) {
    const message =
      nodesError instanceof Error ? nodesError.message : "Unknown error";
    const isConnectionError =
      message.includes("Unable to connect") || message.includes("502");

    return (
      <div className="panel">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Globe2 size={32} className="text-text-ghost mb-3" />
          <p className="text-sm text-text-muted mb-1">
            {isConnectionError
              ? "Arachne Central is not reachable"
              : "Failed to load Arachne nodes"}
          </p>
          <p className="text-xs text-text-ghost max-w-md">
            {isConnectionError
              ? "Set ARACHNE_URL in your environment to enable federated execution. Ensure Arachne Central is running and accessible."
              : message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Section 1: Available Data Nodes */}
      <div className="panel">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-secondary">Available Data Nodes</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-domain-observation/40 bg-[#8B5CF6]/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--domain-observation)]">
              <Sparkles className="h-3 w-3" />
              Powered by Arachne
            </span>
          </div>
          <button
            type="button"
            onClick={handleDistribute}
            disabled={selectedNodes.size === 0 || distributeMutation.isPending}
            className={cn(
              "btn btn-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              selectedNodes.size > 0
                ? "bg-primary text-white hover:bg-primary-dark"
                : "bg-surface-elevated text-text-ghost cursor-not-allowed",
            )}
          >
            {distributeMutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Distribute ({selectedNodes.size})
          </button>
        </div>

        {nodesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : !nodes || nodes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-text-ghost">
              No Arachne nodes configured. Set ARACHNE_URL in environment to enable federated
              execution.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-text-ghost border-b border-border-default">
                  <th className="pb-2 pr-3 w-8" />
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">CDM Version</th>
                  <th className="pb-2 pr-3 text-right">Patients</th>
                  <th className="pb-2">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node) => (
                  <tr
                    key={node.id}
                    onClick={() => toggleNode(node.id)}
                    className={cn(
                      "border-b border-surface-overlay cursor-pointer transition-colors",
                      selectedNodes.has(node.id)
                        ? "bg-primary/10"
                        : "hover:bg-surface-overlay",
                    )}
                  >
                    <td className="py-2.5 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedNodes.has(node.id)}
                        onChange={() => toggleNode(node.id)}
                        className="rounded border-text-ghost"
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-text-secondary font-medium">{node.name}</td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            node.status === "ONLINE" && "bg-[#34D399]",
                            node.status === "OFFLINE" && "bg-critical",
                            node.status === "UNKNOWN" && "bg-text-muted",
                          )}
                        />
                        <span className="text-text-muted text-xs">{node.status}</span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-text-muted">{node.cdm_version ?? "-"}</td>
                    <td className="py-2.5 pr-3 text-right text-text-muted">
                      {node.patient_count?.toLocaleString() ?? "-"}
                    </td>
                    <td className="py-2.5 text-text-ghost text-xs">
                      {node.last_seen_at
                        ? new Date(node.last_seen_at).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {distributeMutation.isError && (
          <div className="mt-3 rounded-lg bg-critical/10 border border-critical/20 px-4 py-3 text-xs text-critical">
            Distribution failed:{" "}
            {distributeMutation.error instanceof Error
              ? distributeMutation.error.message
              : "Unknown error"}
          </div>
        )}

        {distributeMutation.isSuccess && (
          <div className="mt-3 rounded-lg bg-[#34D399]/10 border border-[#34D399]/20 px-4 py-3 text-xs text-success">
            Study distributed successfully. Monitoring status below.
          </div>
        )}
      </div>

      {/* Section 2: Federated Executions */}
      <div className="panel">
        <h3 className="text-sm font-semibold text-text-secondary mb-4">Federated Executions</h3>

        {statusLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : executions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-text-ghost">
              No federated executions yet. Select data nodes above and distribute to begin.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {executions.map((execution) => (
              <div
                key={execution.id}
                className="rounded-lg border border-border-default bg-surface-raised overflow-hidden"
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-ghost font-mono">#{execution.id}</span>
                    <span className="text-xs text-text-muted">
                      Arachne Analysis #{execution.arachne_analysis_id}
                    </span>
                  </div>
                  <span className="text-xs text-text-ghost">{execution.status}</span>
                </div>

                {execution.submissions.length > 0 && (
                  <div className="border-t border-surface-overlay">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-text-ghost">
                          <th className="px-4 py-2">Node</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2">Submitted</th>
                          <th className="px-4 py-2">Completed</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {execution.submissions.map((sub: ArachneSubmission) => (
                          <tr key={sub.id} className="border-t border-surface-overlay">
                            <td className="px-4 py-2 text-text-secondary">{sub.node_name}</td>
                            <td className="px-4 py-2">
                              <SubmissionBadge status={sub.status} />
                            </td>
                            <td className="px-4 py-2 text-text-muted">
                              {new Date(sub.submitted_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-text-muted">
                              {sub.completed_at
                                ? new Date(sub.completed_at).toLocaleString()
                                : "-"}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {sub.status === "COMPLETED" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedExecution(
                                      expandedExecution === execution.id ? null : execution.id,
                                    )
                                  }
                                  className="text-success hover:text-[#5EEAD4] transition-colors"
                                >
                                  <Eye size={14} />
                                </button>
                              )}
                              {sub.status === "FAILED" && sub.error_message && (
                                <span
                                  className="text-critical cursor-help"
                                  title={sub.error_message}
                                >
                                  <XCircle size={14} />
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {expandedExecution === execution.id && (
                  <div className="border-t border-surface-overlay">
                    <ResultsPreview studySlug={studySlug} executionId={execution.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
