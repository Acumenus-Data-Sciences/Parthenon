import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldProfile } from "@/types/ingestion";

interface ScanReportProps {
  fields: FieldProfile[];
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  string: { bg: "var(--surface-accent)", text: "var(--text-secondary)" },
  integer: { bg: "rgba(96,165,250,0.15)", text: "var(--info)" },
  float: { bg: "rgba(96,165,250,0.15)", text: "var(--info)" },
  number: { bg: "rgba(96,165,250,0.15)", text: "var(--info)" },
  date: { bg: "rgba(168,85,247,0.15)", text: "#A855F7" },
  datetime: { bg: "rgba(168,85,247,0.15)", text: "#A855F7" },
  boolean: { bg: "rgba(45,212,191,0.15)", text: "var(--success)" },
  code: { bg: "rgba(201,162,39,0.15)", text: "var(--accent)" },
};

function getTypeColor(type: string) {
  const key = type.toLowerCase();
  return TYPE_COLORS[key] ?? TYPE_COLORS.string;
}

export function ScanReport({ fields }: ScanReportProps) {
  if (!fields || fields.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted text-sm">
        No field profiles available.
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
                Column Name
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Type
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Non-null %
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Distinct %
              </th>
              <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                PII
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Sample Values
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
                    "border-t border-surface-overlay transition-colors hover:bg-surface-overlay",
                    i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                    field.is_potential_pii && "border-l-2 border-l-[#E5A84B]",
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
                      <span className="inline-flex items-center gap-1 text-[#E5A84B]" title={field.pii_type ?? "Potential PII"}>
                        <AlertTriangle size={14} />
                      </span>
                    ) : (
                      <span className="text-surface-highlight">--</span>
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
