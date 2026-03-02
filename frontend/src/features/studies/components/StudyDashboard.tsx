import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExecutionStatusBadge } from "@/features/analyses/components/ExecutionStatusBadge";
import type { StudyAnalysisEntry, StudyProgress } from "../types/study";
import type { ExecutionStatus } from "@/features/analyses/types/analysis";

interface StudyDashboardProps {
  analyses?: StudyAnalysisEntry[];
  progress?: StudyProgress | null;
  isLoading?: boolean;
}

export function StudyDashboard({
  analyses,
  progress,
  isLoading,
}: StudyDashboardProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  const total = progress?.total ?? analyses?.length ?? 0;
  const completed = progress?.completed ?? 0;
  const running = progress?.running ?? 0;
  const failed = progress?.failed ?? 0;
  const pending = progress?.pending ?? total - completed - running - failed;
  const progressPct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="panel space-y-4">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Execution Progress
        </h3>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between" style={{ fontSize: "var(--text-xs)" }}>
            <span style={{ color: "var(--text-muted)" }}>
              {completed} of {total} analyses completed
            </span>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--primary)" }}>
              {progressPct.toFixed(0)}%
            </span>
          </div>
          <div className="progress-bar">
            <div className="flex h-full">
              {completed > 0 && (
                <div
                  style={{ width: `${(completed / total) * 100}%`, background: "var(--success)", transition: "width 300ms" }}
                />
              )}
              {running > 0 && (
                <div
                  style={{ width: `${(running / total) * 100}%`, background: "var(--warning)", transition: "width 300ms" }}
                />
              )}
              {failed > 0 && (
                <div
                  style={{ width: `${(failed / total) * 100}%`, background: "var(--critical)", transition: "width 300ms" }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total", value: total, color: "var(--text-primary)" },
            { label: "Pending", value: pending, color: "var(--text-muted)" },
            { label: "Running", value: running, color: "var(--warning)" },
            { label: "Completed", value: completed, color: "var(--success)" },
            { label: "Failed", value: failed, color: "var(--critical)" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="panel-inset text-center"
              style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)" }}
            >
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xl)", fontWeight: 700, color: stat.color }}>
                {stat.value}
              </p>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis List */}
      {analyses && analyses.length > 0 && (
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border-default)" }}>
            <h3 className="panel-title" style={{ fontSize: "var(--text-base)", marginBottom: 0 }}>
              Study Analyses
            </h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {analyses.map((entry) => {
                const latestExec = entry.analysis?.latest_execution;
                return (
                  <tr key={entry.id}>
                    <td>
                      <span
                        className={cn(
                          "badge",
                          entry.analysis_type === "estimation"
                            ? "badge-critical"
                            : entry.analysis_type === "prediction"
                              ? "badge-warning"
                              : "badge-info",
                        )}
                      >
                        {entry.analysis_type}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-primary)" }}>
                      {entry.analysis?.name ??
                        `Analysis #${entry.analysis_id}`}
                    </td>
                    <td>
                      {latestExec ? (
                        <ExecutionStatusBadge
                          status={latestExec.status as ExecutionStatus}
                        />
                      ) : (
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)" }}>
                          Not executed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(!analyses || analyses.length === 0) && (
        <div className="empty-state">
          <h3 className="empty-title">
            No analyses in this study
          </h3>
          <p className="empty-message">
            Add analyses in the Design tab to get started.
          </p>
        </div>
      )}
    </div>
  );
}
