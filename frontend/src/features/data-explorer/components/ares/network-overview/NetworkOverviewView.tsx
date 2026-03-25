import { useNetworkOverview } from "../../../hooks/useNetworkData";
import type { NetworkDqSource } from "../../../types/ares";

function TrendIndicator({ trend }: { trend: string | null }) {
  if (trend === "up") return <span className="text-[#2DD4BF]">&#9650;</span>;
  if (trend === "down") return <span className="text-[#9B1B30]">&#9660;</span>;
  if (trend === "stable") return <span className="text-[#888]">&#9644;</span>;
  return <span className="text-[#555]">--</span>;
}

export default function NetworkOverviewView() {
  const { data: overview, isLoading } = useNetworkOverview();

  if (isLoading) {
    return <div className="p-4 text-[#555]">Loading network overview...</div>;
  }

  if (!overview) {
    return <div className="p-4 text-center text-[#555]">No network data available.</div>;
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-medium text-white">Network Overview</h2>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
          <p className="text-2xl font-semibold text-[#2DD4BF]">{overview.source_count}</p>
          <p className="text-[11px] text-[#666]">Data Sources</p>
        </div>
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
          <p className="text-2xl font-semibold text-[#C9A227]">
            {overview.avg_dq_score !== null ? `${overview.avg_dq_score.toFixed(1)}%` : "--"}
          </p>
          <p className="text-[11px] text-[#666]">Avg DQ Score</p>
        </div>
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
          <p className="text-2xl font-semibold text-[#9B1B30]">{overview.total_unmapped_codes.toLocaleString()}</p>
          <p className="text-[11px] text-[#666]">Unmapped Codes</p>
        </div>
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
          <p className="text-2xl font-semibold text-white">{overview.sources_needing_attention}</p>
          <p className="text-[11px] text-[#666]">Need Attention</p>
        </div>
      </div>

      {/* Source health table */}
      <div className="overflow-hidden rounded-lg border border-[#252530]">
        <table className="w-full text-sm">
          <thead className="bg-[#1a1a22]">
            <tr className="border-b border-[#252530]">
              <th className="px-4 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Source</th>
              <th className="px-4 py-2 text-center text-[11px] font-medium uppercase text-[#888]">DQ Score</th>
              <th className="px-4 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Trend</th>
              <th className="px-4 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Latest Release</th>
            </tr>
          </thead>
          <tbody>
            {overview.dq_summary.map((source: NetworkDqSource) => (
              <tr key={source.source_id} className="border-b border-[#1a1a22] hover:bg-[#151518]">
                <td className="px-4 py-2 text-white">{source.source_name}</td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      source.pass_rate >= 90
                        ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
                        : source.pass_rate >= 80
                          ? "bg-[#C9A227]/20 text-[#C9A227]"
                          : "bg-[#9B1B30]/20 text-[#e85d75]"
                    }`}
                  >
                    {source.pass_rate > 0 ? `${source.pass_rate.toFixed(1)}%` : "--"}
                  </span>
                </td>
                <td className="px-4 py-2 text-center text-lg">
                  <TrendIndicator trend={source.trend} />
                </td>
                <td className="px-4 py-2 text-xs text-[#888]">{source.release_name ?? "No releases"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
