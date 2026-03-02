import { useState, useMemo } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureResult } from "../types/analysis";

interface FeatureComparisonTableProps {
  targetFeatures: FeatureResult[];
  comparatorFeatures?: FeatureResult[];
  targetLabel?: string;
  comparatorLabel?: string;
}

type SortField =
  | "feature_name"
  | "target_count"
  | "target_percent"
  | "comparator_count"
  | "comparator_percent"
  | "smd";
type SortDir = "asc" | "desc";

interface MergedRow {
  feature_name: string;
  target_count: number;
  target_percent: number;
  comparator_count: number;
  comparator_percent: number;
  smd: number | null;
}

function computeSMD(
  p1: number,
  p2: number,
): number | null {
  // Standardized Mean Difference for proportions
  const denom = Math.sqrt(
    (p1 * (1 - p1) + p2 * (1 - p2)) / 2,
  );
  if (denom === 0) return null;
  return Math.abs(p1 - p2) / denom;
}

export function FeatureComparisonTable({
  targetFeatures,
  comparatorFeatures,
  targetLabel = "Target",
  comparatorLabel = "Comparator",
}: FeatureComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>("target_percent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

  const hasComparator =
    comparatorFeatures !== undefined && comparatorFeatures.length > 0;

  const mergedRows = useMemo<MergedRow[]>(() => {
    const map = new Map<string, MergedRow>();

    for (const f of targetFeatures) {
      map.set(f.feature_name, {
        feature_name: f.feature_name,
        target_count: f.count,
        target_percent: f.percent,
        comparator_count: 0,
        comparator_percent: 0,
        smd: null,
      });
    }

    if (comparatorFeatures) {
      for (const f of comparatorFeatures) {
        const existing = map.get(f.feature_name);
        if (existing) {
          existing.comparator_count = f.count;
          existing.comparator_percent = f.percent;
          existing.smd = computeSMD(
            existing.target_percent / 100,
            f.percent / 100,
          );
        } else {
          map.set(f.feature_name, {
            feature_name: f.feature_name,
            target_count: 0,
            target_percent: 0,
            comparator_count: f.count,
            comparator_percent: f.percent,
            smd: null,
          });
        }
      }
    }

    return Array.from(map.values());
  }, [targetFeatures, comparatorFeatures]);

  const filteredAndSorted = useMemo(() => {
    let rows = mergedRows;

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        r.feature_name.toLowerCase().includes(q),
      );
    }

    rows.sort((a, b) => {
      const getValue = (row: MergedRow): string | number => {
        switch (sortField) {
          case "feature_name":
            return row.feature_name;
          case "target_count":
            return row.target_count;
          case "target_percent":
            return row.target_percent;
          case "comparator_count":
            return row.comparator_count;
          case "comparator_percent":
            return row.comparator_percent;
          case "smd":
            return row.smd ?? -1;
        }
      };
      const aVal = getValue(a);
      const bVal = getValue(b);
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [mergedRows, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortableHeader = ({
    field,
    label,
    className,
  }: {
    field: SortField;
    label: string;
    className?: string;
  }) => (
    <th
      className={cn(
        "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#8A857D] cursor-pointer hover:text-[#C5C0B8] transition-colors select-none",
        className,
      )}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          size={10}
          className={
            sortField === field ? "text-[#2DD4BF]" : "text-[#5A5650]"
          }
        />
      </span>
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter features..."
          className={cn(
            "w-full rounded-lg border border-[#232328] bg-[#0E0E11] pl-9 pr-3 py-2 text-sm",
            "text-[#F0EDE8] placeholder:text-[#5A5650]",
            "focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
          )}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#1C1C20]">
                <SortableHeader
                  field="feature_name"
                  label="Feature Name"
                  className="text-left"
                />
                <SortableHeader
                  field="target_count"
                  label={`${targetLabel} Count`}
                  className="text-right"
                />
                <SortableHeader
                  field="target_percent"
                  label={`${targetLabel} %`}
                  className="text-right"
                />
                {hasComparator && (
                  <>
                    <SortableHeader
                      field="comparator_count"
                      label={`${comparatorLabel} Count`}
                      className="text-right"
                    />
                    <SortableHeader
                      field="comparator_percent"
                      label={`${comparatorLabel} %`}
                      className="text-right"
                    />
                    <SortableHeader
                      field="smd"
                      label="SMD"
                      className="text-right"
                    />
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((row, i) => (
                <tr
                  key={row.feature_name}
                  className={cn(
                    "border-t border-[#1C1C20] transition-colors",
                    i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                  )}
                >
                  <td className="px-4 py-2.5 text-sm text-[#F0EDE8]">
                    {row.feature_name}
                  </td>
                  <td className="px-4 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8]">
                    {row.target_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-[#232328] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#2DD4BF]"
                          style={{
                            width: `${Math.min(row.target_percent, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8] w-14 text-right">
                        {row.target_percent.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  {hasComparator && (
                    <>
                      <td className="px-4 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8]">
                        {row.comparator_count.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-[#232328] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#C9A227]"
                              style={{
                                width: `${Math.min(row.comparator_percent, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8] w-14 text-right">
                            {row.comparator_percent.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {row.smd !== null ? (
                          <span
                            className={cn(
                              "font-['IBM_Plex_Mono',monospace] text-sm font-medium",
                              row.smd > 0.2
                                ? "text-[#E85A6B]"
                                : row.smd > 0.1
                                  ? "text-[#F59E0B]"
                                  : "text-[#C5C0B8]",
                            )}
                          >
                            {row.smd.toFixed(3)}
                          </span>
                        ) : (
                          <span className="text-xs text-[#5A5650]">
                            --
                          </span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {filteredAndSorted.length === 0 && (
                <tr>
                  <td
                    colSpan={hasComparator ? 6 : 3}
                    className="px-4 py-8 text-center text-sm text-[#5A5650]"
                  >
                    No features found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-[#5A5650]">
        Showing {filteredAndSorted.length} of {mergedRows.length} features
        {hasComparator &&
          " | SMD > 0.1 highlighted orange, > 0.2 highlighted red"}
      </p>
    </div>
  );
}
