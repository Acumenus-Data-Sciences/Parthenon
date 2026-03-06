import { useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ValidationResult,
  ValidationSummary,
  CheckCategory,
  CheckSeverity,
} from "@/types/ingestion";

interface ValidationReportProps {
  results: ValidationResult[];
  summary: ValidationSummary | null;
}

const CATEGORY_META: Record<
  CheckCategory,
  { label: string; icon: typeof Shield; color: string }
> = {
  completeness: {
    label: "Completeness",
    icon: Shield,
    color: "text-[#60A5FA]",
  },
  conformance: {
    label: "Conformance",
    icon: CheckCircle2,
    color: "text-[#A855F7]",
  },
  plausibility: {
    label: "Plausibility",
    icon: AlertTriangle,
    color: "text-[#E5A84B]",
  },
};

const SEVERITY_META: Record<
  CheckSeverity,
  { label: string; bg: string; text: string }
> = {
  error: { label: "Error", bg: "bg-[#E85A6B]/15", text: "text-[#E85A6B]" },
  warning: {
    label: "Warning",
    bg: "bg-[#E5A84B]/15",
    text: "text-[#E5A84B]",
  },
  info: { label: "Info", bg: "bg-[#60A5FA]/15", text: "text-[#60A5FA]" },
};

function ScoreRing({
  passed,
  total,
  size = 80,
}: {
  passed: number;
  total: number;
  size?: number;
}) {
  const pct = total > 0 ? (passed / total) * 100 : 0;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color =
    pct >= 90 ? "#2DD4BF" : pct >= 70 ? "#E5A84B" : "#E85A6B";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#232328"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-lg font-semibold font-['IBM_Plex_Mono',monospace]"
          style={{ color }}
        >
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

export function ValidationReport({ results, summary }: ValidationReportProps) {
  const groupedResults = useMemo(() => {
    const groups: Record<CheckCategory, ValidationResult[]> = {
      completeness: [],
      conformance: [],
      plausibility: [],
    };
    for (const r of results) {
      if (groups[r.check_category]) {
        groups[r.check_category].push(r);
      }
    }
    return groups;
  }, [results]);

  if (!summary && results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-16">
        <Shield className="h-10 w-10 text-[#5A5650] mb-3" />
        <p className="text-sm text-[#8A857D]">No validation results yet</p>
        <p className="mt-1 text-xs text-[#5A5650]">
          Validation runs after CDM data writing completes
        </p>
      </div>
    );
  }

  const totalChecks = summary?.total_checks ?? results.length;
  const passedChecks = summary?.passed ?? results.filter((r) => r.passed).length;
  const failedChecks = summary?.failed ?? results.filter((r) => !r.passed).length;

  return (
    <div className="space-y-6">
      {/* Scorecard */}
      <div className="grid grid-cols-4 gap-4">
        {/* Overall Score */}
        <div className="col-span-1 flex flex-col items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-6">
          <ScoreRing passed={passedChecks} total={totalChecks} size={96} />
          <span className="mt-2 text-sm text-[#8A857D]">Overall Score</span>
        </div>

        {/* Category Scores */}
        {(
          Object.entries(CATEGORY_META) as [
            CheckCategory,
            (typeof CATEGORY_META)[CheckCategory],
          ][]
        ).map(([category, meta]) => {
          const catData = summary?.by_category?.[category] ?? {
            passed: groupedResults[category]?.filter((r) => r.passed).length ?? 0,
            failed: groupedResults[category]?.filter((r) => !r.passed).length ?? 0,
            total: groupedResults[category]?.length ?? 0,
          };
          const Icon = meta.icon;

          return (
            <div
              key={category}
              className="flex flex-col items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-6"
            >
              <ScoreRing passed={catData.passed} total={catData.total} size={72} />
              <div className="mt-2 flex items-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5", meta.color)} />
                <span className="text-sm text-[#C5C0B8]">{meta.label}</span>
              </div>
              <span className="mt-0.5 text-xs text-[#5A5650]">
                {catData.passed}/{catData.total} passed
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary Bar */}
      <div className="flex items-center gap-6 rounded-xl border border-[#232328] bg-[#151518] px-6 py-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#2DD4BF]" />
          <span className="text-sm font-['IBM_Plex_Mono',monospace] text-[#2DD4BF]">
            {passedChecks}
          </span>
          <span className="text-sm text-[#8A857D]">Passed</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-[#E85A6B]" />
          <span className="text-sm font-['IBM_Plex_Mono',monospace] text-[#E85A6B]">
            {failedChecks}
          </span>
          <span className="text-sm text-[#8A857D]">Failed</span>
        </div>
        <div className="flex-1">
          <div className="flex h-2 overflow-hidden rounded-full bg-[#1A1A1E]">
            {passedChecks > 0 && (
              <div
                className="bg-[#2DD4BF] transition-all"
                style={{ width: `${(passedChecks / totalChecks) * 100}%` }}
              />
            )}
            {failedChecks > 0 && (
              <div
                className="bg-[#E85A6B] transition-all"
                style={{ width: `${(failedChecks / totalChecks) * 100}%` }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Check Results by Category */}
      {(Object.entries(CATEGORY_META) as [CheckCategory, (typeof CATEGORY_META)[CheckCategory]][]).map(
        ([category, meta]) => {
          const categoryResults = groupedResults[category];
          if (!categoryResults?.length) return null;

          const Icon = meta.icon;

          return (
            <div
              key={category}
              className="rounded-xl border border-[#232328] bg-[#151518] overflow-hidden"
            >
              <div className="flex items-center gap-3 border-b border-[#232328] bg-[#1A1A1E] px-6 py-3">
                <Icon className={cn("h-4 w-4", meta.color)} />
                <h3 className="text-sm font-semibold text-[#F0EDE8]">
                  {meta.label}
                </h3>
                <span className="rounded-full bg-[#232328] px-2 py-0.5 text-xs text-[#8A857D]">
                  {categoryResults.length} checks
                </span>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#232328] text-xs text-[#5A5650]">
                    <th className="px-6 py-2 text-left font-medium w-8" />
                    <th className="px-3 py-2 text-left font-medium">Check</th>
                    <th className="px-3 py-2 text-left font-medium">Table</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Severity
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Violated
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232328]">
                  {categoryResults.map((result) => {
                    const severity = SEVERITY_META[result.severity];

                    return (
                      <tr
                        key={result.id}
                        className={cn(
                          "text-sm transition",
                          result.passed
                            ? "hover:bg-[#1A1A1E]"
                            : "bg-[#E85A6B]/5 hover:bg-[#E85A6B]/10",
                        )}
                      >
                        <td className="px-6 py-2.5">
                          {result.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-[#2DD4BF]" />
                          ) : (
                            <XCircle className="h-4 w-4 text-[#E85A6B]" />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div>
                            <span className="text-[#F0EDE8]">
                              {result.check_name}
                            </span>
                            <p className="text-xs text-[#5A5650] mt-0.5">
                              {result.description}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                            {result.cdm_table}
                            {result.cdm_column && `.${result.cdm_column}`}
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
                        <td className="px-3 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                          {result.violated_rows.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
                          {result.total_rows.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={cn(
                              "font-['IBM_Plex_Mono',monospace] text-xs",
                              result.violation_percentage === 0
                                ? "text-[#2DD4BF]"
                                : result.violation_percentage < 5
                                  ? "text-[#E5A84B]"
                                  : "text-[#E85A6B]",
                            )}
                          >
                            {result.violation_percentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        },
      )}
    </div>
  );
}
