import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldProfile } from "@/types/ingestion";

interface ScanReportProps {
  fields: FieldProfile[];
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  string: { bg: "#2A2A30", text: "#C5C0B8" },
  integer: { bg: "rgba(96,165,250,0.15)", text: "#60A5FA" },
  float: { bg: "rgba(96,165,250,0.15)", text: "#60A5FA" },
  number: { bg: "rgba(96,165,250,0.15)", text: "#60A5FA" },
  date: { bg: "rgba(168,85,247,0.15)", text: "#A855F7" },
  datetime: { bg: "rgba(168,85,247,0.15)", text: "#A855F7" },
  boolean: { bg: "rgba(45,212,191,0.15)", text: "#2DD4BF" },
  code: { bg: "rgba(201,162,39,0.15)", text: "#C9A227" },
};

function getTypeColor(type: string) {
  const key = type.toLowerCase();
  return TYPE_COLORS[key] ?? TYPE_COLORS.string;
}

export function ScanReport({ fields }: ScanReportProps) {
  if (!fields || fields.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[#8A857D] text-sm">
        No field profiles available.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#1C1C20]">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Column Name
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Type
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Non-null %
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Distinct %
              </th>
              <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                PII
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
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
                    "border-t border-[#1C1C20] transition-colors hover:bg-[#1C1C20]",
                    i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                    field.is_potential_pii && "border-l-2 border-l-[#E5A84B]",
                  )}
                >
                  <td className="px-4 py-2.5 text-sm font-medium text-[#F0EDE8] font-['IBM_Plex_Mono',monospace]">
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
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums text-[#C5C0B8]">
                    {nonNullPct}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums text-[#C5C0B8]">
                    {field.distinct_percentage.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {field.is_potential_pii ? (
                      <span className="inline-flex items-center gap-1 text-[#E5A84B]" title={field.pii_type ?? "Potential PII"}>
                        <AlertTriangle size={14} />
                      </span>
                    ) : (
                      <span className="text-[#323238]">--</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-[#8A857D] font-['IBM_Plex_Mono',monospace] max-w-[260px] truncate">
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
