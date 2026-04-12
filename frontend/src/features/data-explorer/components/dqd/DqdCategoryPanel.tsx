import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DqdCheckResult } from "../../types/dataExplorer";

interface DqdCategoryPanelProps {
  category: string;
  checks: DqdCheckResult[];
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  error: { bg: "bg-critical/15", text: "text-critical", label: "Error" },
  warning: { bg: "bg-[#E5A84B]/15", text: "text-warning", label: "Warning" },
  info: { bg: "bg-info/15", text: "text-info", label: "Info" },
};

const CATEGORY_LABELS: Record<string, string> = {
  completeness: "Completeness",
  conformance: "Conformance",
  plausibility: "Plausibility",
};

export function DqdCategoryPanel({ category, checks }: DqdCategoryPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const passRate = total > 0 ? (passed / total) * 100 : 0;

  const passRateColor =
    passRate >= 90 ? "text-success" : passRate >= 70 ? "text-warning" : "text-critical";

  const label = CATEGORY_LABELS[category] ?? category;

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 border-b border-border-default bg-surface-overlay px-6 py-3 text-left hover:bg-[#1E1E22] transition-colors"
      >
        {expanded ? (
          <ChevronDown size={16} className="text-text-muted" />
        ) : (
          <ChevronRight size={16} className="text-text-muted" />
        )}
        <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
        <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-muted">
          {total} checks
        </span>
        <span className={cn("ml-auto font-['IBM_Plex_Mono',monospace] text-sm font-semibold", passRateColor)}>
          {passRate.toFixed(0)}% pass rate
        </span>
        <span className="text-xs text-text-ghost">
          ({passed}/{total})
        </span>
      </button>

      {/* Check list */}
      {expanded && (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default text-xs text-text-ghost">
              <th className="px-6 py-2 text-left font-medium w-8" />
              <th className="px-3 py-2 text-left font-medium">Check</th>
              <th className="px-3 py-2 text-left font-medium">Table</th>
              <th className="px-3 py-2 text-left font-medium">Column</th>
              <th className="px-3 py-2 text-left font-medium">Severity</th>
              <th className="px-3 py-2 text-right font-medium">Violation %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {checks.map((check) => {
              const severity = SEVERITY_STYLES[check.severity] ?? SEVERITY_STYLES.info;
              const violPct = check.violation_percentage;

              return (
                <tr
                  key={check.id}
                  className={cn(
                    "text-sm transition",
                    check.passed
                      ? "hover:bg-surface-overlay"
                      : "bg-critical/5 hover:bg-critical/10",
                  )}
                >
                  <td className="px-6 py-2.5">
                    {check.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-critical" />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div>
                      <span className="text-text-primary">{check.check_id}</span>
                      <p className="mt-0.5 text-xs text-text-ghost">
                        {check.description}
                      </p>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-secondary">
                      {check.cdm_table}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
                      {check.cdm_column ?? "--"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                        severity.bg,
                        severity.text,
                      )}
                    >
                      {severity.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {violPct != null && (
                        <>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-elevated">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(violPct, 100)}%`,
                                backgroundColor:
                                  violPct === 0
                                    ? "var(--success)"
                                    : violPct < 5
                                      ? "#E5A84B"
                                      : "var(--critical)",
                              }}
                            />
                          </div>
                          <span
                            className={cn(
                              "font-['IBM_Plex_Mono',monospace] text-xs min-w-[40px] text-right",
                              violPct === 0
                                ? "text-success"
                                : violPct < 5
                                  ? "text-warning"
                                  : "text-critical",
                            )}
                          >
                            {violPct.toFixed(1)}%
                          </span>
                        </>
                      )}
                      {violPct == null && (
                        <span className="text-xs text-text-ghost">--</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
