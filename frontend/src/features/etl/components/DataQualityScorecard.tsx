import { useMemo } from "react";
import { Shield, ShieldAlert, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableProfile } from "../api";
import { fmtNumberFull, overallGrade } from "../lib/profiler-utils";

export function DataQualityScorecard({ tables, piiColumnCount }: { tables: TableProfile[]; piiColumnCount?: number }) {
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
      label: "High-null columns (>50%)",
      count: stats.highNullCols,
      total: stats.totalCols,
      severity: stats.highNullCols > 0 ? "warn" : "ok",
    },
    {
      label: "Nearly-empty columns (>99%)",
      count: stats.emptyCols,
      total: stats.totalCols,
      severity: stats.emptyCols > 0 ? "error" : "ok",
    },
    {
      label: "Low cardinality (<5 distinct)",
      count: stats.lowCardCols,
      total: stats.totalCols,
      severity: stats.lowCardCols > 3 ? "info" : "ok",
    },
    {
      label: "Single-value columns",
      count: stats.singleValueCols,
      total: stats.totalCols,
      severity: stats.singleValueCols > 0 ? "warn" : "ok",
    },
    {
      label: "Empty tables (0 rows)",
      count: stats.emptyTables,
      total: tables.length,
      severity: stats.emptyTables > 0 ? "error" : "ok",
    },
    ...(piiColumnCount && piiColumnCount > 0
      ? [
          {
            label: "PII Columns",
            count: piiColumnCount,
            total: stats.totalCols,
            severity: "pii" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <div className="px-4 py-3 bg-[#1C1C20] border-b border-[#232328] flex items-center gap-2">
        <Shield size={15} className="text-[#8A857D]" />
        <h4 className="text-sm font-medium text-[#F0EDE8]">Data Quality Scorecard</h4>
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
            <p className="text-sm font-medium text-[#F0EDE8]">Overall Data Completeness</p>
            <p className="text-xs text-[#8A857D] mt-0.5">
              Based on average null fraction across {fmtNumberFull(stats.totalCols)} columns in{" "}
              {tables.length} tables
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {checks.map((check) => (
            <div
              key={check.label}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#1C1C20]"
            >
              <div className="flex items-center gap-2">
                {check.severity === "ok" && (
                  <CheckCircle2 size={14} className="text-[#2DD4BF]" />
                )}
                {check.severity === "warn" && (
                  <AlertTriangle size={14} className="text-[#C9A227]" />
                )}
                {check.severity === "error" && (
                  <AlertTriangle size={14} className="text-[#E85A6B]" />
                )}
                {check.severity === "info" && (
                  <Info size={14} className="text-[#60A5FA]" />
                )}
                {check.severity === "pii" && (
                  <ShieldAlert size={14} className="text-amber-400" />
                )}
                <span className="text-xs text-[#C5C0B8]">{check.label}</span>
              </div>
              <span
                className={cn(
                  "text-xs font-mono tabular-nums",
                  check.severity === "ok"
                    ? "text-[#2DD4BF]"
                    : check.severity === "error"
                      ? "text-[#E85A6B]"
                      : check.severity === "warn"
                        ? "text-[#C9A227]"
                        : check.severity === "pii"
                          ? "text-amber-400"
                          : "text-[#60A5FA]",
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
