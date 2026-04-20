import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldProfile } from "@/types/ingestion";

interface ScanReportProps {
  fields: FieldProfile[];
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  // i18n-exempt: design tokens and CSS colors are not user-facing text.
  string: { bg: "var(--surface-accent)", text: "var(--text-secondary)" },
  // i18n-exempt: design tokens and CSS colors are not user-facing text.
  integer: { bg: "rgba(96,165,250,0.15)", text: "var(--info)" },
  // i18n-exempt: design tokens and CSS colors are not user-facing text.
  float: { bg: "rgba(96,165,250,0.15)", text: "var(--info)" },
  // i18n-exempt: design tokens and CSS colors are not user-facing text.
  number: { bg: "rgba(96,165,250,0.15)", text: "var(--info)" },
  date: { bg: "rgba(168,85,247,0.15)", text: "#A855F7" },
  datetime: { bg: "rgba(168,85,247,0.15)", text: "#A855F7" },
  // i18n-exempt: design tokens and CSS colors are not user-facing text.
  boolean: { bg: "rgba(45,212,191,0.15)", text: "var(--success)" },
  // i18n-exempt: design tokens and CSS colors are not user-facing text.
  code: { bg: "rgba(201,162,39,0.15)", text: "var(--accent)" },
};

function getTypeColor(type: string) {
  const key = type.toLowerCase();
  return TYPE_COLORS[key] ?? TYPE_COLORS.string;
}

export function ScanReport({ fields }: ScanReportProps) {
  const { t } = useTranslation("app");

  if (!fields || fields.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted text-sm">
        {t("ingestion.scanReport.noProfiles")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-overlay">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("ingestion.scanReport.columnName")}
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("ingestion.common.type")}
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("ingestion.scanReport.nonNullPercent")}
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("ingestion.scanReport.distinctPercent")}
              </th>
              <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                PII
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                {t("ingestion.scanReport.sampleValues")}
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, i) => {
              const typeColor = getTypeColor(field.inferred_type);
              const nonNullPct =
                field.non_null_count + field.null_count > 0
                  ? (
                      (field.non_null_count /
                        (field.non_null_count + field.null_count)) *
                      100
                    ).toFixed(1)
                  : "0.0";

              return (
                <tr
                  key={field.id}
                  className={cn(
                    "border-t border-border-subtle transition-colors hover:bg-surface-overlay",
                    i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                    field.is_potential_pii && "border-l-2 border-l-warning",
                  )}
                >
                  <td className="px-4 py-2.5 text-sm font-medium text-text-primary font-['IBM_Plex_Mono',monospace]">
                    {field.column_name}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: typeColor.bg,
                        color: typeColor.text,
                      }}
                    >
                      {field.inferred_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums text-text-secondary">
                    {nonNullPct}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums text-text-secondary">
                    {field.distinct_percentage.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {field.is_potential_pii ? (
                      <span className="inline-flex items-center gap-1 text-warning" title={field.pii_type ?? "Potential PII"}>
                        <AlertTriangle size={14} />
                      </span>
                    ) : (
                      <span className="text-text-ghost">--</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-text-muted font-['IBM_Plex_Mono',monospace] max-w-[260px] truncate">
                    {field.sample_values
                      ? field.sample_values.slice(0, 3).join(", ")
                      : "--"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
