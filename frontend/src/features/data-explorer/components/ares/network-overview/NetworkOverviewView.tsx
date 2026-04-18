import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { formatNumber } from "@/i18n/format";
import { useAlerts, useNetworkOverview, useNetworkDqRadar } from "../../../hooks/useNetworkData";
import type { NetworkDqSource } from "../../../types/ares";
import Sparkline from "../shared/Sparkline";
import AlertBanner from "./AlertBanner";
import DqRadarChart from "./DqRadarChart";
import FreshnessCell from "./FreshnessCell";

function DomainRing({ count }: { count: number }) {
  const fraction = count / 12;
  const circumference = 2 * Math.PI * 8; // r=8

  return (
    <div className="flex items-center gap-1">
      <svg width={20} height={20} viewBox="0 0 20 20">
        <circle cx={10} cy={10} r={8} fill="none" stroke="var(--surface-accent)" strokeWidth={2} />
        <circle
          cx={10}
          cy={10}
          r={8}
          fill="none"
          stroke="var(--success)"
          strokeWidth={2}
          strokeDasharray={`${fraction * circumference} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 10 10)"
        />
      </svg>
      <span className="text-xs text-text-muted">{count}/12</span>
    </div>
  );
}

export default function NetworkOverviewView() {
  const { t } = useTranslation("app");
  const [showRadar, setShowRadar] = useState(false);
  const { data: overview, isLoading } = useNetworkOverview();
  const { data: alerts } = useAlerts();
  const { data: radarProfiles } = useNetworkDqRadar();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="p-4 text-text-ghost">
        {t("dataExplorer.ares.networkOverview.messages.loading")}
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-4 text-center text-text-ghost">
        {t("dataExplorer.ares.networkOverview.messages.noData")}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-text-primary">
          {t("dataExplorer.ares.networkOverview.title")}
        </h2>
        <button
          type="button"
          onClick={() => setShowRadar(!showRadar)}
          className={`rounded-md border px-3 py-1 text-xs transition-colors ${
            showRadar
              ? "border-success bg-success/10 text-success"
              : "border-border-default text-text-muted hover:border-surface-highlight"
          }`}
        >
          {showRadar
            ? t("dataExplorer.ares.networkOverview.actions.hideRadar")
            : t("dataExplorer.ares.networkOverview.actions.dqRadar")}
        </button>
      </div>

      {/* DQ Radar chart */}
      {showRadar && radarProfiles && radarProfiles.length > 0 && (
        <div className="mb-6">
          <DqRadarChart profiles={radarProfiles} />
        </div>
      )}

      {/* Alert banner */}
      {alerts && alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-5 gap-3">
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-center">
          <p className="text-2xl font-semibold text-success">{formatNumber(overview.source_count)}</p>
          <p className="text-[11px] text-text-ghost">
            {t("dataExplorer.ares.networkOverview.metrics.dataSources")}
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-center">
          <p className="text-2xl font-semibold text-accent">
            {overview.avg_dq_score !== null
              ? t("dataExplorer.ares.networkOverview.percent", {
                value: formatNumber(overview.avg_dq_score, { maximumFractionDigits: 1 }),
              })
              : "--"}
          </p>
          <p className="text-[11px] text-text-ghost">
            {t("dataExplorer.ares.networkOverview.metrics.avgDqScore")}
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-center">
          <p className="text-2xl font-semibold text-primary">
            {formatNumber(overview.total_unmapped_codes)}
          </p>
          <p className="text-[11px] text-text-ghost">
            {t("dataExplorer.ares.networkOverview.metrics.unmappedCodes")}
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-center">
          <p className="text-2xl font-semibold text-text-primary">
            {formatNumber(overview.sources_needing_attention)}
          </p>
          <p className="text-[11px] text-text-ghost">
            {t("dataExplorer.ares.networkOverview.metrics.needAttention")}
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-center">
          <p className="text-2xl font-semibold text-success">
            {overview.network_person_count !== null && overview.network_person_count !== undefined
              ? formatNumber(overview.network_person_count)
              : "--"}
          </p>
          <p className="text-[11px] text-text-ghost">
            {t("dataExplorer.ares.networkOverview.metrics.totalPersons")}
          </p>
        </div>
      </div>

      {/* Source health table */}
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-surface-overlay">
            <tr className="border-b border-border-subtle">
              <th className="px-4 py-2 text-left text-[11px] font-medium uppercase text-text-muted">
                {t("dataExplorer.ares.networkOverview.table.source")}
              </th>
              <th className="px-4 py-2 text-center text-[11px] font-medium uppercase text-text-muted">
                {t("dataExplorer.ares.networkOverview.table.dqScore")}
              </th>
              <th className="px-4 py-2 text-center text-[11px] font-medium uppercase text-text-muted">
                {t("dataExplorer.ares.networkOverview.table.dqTrend")}
              </th>
              <th className="px-4 py-2 text-center text-[11px] font-medium uppercase text-text-muted">
                {t("dataExplorer.ares.networkOverview.table.freshness")}
              </th>
              <th className="px-4 py-2 text-center text-[11px] font-medium uppercase text-text-muted">
                {t("dataExplorer.ares.networkOverview.table.domains")}
              </th>
              <th className="px-4 py-2 text-right text-[11px] font-medium uppercase text-text-muted">
                {t("dataExplorer.ares.networkOverview.table.persons")}
              </th>
              <th className="px-4 py-2 text-left text-[11px] font-medium uppercase text-text-muted">
                {t("dataExplorer.ares.networkOverview.table.latestRelease")}
              </th>
            </tr>
          </thead>
          <tbody>
            {overview.dq_summary.map((source: NetworkDqSource) => (
              <tr
                key={source.source_id}
                onClick={() => navigate(`/data-explorer/${source.source_id}`)}
                className="cursor-pointer border-b border-border-subtle hover:bg-surface-raised"
              >
                <td className="px-4 py-2 text-text-primary">{source.source_name}</td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      source.pass_rate >= 90
                        ? "bg-success/20 text-success"
                        : source.pass_rate >= 80
                          ? "bg-accent/20 text-accent"
                          : "bg-primary/20 text-critical"
                    }`}
                  >
                    {source.pass_rate > 0
                      ? t("dataExplorer.ares.networkOverview.percent", {
                        value: formatNumber(source.pass_rate, { maximumFractionDigits: 1 }),
                      })
                      : "--"}
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
                <td className="px-4 py-2 text-right text-xs text-text-secondary">
                  {formatNumber(source.person_count)}
                </td>
                <td className="px-4 py-2 text-xs text-text-muted">
                  {source.release_name ?? t("dataExplorer.ares.networkOverview.messages.noReleases")}
                </td>
              </tr>
            ))}

            {/* Network aggregate row */}
            <tr className="border-t-2 border-border-default bg-surface-overlay font-medium">
              <td className="px-4 py-2 text-accent">
                {t("dataExplorer.ares.networkOverview.networkTotal")}
              </td>
              <td className="px-4 py-2 text-center">
                <span className="text-xs text-accent">
                  {overview.avg_dq_score !== null
                    ? t("dataExplorer.ares.networkOverview.averagePercent", {
                      value: formatNumber(overview.avg_dq_score, { maximumFractionDigits: 1 }),
                    })
                    : "--"}
                </span>
              </td>
              <td />
              <td />
              <td />
              <td className="px-4 py-2 text-right text-xs text-accent">
                {overview.network_person_count !== null && overview.network_person_count !== undefined
                  ? formatNumber(overview.network_person_count)
                  : "--"}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
