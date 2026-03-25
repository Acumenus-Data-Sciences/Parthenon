import { useState } from "react";
import { useCoverage } from "../../../hooks/useNetworkData";

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

export default function CoverageMatrixView() {
  const { data: matrix, isLoading } = useCoverage();
  const [viewMode, setViewMode] = useState<"records" | "per_person" | "date_range">("records");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);

  if (isLoading) {
    return <div className="p-4 text-[#555]">Loading coverage matrix...</div>;
  }

  if (!matrix || matrix.sources.length === 0) {
    return <div className="p-4 text-center text-[#555]">No sources available for coverage analysis.</div>;
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-medium text-white">Coverage Matrix (Strand Report)</h2>
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
                : "text-[#888] hover:text-white"
            }`}
          >
            {mode === "records" ? "Records" : mode === "per_person" ? "Per Person" : "Date Range"}
          </button>
        ))}
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
            {matrix.sources.map((source, rowIdx) => (
              <tr
                key={source.id}
                onMouseEnter={() => setHoveredRow(rowIdx)}
                onMouseLeave={() => setHoveredRow(null)}
                className={`border-t border-[#1a1a22] ${
                  hoveredRow === rowIdx ? "bg-[#1a1a22]" : ""
                }`}
              >
                <td className="sticky left-0 bg-[#151518] px-3 py-2 text-xs font-medium text-white">
                  {source.name}
                </td>
                {matrix.domains.map((domain) => {
                  const cell = matrix.matrix[rowIdx]?.[domain];
                  const isObsPeriod = domain === "observation_period";
                  if (!cell) return <td key={domain} className="px-3 py-2" />;

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
                        {viewMode === "date_range" && (cell.has_data ? "Yes" : "---")}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center">
                  <span className="text-xs text-[#888]">
                    {matrix.source_completeness?.[source.id] ?? 0}/12
                  </span>
                </td>
              </tr>
            ))}
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
