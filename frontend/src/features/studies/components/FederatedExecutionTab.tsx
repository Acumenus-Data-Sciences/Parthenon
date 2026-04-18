import { useState } from "react";
import { Loader2, Globe2, CheckCircle2, XCircle, Clock, Play, Eye, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDate, formatDateTime, formatNumber } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { useArachneNodes, useDistributeStudy, useArachneStatus, useArachneResults } from "../hooks/useArachne";
import type { ArachneSubmission } from "../types/study";

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

const SUBMISSION_STATUS_STYLE: Record<string, { bg: string; fg: string; icon: typeof Clock }> = {
  PENDING: { bg: "#8A857D15", fg: "var(--text-muted)", icon: Clock },
  EXECUTING: { bg: "#F59E0B15", fg: "var(--warning)", icon: Loader2 },
  COMPLETED: { bg: "#34D39915", fg: "var(--success)", icon: CheckCircle2 },
  FAILED: { bg: "#E85A6B15", fg: "var(--critical)", icon: XCircle },
};

function SubmissionBadge({ status }: { status: string }) {
  const { t } = useTranslation("app");
  const style = SUBMISSION_STATUS_STYLE[status] ?? SUBMISSION_STATUS_STYLE.PENDING;
  const Icon = style.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      <Icon size={12} className={status === "EXECUTING" ? "animate-spin" : ""} />
      {t(`studies.federated.statuses.${status}`, { defaultValue: status })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Results viewer (inline expansion)
// ---------------------------------------------------------------------------

function ResultsPreview({ studySlug, executionId }: { studySlug: string; executionId: number }) {
  const { t } = useTranslation("app");
  const { data, isLoading, error } = useArachneResults(studySlug, executionId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-xs text-text-muted">
        <Loader2 size={12} className="animate-spin" /> {t("studies.federated.loadingResults")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-3 px-4 text-xs text-critical">
        {t("studies.federated.loadResultsFailed", {
          error: error instanceof Error ? error.message : t("studies.federated.unknownError"),
        })}
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
  const { t } = useTranslation("app");
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
    if (!window.confirm(t("studies.federated.confirmDistribute", { count: selectedNodes.size }))) return;

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
      nodesError instanceof Error ? nodesError.message : t("studies.federated.unknownError");
    const isConnectionError =
      message.includes("Unable to connect") || message.includes("502");

    return (
      <div className="panel">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Globe2 size={32} className="text-text-ghost mb-3" />
          <p className="text-sm text-text-muted mb-1">
            {isConnectionError
              ? t("studies.federated.arachneNotReachable")
              : t("studies.federated.loadNodesFailed")}
          </p>
          <p className="text-xs text-text-ghost max-w-md">
            {isConnectionError
              ? t("studies.federated.arachneConnectionHelp")
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
            <h3 className="text-sm font-semibold text-text-secondary">
              {t("studies.federated.availableDataNodes")}
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-domain-observation/40 bg-domain-observation/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-domain-observation">
              <Sparkles className="h-3 w-3" />
              {t("studies.federated.poweredByArachne")}
            </span>
          </div>
          <button
            type="button"
            onClick={handleDistribute}
            disabled={selectedNodes.size === 0 || distributeMutation.isPending}
            className={cn(
              "btn btn-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              selectedNodes.size > 0
                ? "bg-primary text-primary-foreground hover:bg-primary-light"
                : "bg-surface-elevated text-text-ghost cursor-not-allowed",
            )}
          >
            {distributeMutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            {t("studies.federated.distributeCount", { count: selectedNodes.size })}
          </button>
        </div>

        {nodesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : !nodes || nodes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-text-ghost">
              {t("studies.federated.noNodes")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-text-ghost border-b border-border-default">
                  <th className="pb-2 pr-3 w-8" />
                  <th className="pb-2 pr-3">{t("studies.federated.table.name")}</th>
                  <th className="pb-2 pr-3">{t("studies.federated.table.status")}</th>
                  <th className="pb-2 pr-3">{t("studies.federated.table.cdmVersion")}</th>
                  <th className="pb-2 pr-3 text-right">{t("studies.federated.table.patients")}</th>
                  <th className="pb-2">{t("studies.federated.table.lastSeen")}</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node) => (
                  <tr
                    key={node.id}
                    onClick={() => toggleNode(node.id)}
                    className={cn(
                      "border-b border-border-subtle cursor-pointer transition-colors",
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
                            node.status === "ONLINE" && "bg-success",
                            node.status === "OFFLINE" && "bg-critical",
                            node.status === "UNKNOWN" && "bg-text-muted",
                          )}
                        />
                        <span className="text-text-muted text-xs">{node.status}</span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-text-muted">{node.cdm_version ?? "-"}</td>
                    <td className="py-2.5 pr-3 text-right text-text-muted">
                      {node.patient_count != null ? formatNumber(node.patient_count) : "-"}
                    </td>
                    <td className="py-2.5 text-text-ghost text-xs">
                      {node.last_seen_at
                        ? formatDate(node.last_seen_at)
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
            {t("studies.federated.distributionFailed", {
              error: distributeMutation.error instanceof Error
                ? distributeMutation.error.message
                : t("studies.federated.unknownError"),
            })}
          </div>
        )}

        {distributeMutation.isSuccess && (
          <div className="mt-3 rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-xs text-success">
            {t("studies.federated.distributionSucceeded")}
          </div>
        )}
      </div>

      {/* Section 2: Federated Executions */}
      <div className="panel">
        <h3 className="text-sm font-semibold text-text-secondary mb-4">
          {t("studies.federated.federatedExecutions")}
        </h3>

        {statusLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : executions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-text-ghost">
              {t("studies.federated.noExecutions")}
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
                      {t("studies.federated.arachneAnalysis", { id: execution.arachne_analysis_id })}
                    </span>
                  </div>
                  <span className="text-xs text-text-ghost">{execution.status}</span>
                </div>

                {execution.submissions.length > 0 && (
                  <div className="border-t border-border-subtle">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-text-ghost">
                          <th className="px-4 py-2">{t("studies.federated.table.node")}</th>
                          <th className="px-4 py-2">{t("studies.federated.table.status")}</th>
                          <th className="px-4 py-2">{t("studies.federated.table.submitted")}</th>
                          <th className="px-4 py-2">{t("studies.federated.table.completed")}</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {execution.submissions.map((sub: ArachneSubmission) => (
                          <tr key={sub.id} className="border-t border-border-subtle">
                            <td className="px-4 py-2 text-text-secondary">{sub.node_name}</td>
                            <td className="px-4 py-2">
                              <SubmissionBadge status={sub.status} />
                            </td>
                            <td className="px-4 py-2 text-text-muted">
                              {formatDateTime(sub.submitted_at)}
                            </td>
                            <td className="px-4 py-2 text-text-muted">
                              {sub.completed_at
                                ? formatDateTime(sub.completed_at)
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
                                  className="text-success hover:text-success-light transition-colors"
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
                  <div className="border-t border-border-subtle">
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
