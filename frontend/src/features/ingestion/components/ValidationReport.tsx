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
    color: "text-info",
  },
  conformance: {
    label: "Conformance",
    icon: CheckCircle2,
    color: "text-domain-observation",
  },
  plausibility: {
    label: "Plausibility",
    icon: AlertTriangle,
    color: "text-warning",
  },
};

const SEVERITY_META: Record<
  CheckSeverity,
  { label: string; bg: string; text: string }
> = {
  error: { label: "Error", bg: "bg-critical/15", text: "text-critical" },
  warning: {
    label: "Warning",
    bg: "bg-[#E5A84B]/15",
    text: "text-warning",
  },
  info: { label: "Info", bg: "bg-info/15", text: "text-info" },
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
    pct >= 90 ? "var(--success)" : pct >= 70 ? "#E5A84B" : "var(--critical)";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-default)"
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
      <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-surface-raised py-16">
        <Shield className="h-10 w-10 text-text-ghost mb-3" />
        <p className="text-sm text-text-muted">No validation results yet</p>
        <p className="mt-1 text-xs text-text-ghost">
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
        <div className="col-span-1 flex flex-col items-center justify-center rounded-xl border border-border-default bg-surface-raised py-6">
          <ScoreRing passed={passedChecks} total={totalChecks} size={96} />
          <span className="mt-2 text-sm text-text-muted">Overall Score</span>
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
              className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-surface-raised py-6"
            >
              <ScoreRing passed={catData.passed} total={catData.total} size={72} />
              <div className="mt-2 flex items-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5", meta.color)} />
                <span className="text-sm text-text-secondary">{meta.label}</span>
              </div>
              <span className="mt-0.5 text-xs text-text-ghost">
                {catData.passed}/{catData.total} passed
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary Bar */}
      <div className="flex items-center gap-6 rounded-xl border border-border-default bg-surface-raised px-6 py-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="text-sm font-['IBM_Plex_Mono',monospace] text-success">
            {passedChecks}
          </span>
          <span className="text-sm text-text-muted">Passed</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-critical" />
          <span className="text-sm font-['IBM_Plex_Mono',monospace] text-critical">
            {failedChecks}
          </span>
          <span className="text-sm text-text-muted">Failed</span>
        </div>
        <div className="flex-1">
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-overlay">
            {passedChecks > 0 && (
              <div
                className="bg-success transition-all"
                style={{ width: `${(passedChecks / totalChecks) * 100}%` }}
              />
            )}
            {failedChecks > 0 && (
              <div
                className="bg-critical transition-all"
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
              className="rounded-xl border border-border-default bg-surface-raised overflow-hidden"
            >
              <div className="flex items-center gap-3 border-b border-border-default bg-surface-overlay px-6 py-3">
                <Icon className={cn("h-4 w-4", meta.color)} />
                <h3 className="text-sm font-semibold text-text-primary">
                  {meta.label}
                </h3>
                <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-muted">
                  {categoryResults.length} checks
                </span>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-default text-xs text-text-ghost">
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
                <tbody className="divide-y divide-border-default">
                  {categoryResults.map((result) => {
                    const severity = SEVERITY_META[result.severity];

                    return (
                      <tr
                        key={result.id}
                        className={cn(
                          "text-sm transition",
                          result.passed
                            ? "hover:bg-surface-overlay"
                            : "bg-critical/5 hover:bg-critical/10",
                        )}
                      >
                        <td className="px-6 py-2.5">
                          {result.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <XCircle className="h-4 w-4 text-critical" />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div>
                            <span className="text-text-primary">
                              {result.check_name}
                            </span>
                            <p className="text-xs text-text-ghost mt-0.5">
                              {result.description}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-secondary">
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
                        <td className="px-3 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-xs text-text-secondary">
                          {result.violated_rows.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
                          {result.total_rows.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={cn(
                              "font-['IBM_Plex_Mono',monospace] text-xs",
                              result.violation_percentage === 0
                                ? "text-success"
                                : result.violation_percentage < 5
                                  ? "text-warning"
                                  : "text-critical",
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
