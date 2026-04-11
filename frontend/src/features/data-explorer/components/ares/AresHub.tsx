import type { AresSection } from "../../types/ares";
import { useAresHubKpis } from "../../hooks/useAresHub";
import { AresHealthBanner } from "./AresHealthBanner";
import { HubCard } from "./HubCard";
import { HubCardSkeleton } from "./HubCardSkeleton";

interface AresHubProps {
  onNavigate: (section: AresSection) => void;
}

export function AresHub({ onNavigate }: AresHubProps) {
  const { data: kpis, isLoading } = useAresHubKpis();

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Banner skeleton */}
        <div className="h-20 animate-pulse rounded-xl border border-[#252530] bg-surface-raised" />

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
        <HubCard section="network-overview" title="Network Overview" accentColor="var(--success)" onClick={onNavigate}>
          <p className="text-2xl font-semibold text-white">{kpis?.source_count ?? "--"}</p>
          <p className="text-sm text-[#888]">
            {kpis?.sources_needing_attention
              ? `${kpis.sources_needing_attention} source${kpis.sources_needing_attention !== 1 ? "s" : ""} below 80% DQ`
              : "Source health, DQ scores, trend indicators"}
          </p>
        </HubCard>
        <HubCard section="concept-comparison" title="Concept Comparison" accentColor="var(--accent)" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Compare concept prevalence across sources</p>
        </HubCard>
        <HubCard section="dq-history" title="DQ History" accentColor="var(--success)" onClick={onNavigate}>
          <p className="text-2xl font-semibold text-white">
            {kpis?.avg_dq_score != null
              ? `${kpis.avg_dq_score.toFixed(1)}%`
              : "--"}
          </p>
          <p className="text-sm text-[#888]">Avg network DQ score over releases</p>
        </HubCard>
      </div>

      {/* Row 2: Secondary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HubCard section="coverage" title="Coverage Matrix" accentColor="var(--primary)" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Domain x source availability</p>
        </HubCard>
        <HubCard section="feasibility" title="Feasibility" accentColor="var(--accent)" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Can your network support a study?</p>
        </HubCard>
        <HubCard section="diversity" title="Diversity" accentColor="var(--success)" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Demographic parity across sources</p>
        </HubCard>
      </div>

      {/* Row 3: Tertiary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HubCard section="releases" title="Releases" accentColor="var(--accent)" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Version history per source</p>
        </HubCard>
        <HubCard section="unmapped-codes" title="Unmapped Codes" accentColor="var(--primary)" onClick={onNavigate}>
          <p className="text-2xl font-semibold text-white">
            {kpis?.total_unmapped_codes !== undefined
              ? kpis.total_unmapped_codes.toLocaleString()
              : "--"}
          </p>
          <p className="text-sm text-[#888]">Source codes without standard mappings</p>
        </HubCard>
        <HubCard section="annotations" title="Annotations" accentColor="var(--success)" onClick={onNavigate}>
          <p className="text-2xl font-semibold text-white">{kpis?.annotation_count ?? "--"}</p>
          <p className="text-sm text-[#888]">Chart notes across all sources</p>
        </HubCard>
      </div>

      {/* Row 4: Bottom */}
      <div className="grid grid-cols-1 gap-4">
        <HubCard section="cost" title="Cost Analysis" accentColor="var(--accent)" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Cost data by domain and over time</p>
        </HubCard>
      </div>
    </div>
  );
}
