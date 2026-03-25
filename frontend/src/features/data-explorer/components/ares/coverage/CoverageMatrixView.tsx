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

      <div className="overflow-x-auto rounded-lg border border-[#252530]">
        <table className="w-full text-sm">
          <thead className="bg-[#1a1a22]">
            <tr>
              <th className="sticky left-0 bg-[#1a1a22] px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">
                Source
              </th>
              {matrix.domains.map((domain) => (
                <th key={domain} className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">
                  {domain.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.sources.map((source, rowIdx) => (
              <tr key={source.id} className="border-t border-[#1a1a22]">
                <td className="sticky left-0 bg-[#151518] px-3 py-2 text-xs font-medium text-white">
                  {source.name}
                </td>
                {matrix.domains.map((domain) => {
                  const cell = matrix.matrix[rowIdx]?.[domain];
                  if (!cell) return <td key={domain} className="px-3 py-2" />;

                  return (
                    <td key={domain} className="px-2 py-1.5 text-center">
                      <div
                        className={`rounded px-2 py-1 text-xs font-mono ${getCellColor(cell.has_data, cell.density_per_person)} ${getCellTextColor(cell.has_data, cell.density_per_person)}`}
                        title={`Density: ${cell.density_per_person} per person`}
                      >
                        {cell.has_data ? cell.record_count.toLocaleString() : "---"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
