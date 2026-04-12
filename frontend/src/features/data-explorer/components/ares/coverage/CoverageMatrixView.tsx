import { useState, useCallback } from "react";
import { useCoverage, useCoverageExtended } from "../../../hooks/useNetworkData";
import { fetchCoverageExport } from "../../../api/networkAresApi";
import type { ExtendedCoverageCell } from "../../../types/ares";
import TemporalCoverageBar from "./TemporalCoverageBar";

function getCellColor(hasData: boolean, density: number): string {
  if (!hasData) return "bg-[#9B1B30]/20";
  if (density >= 5) return "bg-[#2DD4BF]/30";
  if (density >= 1) return "bg-[#C9A227]/20";
  return "bg-[#2DD4BF]/10";
}

function getCellTextColor(hasData: boolean, density: number): string {
  if (!hasData) return "text-[#9B1B30]";
  if (density >= 5) return "text-[#2DD4BF]";
  if (density >= 1) return "text-[#C9A227]";
  return "text-[#2DD4BF]/70";
}

function getExpectedIcon(expected: boolean, hasData: boolean): { icon: string; color: string; title: string } {
  if (expected && hasData) return { icon: "check", color: "text-[#2DD4BF]", title: "Expected and present" };
  if (expected && !hasData) return { icon: "!", color: "text-[#9B1B30]", title: "Expected but missing" };
  if (!expected && hasData) return { icon: "+", color: "text-[#C9A227]", title: "Unexpected bonus data" };
  return { icon: "--", color: "text-[#555]", title: "Not expected, not present" };
}

export default function CoverageMatrixView() {
  const { data: matrix, isLoading } = useCoverage();
  const { data: extended } = useCoverageExtended();
  const [viewMode, setViewMode] = useState<"records" | "per_person" | "date_range">("records");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const [showExpected, setShowExpected] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const exportData = await fetchCoverageExport("csv");
      // Trigger browser download
      const blob = new Blob([exportData.content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportData.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail — user can retry
    } finally {
      setIsExporting(false);
    }
  }, []);

  if (isLoading) {
    return <div className="p-4 text-[#555]">Loading coverage matrix...</div>;
  }

  if (!matrix || matrix.sources.length === 0) {
    return <div className="p-4 text-center text-[#555]">No sources available for coverage analysis.</div>;
  }

  // Compute global earliest/latest for temporal bar scaling
  let globalEarliest: string | null = null;
  let globalLatest: string | null = null;
  if (extended) {
    for (const row of extended.matrix) {
      for (const domain of extended.domains) {
        const cell = row[domain] as ExtendedCoverageCell | undefined;
        if (cell?.earliest_date && (!globalEarliest || cell.earliest_date < globalEarliest)) {
          globalEarliest = cell.earliest_date;
        }
        if (cell?.latest_date && (!globalLatest || cell.latest_date > globalLatest)) {
          globalLatest = cell.latest_date;
        }
      }
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-text-primary">Coverage Matrix (Strand Report)</h2>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-1.5 rounded-lg border border-[#252530] bg-[#151518] px-3 py-1.5 text-xs text-[#888] transition-colors hover:border-[#C9A227]/30 hover:text-[#C9A227] disabled:opacity-50"
        >
          {isExporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>
      <p className="mb-4 text-xs text-[#666]">
        Domain availability across all data sources. Green = high density, amber = low density, red = no data.
      </p>

      {/* View mode toggle */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-[#666]">View:</span>
        {(["records", "per_person", "date_range"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              viewMode === mode
                ? "bg-[#C9A227]/20 text-[#C9A227]"
                : "text-[#888] hover:text-text-primary"
            }`}
          >
            {mode === "records" ? "Records" : mode === "per_person" ? "Per Person" : "Date Range"}
          </button>
        ))}
        <span className="mx-2 text-[#333]">|</span>
        <button
          type="button"
          onClick={() => setShowExpected(!showExpected)}
          className={`rounded px-2 py-1 text-xs transition-colors ${
            showExpected ? "bg-[#C9A227]/20 text-[#C9A227]" : "text-[#888] hover:text-text-primary"
          }`}
        >
          Expected vs Actual
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#252530]">
        <table className="w-full text-sm">
          <thead className="bg-[#1a1a22]">
            <tr>
              <th className="sticky left-0 bg-[#1a1a22] px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">
                Source
              </th>
              {matrix.domains.map((domain) => {
                const isObsPeriod = domain === "observation_period";
                return (
                  <th
                    key={domain}
                    className={`px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888] ${
                      isObsPeriod ? "border-x-2 border-[#C9A227]/30 bg-[#C9A227]/5" : ""
                    } ${hoveredCol === domain ? "bg-[#1a1a22]" : ""}`}
                  >
                    {domain.replace(/_/g, " ")}
                  </th>
                );
              })}
              <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">
                Domains
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.sources.map((source, rowIdx) => {
              const extendedSource = extended?.sources[rowIdx];
              const sourceType = extendedSource?.source_type ?? null;
              const expectedMap = sourceType && extended?.expected?.[sourceType]
                ? extended.expected[sourceType]
                : null;

              return (
                <tr
                  key={source.id}
                  onMouseEnter={() => setHoveredRow(rowIdx)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className={`border-t border-[#1a1a22] ${
                    hoveredRow === rowIdx ? "bg-[#1a1a22]" : ""
                  }`}
                >
                  <td className="sticky left-0 bg-[#151518] px-3 py-2 text-xs font-medium text-text-primary">
                    <div className="flex flex-col">
                      <span>{source.name}</span>
                      {sourceType && (
                        <span className="text-[10px] text-[#666]">{sourceType.toUpperCase()}</span>
                      )}
                    </div>
                  </td>
                  {matrix.domains.map((domain) => {
                    const cell = matrix.matrix[rowIdx]?.[domain];
                    const extCell = extended?.matrix[rowIdx]?.[domain] as ExtendedCoverageCell | undefined;
                    const isObsPeriod = domain === "observation_period";
                    if (!cell) return <td key={domain} className="px-3 py-2" />;

                    const expectedForDomain = expectedMap?.[domain];

                    return (
                      <td
                        key={domain}
                        onMouseEnter={() => setHoveredCol(domain)}
                        onMouseLeave={() => setHoveredCol(null)}
                        className={`px-2 py-1.5 text-center ${
                          isObsPeriod ? "border-x-2 border-[#C9A227]/30 bg-[#C9A227]/5" : ""
                        } ${hoveredCol === domain ? "bg-[#1a1a22]" : ""}`}
                      >
                        <div
                          className={`rounded px-2 py-1 text-xs font-mono ${getCellColor(cell.has_data, cell.density_per_person)} ${getCellTextColor(cell.has_data, cell.density_per_person)}`}
                          title={`Density: ${cell.density_per_person} per person`}
                        >
                          {viewMode === "records" && (cell.has_data ? cell.record_count.toLocaleString() : "---")}
                          {viewMode === "per_person" && (cell.has_data ? cell.density_per_person.toFixed(1) : "---")}
                          {viewMode === "date_range" && extCell && (
                            <TemporalCoverageBar
                              earliest={extCell.earliest_date}
                              latest={extCell.latest_date}
                              globalEarliest={globalEarliest}
                              globalLatest={globalLatest}
                            />
                          )}
                          {viewMode === "date_range" && !extCell && (cell.has_data ? "Yes" : "---")}
                        </div>
                        {showExpected && expectedForDomain !== undefined && (
                          <div className="mt-0.5">
                            {(() => {
                              const info = getExpectedIcon(expectedForDomain, cell.has_data);
                              return (
                                <span
                                  className={`text-[9px] font-bold ${info.color}`}
                                  title={info.title}
                                >
                                  {info.icon === "check" ? "[OK]" : info.icon === "!" ? "[MISS]" : info.icon === "+" ? "[BONUS]" : "--"}
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center">
                    <span className="text-xs text-[#888]">
                      {matrix.source_completeness?.[source.id] ?? 0}/{matrix.domains.length}
                    </span>
                  </td>
                </tr>
              );
            })}
            {/* Domain summary row */}
            <tr className="border-t-2 border-[#333] bg-[#1a1a22]">
              <td className="sticky left-0 bg-[#1a1a22] px-3 py-2 text-xs font-medium text-[#C9A227]">
                Network Total
              </td>
              {matrix.domains.map((domain) => (
                <td key={domain} className="px-2 py-1.5 text-center">
                  <span className="text-xs font-mono text-[#C9A227]">
                    {(matrix.domain_totals?.[domain] ?? 0).toLocaleString()}
                  </span>
                </td>
              ))}
              <td className="px-2 py-1.5 text-center text-xs font-mono text-[#C9A227]">--</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
