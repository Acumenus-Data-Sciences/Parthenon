import { useNavigate } from "react-router-dom";
import { useAlerts, useNetworkOverview } from "../../../hooks/useNetworkData";
import type { NetworkDqSource } from "../../../types/ares";
import Sparkline from "../shared/Sparkline";
import AlertBanner from "./AlertBanner";
import FreshnessCell from "./FreshnessCell";

function DomainRing({ count }: { count: number }) {
  const fraction = count / 12;
  const circumference = 2 * Math.PI * 8; // r=8

  return (
    <div className="flex items-center gap-1">
      <svg width={20} height={20} viewBox="0 0 20 20">
        <circle cx={10} cy={10} r={8} fill="none" stroke="#252530" strokeWidth={2} />
        <circle
          cx={10}
          cy={10}
          r={8}
          fill="none"
          stroke="#2DD4BF"
          strokeWidth={2}
          strokeDasharray={`${fraction * circumference} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 10 10)"
        />
      </svg>
      <span className="text-xs text-[#888]">{count}/12</span>
    </div>
  );
}

export default function NetworkOverviewView() {
  const { data: overview, isLoading } = useNetworkOverview();
  const { data: alerts } = useAlerts();
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="p-4 text-[#555]">Loading network overview...</div>;
  }

  if (!overview) {
    return <div className="p-4 text-center text-[#555]">No network data available.</div>;
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-medium text-white">Network Overview</h2>

      {/* Alert banner */}
      {alerts && alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-5 gap-3">
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
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
          <p className="text-2xl font-semibold text-[#2DD4BF]">
            {overview.network_person_count?.toLocaleString() ?? "--"}
          </p>
          <p className="text-[11px] text-[#666]">Total Persons</p>
        </div>
      </div>

      {/* Source health table */}
      <div className="overflow-hidden rounded-lg border border-[#252530]">
        <table className="w-full text-sm">
          <thead className="bg-[#1a1a22]">
            <tr className="border-b border-[#252530]">
              <th className="px-4 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Source</th>
              <th className="px-4 py-2 text-center text-[11px] font-medium uppercase text-[#888]">DQ Score</th>
              <th className="px-4 py-2 text-center text-[11px] font-medium uppercase text-[#888]">DQ Trend</th>
              <th className="px-4 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Freshness</th>
              <th className="px-4 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Domains</th>
              <th className="px-4 py-2 text-right text-[11px] font-medium uppercase text-[#888]">Persons</th>
              <th className="px-4 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Latest Release</th>
            </tr>
          </thead>
          <tbody>
            {overview.dq_summary.map((source: NetworkDqSource) => (
              <tr
                key={source.source_id}
                onClick={() => navigate(`/data-explorer/${source.source_id}`)}
                className="cursor-pointer border-b border-[#1a1a22] hover:bg-[#151518]"
              >
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
                <td className="px-4 py-2 text-center">
                  <Sparkline data={source.sparkline} />
                </td>
                <td className="px-4 py-2 text-center">
                  <FreshnessCell daysSinceRefresh={source.days_since_refresh} />
                </td>
                <td className="px-4 py-2 text-center">
                  <DomainRing count={source.domain_count} />
                </td>
                <td className="px-4 py-2 text-right text-xs text-[#ccc]">
                  {source.person_count.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-xs text-[#888]">{source.release_name ?? "No releases"}</td>
              </tr>
            ))}

            {/* Network aggregate row */}
            <tr className="border-t-2 border-[#333] bg-[#1a1a22] font-medium">
              <td className="px-4 py-2 text-[#C9A227]">Network Total</td>
              <td className="px-4 py-2 text-center">
                <span className="text-xs text-[#C9A227]">
                  {overview.avg_dq_score !== null ? `${overview.avg_dq_score.toFixed(1)}%` : "--"} avg
                </span>
              </td>
              <td />
              <td />
              <td />
              <td className="px-4 py-2 text-right text-xs text-[#C9A227]">
                {overview.network_person_count?.toLocaleString() ?? "--"}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
