import { useMemo } from "react";
import { Shield, ShieldAlert, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { TableProfile } from "../api";
import { getProfilerScorecardCheckLabel } from "../lib/i18n";
import { fmtNumberFull, overallGrade } from "../lib/profiler-utils";

export function DataQualityScorecard({ tables, piiColumnCount }: { tables: TableProfile[]; piiColumnCount?: number }) {
  const { t } = useTranslation("app");
  const stats = useMemo(() => {
    const totalCols = tables.reduce((s, t) => s + t.columns.length, 0);
    const highNullCols = tables.reduce(
      (s, t) => s + t.columns.filter((c) => c.fraction_empty > 0.5).length,
      0,
    );
    const emptyCols = tables.reduce(
      (s, t) => s + t.columns.filter((c) => c.fraction_empty >= 0.99).length,
      0,
    );
    const lowCardCols = tables.reduce(
      (s, t) =>
        s + t.columns.filter((c) => c.unique_count < 5 && c.n_rows > 100).length,
      0,
    );
    const singleValueCols = tables.reduce(
      (s, t) =>
        s + t.columns.filter((c) => c.unique_count === 1 && c.n_rows > 0).length,
      0,
    );
    const emptyTables = tables.filter((t) => t.row_count === 0).length;

    return {
      totalCols,
      highNullCols,
      emptyCols,
      lowCardCols,
      singleValueCols,
      emptyTables,
    };
  }, [tables]);

  const grade = overallGrade(tables);

  const checks = [
    {
      label: getProfilerScorecardCheckLabel(t, "highNull"),
      count: stats.highNullCols,
      total: stats.totalCols,
      severity: stats.highNullCols > 0 ? "warn" : "ok",
    },
    {
      label: getProfilerScorecardCheckLabel(t, "nearlyEmpty"),
      count: stats.emptyCols,
      total: stats.totalCols,
      severity: stats.emptyCols > 0 ? "error" : "ok",
    },
    {
      label: getProfilerScorecardCheckLabel(t, "lowCardinality"),
      count: stats.lowCardCols,
      total: stats.totalCols,
      severity: stats.lowCardCols > 3 ? "info" : "ok",
    },
    {
      label: getProfilerScorecardCheckLabel(t, "singleValue"),
      count: stats.singleValueCols,
      total: stats.totalCols,
      severity: stats.singleValueCols > 0 ? "warn" : "ok",
    },
    {
      label: getProfilerScorecardCheckLabel(t, "emptyTables"),
      count: stats.emptyTables,
      total: tables.length,
      severity: stats.emptyTables > 0 ? "error" : "ok",
    },
    ...(piiColumnCount && piiColumnCount > 0
      ? [
          {
            label: getProfilerScorecardCheckLabel(t, "pii"),
            count: piiColumnCount,
            total: stats.totalCols,
            severity: "pii" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <div className="px-4 py-3 bg-surface-overlay border-b border-border-default flex items-center gap-2">
        <Shield size={15} className="text-text-muted" />
        <h4 className="text-sm font-medium text-text-primary">
          {t("etl.profiler.scorecard.title")}
        </h4>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold"
            style={{ backgroundColor: grade.bg, color: grade.color }}
          >
            {grade.letter}
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">
              {t("etl.profiler.scorecard.overall")}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {t("etl.profiler.scorecard.basedOnAverage", {
                columns: fmtNumberFull(stats.totalCols),
                tables: tables.length,
              })}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {checks.map((check) => (
            <div
              key={check.label}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-overlay"
            >
              <div className="flex items-center gap-2">
                {check.severity === "ok" && (
                  <CheckCircle2 size={14} className="text-success" />
                )}
                {check.severity === "warn" && (
                  <AlertTriangle size={14} className="text-accent" />
                )}
                {check.severity === "error" && (
                  <AlertTriangle size={14} className="text-critical" />
                )}
                {check.severity === "info" && (
                  <Info size={14} className="text-info" />
                )}
                {check.severity === "pii" && (
                  <ShieldAlert size={14} className="text-amber-400" />
                )}
                <span className="text-xs text-text-secondary">{check.label}</span>
              </div>
              <span
                className={cn(
                  "text-xs font-mono tabular-nums",
                  check.severity === "ok"
                    ? "text-success"
                    : check.severity === "error"
                      ? "text-critical"
                      : check.severity === "warn"
                        ? "text-accent"
                        : check.severity === "pii"
                          ? "text-amber-400"
                          : "text-info",
                )}
              >
                {check.count}/{check.total}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
