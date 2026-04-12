import { useState, useCallback } from "react";
import { useCoverage, useCoverageExtended } from "../../../hooks/useNetworkData";
import { fetchCoverageExport } from "../../../api/networkAresApi";
import type { ExtendedCoverageCell } from "../../../types/ares";
import TemporalCoverageBar from "./TemporalCoverageBar";

function getCellColor(hasData: boolean, density: number): string {
  if (!hasData) return "bg-primary/20";
  if (density >= 5) return "bg-success/30";
  if (density >= 1) return "bg-accent/20";
  return "bg-success/10";
}

function getCellTextColor(hasData: boolean, density: number): string {
  if (!hasData) return "text-primary";
  if (density >= 5) return "text-success";
  if (density >= 1) return "text-accent";
  return "text-success/70";
}

function getExpectedIcon(expected: boolean, hasData: boolean): { icon: string; color: string; title: string } {
  if (expected && hasData) return { icon: "check", color: "text-success", title: "Expected and present" };
  if (expected && !hasData) return { icon: "!", color: "text-primary", title: "Expected but missing" };
  if (!expected && hasData) return { icon: "+", color: "text-accent", title: "Unexpected bonus data" };
  return { icon: "--", color: "text-text-ghost", title: "Not expected, not present" };
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
    return <div className="p-4 text-text-ghost">Loading coverage matrix...</div>;
  }

  if (!matrix || matrix.sources.length === 0) {
    return <div className="p-4 text-center text-text-ghost">No sources available for coverage analysis.</div>;
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
        <h2 className="text-lg font-medium text-white">Coverage Matrix (Strand Report)</h2>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-raised px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-accent/30 hover:text-accent disabled:opacity-50"
        >
          {isExporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>
      <p className="mb-4 text-xs text-text-ghost">
        Domain availability across all data sources. Green = high density, amber = low density, red = no data.
      </p>

      {/* View mode toggle */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-text-ghost">View:</span>
        {(["records", "per_person", "date_range"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              viewMode === mode
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:text-white"
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
            showExpected ? "bg-accent/20 text-accent" : "text-text-muted hover:text-white"
          }`}
        >
          Expected vs Actual
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-surface-overlay">
            <tr>
              <th className="sticky left-0 bg-surface-overlay px-3 py-2 text-left text-[11px] font-medium uppercase text-text-muted">
                Source
              </th>
              {matrix.domains.map((domain) => {
                const isObsPeriod = domain === "observation_period";
                return (
                  <th
                    key={domain}
                    className={`px-3 py-2 text-center text-[11px] font-medium uppercase text-text-muted ${
                      isObsPeriod ? "border-x-2 border-accent/30 bg-accent/5" : ""
                    } ${hoveredCol === domain ? "bg-surface-overlay" : ""}`}
                  >
                    {domain.replace(/_/g, " ")}
                  </th>
                );
              })}
              <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-text-muted">
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
                  className={`border-t border-border-subtle ${
                    hoveredRow === rowIdx ? "bg-surface-overlay" : ""
                  }`}
                >
                  <td className="sticky left-0 bg-surface-raised px-3 py-2 text-xs font-medium text-white">
                    <div className="flex flex-col">
                      <span>{source.name}</span>
                      {sourceType && (
                        <span className="text-[10px] text-text-ghost">{sourceType.toUpperCase()}</span>
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
                          isObsPeriod ? "border-x-2 border-accent/30 bg-accent/5" : ""
                        } ${hoveredCol === domain ? "bg-surface-overlay" : ""}`}
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
                    <span className="text-xs text-text-muted">
                      {matrix.source_completeness?.[source.id] ?? 0}/{matrix.domains.length}
                    </span>
                  </td>
                </tr>
              );
            })}
            {/* Domain summary row */}
            <tr className="border-t-2 border-border-default bg-surface-overlay">
              <td className="sticky left-0 bg-surface-overlay px-3 py-2 text-xs font-medium text-accent">
                Network Total
              </td>
              {matrix.domains.map((domain) => (
                <td key={domain} className="px-2 py-1.5 text-center">
                  <span className="text-xs font-mono text-accent">
                    {(matrix.domain_totals?.[domain] ?? 0).toLocaleString()}
                  </span>
                </td>
              ))}
              <td className="px-2 py-1.5 text-center text-xs font-mono text-accent">--</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
