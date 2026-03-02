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
  error: { bg: "bg-[#E85A6B]/15", text: "text-[#E85A6B]", label: "Error" },
  warning: { bg: "bg-[#E5A84B]/15", text: "text-[#E5A84B]", label: "Warning" },
  info: { bg: "bg-[#60A5FA]/15", text: "text-[#60A5FA]", label: "Info" },
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
    passRate >= 90 ? "text-[#2DD4BF]" : passRate >= 70 ? "text-[#E5A84B]" : "text-[#E85A6B]";

  const label = CATEGORY_LABELS[category] ?? category;

  return (
    <div className="rounded-xl border border-[#232328] bg-[#151518] overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 border-b border-[#232328] bg-[#1A1A1E] px-6 py-3 text-left hover:bg-[#1E1E22] transition-colors"
      >
        {expanded ? (
          <ChevronDown size={16} className="text-[#8A857D]" />
        ) : (
          <ChevronRight size={16} className="text-[#8A857D]" />
        )}
        <h3 className="text-sm font-semibold text-[#F0EDE8]">{label}</h3>
        <span className="rounded-full bg-[#232328] px-2 py-0.5 text-xs text-[#8A857D]">
          {total} checks
        </span>
        <span className={cn("ml-auto font-['IBM_Plex_Mono',monospace] text-sm font-semibold", passRateColor)}>
          {passRate.toFixed(0)}% pass rate
        </span>
        <span className="text-xs text-[#5A5650]">
          ({passed}/{total})
        </span>
      </button>

      {/* Check list */}
      {expanded && (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#232328] text-xs text-[#5A5650]">
              <th className="px-6 py-2 text-left font-medium w-8" />
              <th className="px-3 py-2 text-left font-medium">Check</th>
              <th className="px-3 py-2 text-left font-medium">Table</th>
              <th className="px-3 py-2 text-left font-medium">Column</th>
              <th className="px-3 py-2 text-left font-medium">Severity</th>
              <th className="px-3 py-2 text-right font-medium">Violation %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#232328]">
            {checks.map((check) => {
              const severity = SEVERITY_STYLES[check.severity] ?? SEVERITY_STYLES.info;
              const violPct = check.violation_percentage;

              return (
                <tr
                  key={check.id}
                  className={cn(
                    "text-sm transition",
                    check.passed
                      ? "hover:bg-[#1A1A1E]"
                      : "bg-[#E85A6B]/5 hover:bg-[#E85A6B]/10",
                  )}
                >
                  <td className="px-6 py-2.5">
                    {check.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-[#2DD4BF]" />
                    ) : (
                      <XCircle className="h-4 w-4 text-[#E85A6B]" />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div>
                      <span className="text-[#F0EDE8]">{check.check_id}</span>
                      <p className="mt-0.5 text-xs text-[#5A5650]">
                        {check.description}
                      </p>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                      {check.cdm_table}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
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
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#232328]">
                            <div
                              className="h-full rounded-full transition-all"
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
                          <span
                            className={cn(
                              "font-['IBM_Plex_Mono',monospace] text-xs min-w-[40px] text-right",
                              violPct === 0
                                ? "text-[#2DD4BF]"
                                : violPct < 5
                                  ? "text-[#E5A84B]"
                                  : "text-[#E85A6B]",
                            )}
                          >
                            {violPct.toFixed(1)}%
                          </span>
                        </>
                      )}
                      {violPct == null && (
                        <span className="text-xs text-[#5A5650]">--</span>
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
