import { useState } from "react";
import { Loader2, Globe2, CheckCircle2, XCircle, Clock, Play, Eye, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useArachneNodes, useDistributeStudy, useArachneStatus, useArachneResults } from "../hooks/useArachne";
import type { ArachneSubmission } from "../types/study";

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

const SUBMISSION_STATUS_STYLE: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  PENDING: { bg: "#8A857D15", text: "#8A857D", icon: Clock },
  EXECUTING: { bg: "#F59E0B15", text: "#F59E0B", icon: Loader2 },
  COMPLETED: { bg: "#34D39915", text: "#34D399", icon: CheckCircle2 },
  FAILED: { bg: "#E85A6B15", text: "#E85A6B", icon: XCircle },
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
      <div className="flex items-center gap-2 py-3 px-4 text-xs text-[#8A857D]">
        <Loader2 size={12} className="animate-spin" /> Loading results...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-3 px-4 text-xs text-[#E85A6B]">
        Failed to load results: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div className="py-3 px-4">
      <pre className="text-xs text-[#C5C0B8] bg-[#0E0E11] rounded p-3 overflow-auto max-h-64">
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
          <Globe2 size={32} className="text-[#5A5650] mb-3" />
          <p className="text-sm text-[#8A857D] mb-1">
            {isConnectionError
              ? "Arachne Central is not reachable"
              : "Failed to load Arachne nodes"}
          </p>
          <p className="text-xs text-[#5A5650] max-w-md">
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
            <h3 className="text-sm font-semibold text-[#C5C0B8]">Available Data Nodes</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#8B5CF6]/40 bg-[#8B5CF6]/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#A78BFA]">
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
                ? "bg-[#9B1B30] text-white hover:bg-[#B52240]"
                : "bg-[#232328] text-[#5A5650] cursor-not-allowed",
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
            <Loader2 size={20} className="animate-spin text-[#8A857D]" />
          </div>
        ) : !nodes || nodes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[#5A5650]">
              No Arachne nodes configured. Set ARACHNE_URL in environment to enable federated
              execution.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#5A5650] border-b border-[#232328]">
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
                      "border-b border-[#1C1C20] cursor-pointer transition-colors",
                      selectedNodes.has(node.id)
                        ? "bg-[#9B1B30]/10"
                        : "hover:bg-[#1C1C20]",
                    )}
                  >
                    <td className="py-2.5 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedNodes.has(node.id)}
                        onChange={() => toggleNode(node.id)}
                        className="rounded border-[#5A5650]"
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-[#C5C0B8] font-medium">{node.name}</td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            node.status === "ONLINE" && "bg-[#34D399]",
                            node.status === "OFFLINE" && "bg-[#E85A6B]",
                            node.status === "UNKNOWN" && "bg-[#8A857D]",
                          )}
                        />
                        <span className="text-[#8A857D] text-xs">{node.status}</span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-[#8A857D]">{node.cdm_version ?? "-"}</td>
                    <td className="py-2.5 pr-3 text-right text-[#8A857D]">
                      {node.patient_count?.toLocaleString() ?? "-"}
                    </td>
                    <td className="py-2.5 text-[#5A5650] text-xs">
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
          <div className="mt-3 rounded-lg bg-[#E85A6B]/10 border border-[#E85A6B]/20 px-4 py-3 text-xs text-[#E85A6B]">
            Distribution failed:{" "}
            {distributeMutation.error instanceof Error
              ? distributeMutation.error.message
              : "Unknown error"}
          </div>
        )}

        {distributeMutation.isSuccess && (
          <div className="mt-3 rounded-lg bg-[#34D399]/10 border border-[#34D399]/20 px-4 py-3 text-xs text-[#34D399]">
            Study distributed successfully. Monitoring status below.
          </div>
        )}
      </div>

      {/* Section 2: Federated Executions */}
      <div className="panel">
        <h3 className="text-sm font-semibold text-[#C5C0B8] mb-4">Federated Executions</h3>

        {statusLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-[#8A857D]" />
          </div>
        ) : executions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[#5A5650]">
              No federated executions yet. Select data nodes above and distribute to begin.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {executions.map((execution) => (
              <div
                key={execution.id}
                className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden"
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#5A5650] font-mono">#{execution.id}</span>
                    <span className="text-xs text-[#8A857D]">
                      Arachne Analysis #{execution.arachne_analysis_id}
                    </span>
                  </div>
                  <span className="text-xs text-[#5A5650]">{execution.status}</span>
                </div>

                {execution.submissions.length > 0 && (
                  <div className="border-t border-[#1C1C20]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-[#5A5650]">
                          <th className="px-4 py-2">Node</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2">Submitted</th>
                          <th className="px-4 py-2">Completed</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {execution.submissions.map((sub: ArachneSubmission) => (
                          <tr key={sub.id} className="border-t border-[#1C1C20]">
                            <td className="px-4 py-2 text-[#C5C0B8]">{sub.node_name}</td>
                            <td className="px-4 py-2">
                              <SubmissionBadge status={sub.status} />
                            </td>
                            <td className="px-4 py-2 text-[#8A857D]">
                              {new Date(sub.submitted_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-[#8A857D]">
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
                                  className="text-[#2DD4BF] hover:text-[#5EEAD4] transition-colors"
                                >
                                  <Eye size={14} />
                                </button>
                              )}
                              {sub.status === "FAILED" && sub.error_message && (
                                <span
                                  className="text-[#E85A6B] cursor-help"
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
                  <div className="border-t border-[#1C1C20]">
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
