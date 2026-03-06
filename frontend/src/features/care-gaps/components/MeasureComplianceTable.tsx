import { useState, useMemo } from "react";
import { ArrowUpDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MeasureResult } from "../types/careGap";

interface MeasureComplianceTableProps {
  measures: MeasureResult[];
}

const DOMAIN_COLORS: Record<string, string> = {
  condition: "#E85A6B",
  drug: "#2DD4BF",
  procedure: "#C9A227",
  measurement: "#818CF8",
  observation: "#94A3B8",
};

type SortKey = "measure_code" | "measure_name" | "eligible" | "compliance_pct";
type SortDir = "asc" | "desc";

function getComplianceColor(pct: number): string {
  if (pct >= 80) return "#2DD4BF";
  if (pct >= 50) return "#C9A227";
  return "#9B1B30";
}

export function MeasureComplianceTable({
  measures,
}: MeasureComplianceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("measure_code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const copy = [...measures];
    copy.sort((a, b) => {
      const cmp =
        sortKey === "measure_code" ? a.measure_code.localeCompare(b.measure_code) :
        sortKey === "measure_name" ? a.measure_name.localeCompare(b.measure_name) :
        sortKey === "eligible" ? a.eligible - b.eligible :
        a.compliance_pct - b.compliance_pct;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [measures, sortKey, sortDir]);

  if (measures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-12">
        <p className="text-sm text-[#8A857D]">
          No measure results available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#232328]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#232328] bg-[#151518]">
            {(
              [
                { key: "measure_code" as const, label: "Code" },
                { key: "measure_name" as const, label: "Measure" },
              ] as const
            ).map(({ key, label }) => (
              <th
                key={key}
                className="px-4 py-3 text-left text-xs font-semibold text-[#8A857D] cursor-pointer select-none hover:text-[#C5C0B8] transition-colors"
                onClick={() => toggleSort(key)}
              >
                <span className="inline-flex items-center gap-1">
                  {label}
                  <ArrowUpDown size={10} />
                </span>
              </th>
            ))}
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#8A857D]">
              Domain
            </th>
            <th
              className="px-4 py-3 text-right text-xs font-semibold text-[#8A857D] cursor-pointer select-none hover:text-[#C5C0B8] transition-colors"
              onClick={() => toggleSort("eligible")}
            >
              <span className="inline-flex items-center gap-1 justify-end">
                Eligible
                <ArrowUpDown size={10} />
              </span>
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-[#8A857D]">
              Met
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-[#8A857D]">
              Not Met
            </th>
            <th
              className="px-4 py-3 text-right text-xs font-semibold text-[#8A857D] cursor-pointer select-none hover:text-[#C5C0B8] transition-colors min-w-[180px]"
              onClick={() => toggleSort("compliance_pct")}
            >
              <span className="inline-flex items-center gap-1 justify-end">
                Compliance
                <ArrowUpDown size={10} />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => {
            const color = getComplianceColor(m.compliance_pct);
            const domainColor =
              DOMAIN_COLORS[
                m.measure_code.split("-")[0]?.toLowerCase() ?? ""
              ] ?? "#94A3B8";

            return (
              <tr
                key={m.measure_code}
                className="border-b border-[#232328] last:border-b-0 hover:bg-[#1A1A1E] transition-colors"
              >
                {/* Code */}
                <td className="px-4 py-3 font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                  {m.measure_code}
                </td>
                {/* Name */}
                <td className="px-4 py-3 text-[#F0EDE8]">
                  <div className="flex items-center gap-2">
                    <span>{m.measure_name}</span>
                    {m.is_deduplicated && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: "#8B5CF615",
                          color: "#8B5CF6",
                        }}
                        title={
                          m.dedup_source
                            ? `Deduplicated from: ${m.dedup_source}`
                            : "Deduplicated"
                        }
                      >
                        <Sparkles size={8} />
                        dedup
                        {m.dedup_source ? ` (${m.dedup_source})` : ""}
                      </span>
                    )}
                  </div>
                </td>
                {/* Domain */}
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${domainColor}15`,
                      color: domainColor,
                    }}
                  >
                    {m.measure_code.split("-")[0] ?? "N/A"}
                  </span>
                </td>
                {/* Eligible */}
                <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                  {m.eligible.toLocaleString()}
                </td>
                {/* Met */}
                <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#2DD4BF]">
                  {m.met.toLocaleString()}
                </td>
                {/* Not Met */}
                <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#E85A6B]">
                  {m.not_met.toLocaleString()}
                </td>
                {/* Compliance */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-24 h-2 rounded-full bg-[#232328] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${m.compliance_pct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span
                      className="font-['IBM_Plex_Mono',monospace] text-xs font-bold w-10 text-right"
                      style={{ color }}
                    >
                      {m.compliance_pct.toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
