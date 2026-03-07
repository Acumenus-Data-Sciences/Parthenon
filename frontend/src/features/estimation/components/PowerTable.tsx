import { useState } from "react";
import type { PowerEntry } from "../types/estimation";

interface PowerTableProps {
  entries: PowerEntry[];
}

type SortKey = "outcome_name" | "mdrr" | "target_outcomes" | "comparator_outcomes";

export function PowerTable({ entries }: PowerTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("mdrr");
  const [sortAsc, setSortAsc] = useState(true);

  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string" && typeof bv === "string") {
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ▲" : " ▼") : "";

  const mdrrColor = (mdrr: number) => {
    if (mdrr < 2.0) return "#2DD4BF";
    if (mdrr < 4.0) return "#C9A227";
    return "#E85A6B";
  };

  const maxMdrr = Math.max(...entries.map((e) => e.mdrr), 1);

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <div className="p-4 border-b border-[#232328]">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Statistical Power & Minimum Detectable Relative Risk
        </h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-[#1C1C20]">
            <th
              className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D] cursor-pointer hover:text-[#C5C0B8]"
              onClick={() => handleSort("outcome_name")}
            >
              Outcome{sortIndicator("outcome_name")}
            </th>
            <th
              className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D] cursor-pointer hover:text-[#C5C0B8]"
              onClick={() => handleSort("target_outcomes")}
            >
              Target Events{sortIndicator("target_outcomes")}
            </th>
            <th
              className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D] cursor-pointer hover:text-[#C5C0B8]"
              onClick={() => handleSort("comparator_outcomes")}
            >
              Comparator Events{sortIndicator("comparator_outcomes")}
            </th>
            <th
              className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D] cursor-pointer hover:text-[#C5C0B8]"
              onClick={() => handleSort("mdrr")}
            >
              MDRR{sortIndicator("mdrr")}
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
              MDRR
            </th>
            {entries.some((e) => e.power_at_1_5 != null) && (
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Power @1.5
              </th>
            )}
            {entries.some((e) => e.power_at_2_0 != null) && (
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Power @2.0
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => {
            const barWidth = (entry.mdrr / maxMdrr) * 100;
            return (
              <tr
                key={entry.outcome_id}
                className={i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]"}
              >
                <td className="px-4 py-3 text-sm text-[#F0EDE8] max-w-[200px] truncate">
                  {entry.outcome_name}
                </td>
                <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
                  {entry.target_outcomes.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
                  {entry.comparator_outcomes.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-sm font-medium"
                  style={{ color: mdrrColor(entry.mdrr) }}
                >
                  {entry.mdrr.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex-1 h-2 rounded-full bg-[#0E0E11]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(barWidth, 100)}%`,
                        backgroundColor: mdrrColor(entry.mdrr),
                      }}
                    />
                  </div>
                </td>
                {entries.some((e) => e.power_at_1_5 != null) && (
                  <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                    {entry.power_at_1_5 != null
                      ? `${(entry.power_at_1_5 * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                )}
                {entries.some((e) => e.power_at_2_0 != null) && (
                  <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                    {entry.power_at_2_0 != null
                      ? `${(entry.power_at_2_0 * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
