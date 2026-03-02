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
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
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
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Execution Progress
        </h3>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8A857D]">
              {completed} of {total} analyses completed
            </span>
            <span className="font-['IBM_Plex_Mono',monospace] text-[#2DD4BF]">
              {progressPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[#0E0E11] overflow-hidden">
            <div className="flex h-full">
              {completed > 0 && (
                <div
                  className="bg-[#2DD4BF] transition-all"
                  style={{ width: `${(completed / total) * 100}%` }}
                />
              )}
              {running > 0 && (
                <div
                  className="bg-[#F59E0B] transition-all"
                  style={{ width: `${(running / total) * 100}%` }}
                />
              )}
              {failed > 0 && (
                <div
                  className="bg-[#E85A6B] transition-all"
                  style={{ width: `${(failed / total) * 100}%` }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3 text-center">
            <p className="font-['IBM_Plex_Mono',monospace] text-xl font-bold text-[#F0EDE8]">
              {total}
            </p>
            <p className="text-[10px] text-[#8A857D] uppercase tracking-wider">
              Total
            </p>
          </div>
          <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3 text-center">
            <p className="font-['IBM_Plex_Mono',monospace] text-xl font-bold text-[#8A857D]">
              {pending}
            </p>
            <p className="text-[10px] text-[#8A857D] uppercase tracking-wider">
              Pending
            </p>
          </div>
          <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3 text-center">
            <p className="font-['IBM_Plex_Mono',monospace] text-xl font-bold text-[#F59E0B]">
              {running}
            </p>
            <p className="text-[10px] text-[#8A857D] uppercase tracking-wider">
              Running
            </p>
          </div>
          <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3 text-center">
            <p className="font-['IBM_Plex_Mono',monospace] text-xl font-bold text-[#2DD4BF]">
              {completed}
            </p>
            <p className="text-[10px] text-[#8A857D] uppercase tracking-wider">
              Completed
            </p>
          </div>
          <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3 text-center">
            <p className="font-['IBM_Plex_Mono',monospace] text-xl font-bold text-[#E85A6B]">
              {failed}
            </p>
            <p className="text-[10px] text-[#8A857D] uppercase tracking-wider">
              Failed
            </p>
          </div>
        </div>
      </div>

      {/* Analysis List */}
      {analyses && analyses.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
          <div className="p-4 border-b border-[#232328]">
            <h3 className="text-sm font-semibold text-[#F0EDE8]">
              Study Analyses
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-[#1C1C20]">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Type
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Name
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {analyses.map((entry, i) => {
                const latestExec = entry.analysis?.latest_execution;
                return (
                  <tr
                    key={entry.id}
                    className={cn(
                      "border-t border-[#1C1C20]",
                      i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                    )}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          entry.analysis_type === "estimation"
                            ? "bg-[#9B1B30]/10 text-[#E85A6B]"
                            : entry.analysis_type === "prediction"
                              ? "bg-[#C9A227]/10 text-[#C9A227]"
                              : "bg-[#2DD4BF]/10 text-[#2DD4BF]",
                        )}
                      >
                        {entry.analysis_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#F0EDE8]">
                      {entry.analysis?.name ??
                        `Analysis #${entry.analysis_id}`}
                    </td>
                    <td className="px-4 py-3">
                      {latestExec ? (
                        <ExecutionStatusBadge
                          status={latestExec.status as ExecutionStatus}
                        />
                      ) : (
                        <span className="text-xs text-[#5A5650]">
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
          <h3 className="text-sm font-semibold text-[#F0EDE8]">
            No analyses in this study
          </h3>
          <p className="mt-1 text-xs text-[#8A857D]">
            Add analyses in the Design tab to get started.
          </p>
        </div>
      )}
    </div>
  );
}
