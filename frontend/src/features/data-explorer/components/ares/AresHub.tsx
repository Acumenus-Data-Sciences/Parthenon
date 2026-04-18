import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/format";
import type { AresSection } from "../../types/ares";
import { useAresHubKpis } from "../../hooks/useAresHub";
import { AresHealthBanner } from "./AresHealthBanner";
import { HubCard } from "./HubCard";
import { HubCardSkeleton } from "./HubCardSkeleton";

interface AresHubProps {
  onNavigate: (section: AresSection) => void;
}

export function AresHub({ onNavigate }: AresHubProps) {
  const { t } = useTranslation("app");
  const { data: kpis, isLoading } = useAresHubKpis();

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Banner skeleton */}
        <div className="h-20 animate-pulse rounded-xl border border-border-subtle bg-surface-raised" />

        {/* Row 1 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <HubCardSkeleton />
          <HubCardSkeleton />
          <HubCardSkeleton />
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <HubCardSkeleton />
          <HubCardSkeleton />
          <HubCardSkeleton />
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <HubCardSkeleton />
          <HubCardSkeleton />
          <HubCardSkeleton />
        </div>

        {/* Row 4 */}
        <div className="grid grid-cols-1 gap-4">
          <HubCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AresHealthBanner
        sourceCount={kpis?.source_count ?? 0}
        avgDqScore={kpis?.avg_dq_score ?? null}
        unmappedCodes={kpis?.total_unmapped_codes ?? 0}
        annotationCount={kpis?.annotation_count ?? 0}
      />

      {/* Row 1: Primary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HubCard section="network-overview" title={t("dataExplorer.ares.sections.networkOverview")} accentColor="var(--success)" onClick={onNavigate}>
          <p className="text-2xl font-semibold text-text-primary">
            {kpis?.source_count != null ? formatNumber(kpis.source_count) : "--"}
          </p>
          <p className="text-sm text-text-muted">
            {kpis?.sources_needing_attention
              ? t("dataExplorer.ares.cards.sourcesBelowDq", {
                  count: kpis.sources_needing_attention,
                  value: formatNumber(kpis.sources_needing_attention),
                })
              : t("dataExplorer.ares.cards.networkOverviewDescription")}
          </p>
        </HubCard>
        <HubCard section="concept-comparison" title={t("dataExplorer.ares.sections.conceptComparison")} accentColor="var(--accent)" onClick={onNavigate}>
          <p className="text-sm text-text-muted">
            {t("dataExplorer.ares.cards.conceptComparisonDescription")}
          </p>
        </HubCard>
        <HubCard section="dq-history" title={t("dataExplorer.ares.sections.dqHistory")} accentColor="var(--success)" onClick={onNavigate}>
          <p className="text-2xl font-semibold text-text-primary">
            {kpis?.avg_dq_score != null
              ? `${formatNumber(kpis.avg_dq_score, { maximumFractionDigits: 1 })}%`
              : "--"}
          </p>
          <p className="text-sm text-text-muted">
            {t("dataExplorer.ares.cards.dqHistoryDescription")}
          </p>
        </HubCard>
      </div>

      {/* Row 2: Secondary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HubCard section="coverage" title={t("dataExplorer.ares.sections.coverageMatrix")} accentColor="var(--primary)" onClick={onNavigate}>
          <p className="text-sm text-text-muted">
            {t("dataExplorer.ares.cards.coverageDescription")}
          </p>
        </HubCard>
        <HubCard section="feasibility" title={t("dataExplorer.ares.sections.feasibility")} accentColor="var(--accent)" onClick={onNavigate}>
          <p className="text-sm text-text-muted">
            {t("dataExplorer.ares.cards.feasibilityDescription")}
          </p>
        </HubCard>
        <HubCard section="diversity" title={t("dataExplorer.ares.sections.diversity")} accentColor="var(--success)" onClick={onNavigate}>
          <p className="text-sm text-text-muted">
            {t("dataExplorer.ares.cards.diversityDescription")}
          </p>
        </HubCard>
      </div>

      {/* Row 3: Tertiary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HubCard section="releases" title={t("dataExplorer.ares.sections.releases")} accentColor="var(--accent)" onClick={onNavigate}>
          <p className="text-sm text-text-muted">
            {t("dataExplorer.ares.cards.releasesDescription")}
          </p>
        </HubCard>
        <HubCard section="unmapped-codes" title={t("dataExplorer.ares.sections.unmappedCodes")} accentColor="var(--primary)" onClick={onNavigate}>
          <p className="text-2xl font-semibold text-text-primary">
            {kpis?.total_unmapped_codes !== undefined
              ? formatNumber(kpis.total_unmapped_codes)
              : "--"}
          </p>
          <p className="text-sm text-text-muted">
            {t("dataExplorer.ares.cards.unmappedCodesDescription")}
          </p>
        </HubCard>
        <HubCard section="annotations" title={t("dataExplorer.ares.sections.annotations")} accentColor="var(--success)" onClick={onNavigate}>
          <p className="text-2xl font-semibold text-text-primary">
            {kpis?.annotation_count != null ? formatNumber(kpis.annotation_count) : "--"}
          </p>
          <p className="text-sm text-text-muted">
            {t("dataExplorer.ares.cards.annotationsDescription")}
          </p>
        </HubCard>
      </div>

      {/* Row 4: Bottom */}
      <div className="grid grid-cols-1 gap-4">
        <HubCard section="cost" title={t("dataExplorer.ares.sections.costAnalysis")} accentColor="var(--accent)" onClick={onNavigate}>
          <p className="text-sm text-text-muted">
            {t("dataExplorer.ares.cards.costDescription")}
          </p>
        </HubCard>
      </div>
    </div>
  );
}
