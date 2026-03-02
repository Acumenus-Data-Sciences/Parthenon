import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DqdCheckResult } from "../../types/dataExplorer";

interface DqdCheckDetailProps {
  check: DqdCheckResult;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  error: { bg: "bg-[#E85A6B]/15", text: "text-[#E85A6B]", label: "Error" },
  warning: { bg: "bg-[#E5A84B]/15", text: "text-[#E5A84B]", label: "Warning" },
  info: { bg: "bg-[#60A5FA]/15", text: "text-[#60A5FA]", label: "Info" },
};

export function DqdCheckDetail({ check }: DqdCheckDetailProps) {
  const severity = SEVERITY_STYLES[check.severity] ?? SEVERITY_STYLES.info;
  const violPct = check.violation_percentage;

  return (
    <div className="rounded-xl border border-[#232328] bg-[#151518] p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        {check.passed ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2DD4BF]" />
        ) : (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#E85A6B]" />
        )}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[#F0EDE8]">
            {check.check_id}
          </h3>
          <p className="mt-1 text-sm text-[#C5C0B8]">{check.description}</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium",
            severity.bg,
            severity.text,
          )}
        >
          {severity.label}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-4 rounded-lg bg-[#1A1A1E] p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-[#5A5650]">Status</p>
          <p
            className={cn(
              "mt-0.5 text-sm font-semibold",
              check.passed ? "text-[#2DD4BF]" : "text-[#E85A6B]",
            )}
          >
            {check.passed ? "Passed" : "Failed"}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#5A5650]">Table.Column</p>
          <p className="mt-0.5 font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
            {check.cdm_table}
            {check.cdm_column && `.${check.cdm_column}`}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#5A5650]">Violated Rows</p>
          <p className="mt-0.5 font-['IBM_Plex_Mono',monospace] text-sm text-[#F0EDE8]">
            {check.violated_rows.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#5A5650]">Total Rows</p>
          <p className="mt-0.5 font-['IBM_Plex_Mono',monospace] text-sm text-[#8A857D]">
            {check.total_rows.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Violation percentage bar */}
      {violPct != null && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#5A5650]">Violation Percentage</span>
            <span
              className={cn(
                "font-['IBM_Plex_Mono',monospace] text-xs font-semibold",
                violPct === 0
                  ? "text-[#2DD4BF]"
                  : violPct < 5
                    ? "text-[#E5A84B]"
                    : "text-[#E85A6B]",
              )}
            >
              {violPct.toFixed(2)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#232328]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(violPct, 100)}%`,
                backgroundColor:
                  violPct === 0
                    ? "#2DD4BF"
                    : violPct < 5
                      ? "#E5A84B"
                      : "#E85A6B",
              }}
            />
          </div>
        </div>
      )}

      {/* Threshold */}
      {check.threshold != null && (
        <div className="text-xs text-[#5A5650]">
          Threshold: <span className="text-[#C5C0B8]">{check.threshold}%</span>
        </div>
      )}

      {/* Execution time */}
      {check.execution_time_ms != null && (
        <div className="text-xs text-[#5A5650]">
          Execution time:{" "}
          <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
            {check.execution_time_ms}ms
          </span>
        </div>
      )}
    </div>
  );
}
