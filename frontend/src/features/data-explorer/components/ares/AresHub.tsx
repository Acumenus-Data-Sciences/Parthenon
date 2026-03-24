import type { AresSection } from "../../types/ares";
import { HubCard } from "./HubCard";
import { AresHealthBanner } from "./AresHealthBanner";

interface AresHubProps {
  onNavigate: (section: AresSection) => void;
}

export function AresHub({ onNavigate }: AresHubProps) {
  return (
    <div className="space-y-6">
      <AresHealthBanner
        sourceCount={0}
        avgDqScore={null}
        unmappedCodes={0}
        annotationCount={0}
      />

      {/* Row 1 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HubCard section="network-overview" title="Network Overview" accentColor="#2DD4BF" onClick={onNavigate}>
          High-level summary across all data sources in the network.
        </HubCard>
        <HubCard section="concept-comparison" title="Concept Comparison" accentColor="#C9A227" onClick={onNavigate}>
          Compare concept prevalence and distributions across sources.
        </HubCard>
        <HubCard section="dq-history" title="DQ History" accentColor="#9B1B30" onClick={onNavigate}>
          Track data quality trends over time across releases.
        </HubCard>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HubCard section="coverage" title="Coverage" accentColor="#2DD4BF" onClick={onNavigate}>
          Vocabulary coverage analysis and mapping completeness.
        </HubCard>
        <HubCard section="feasibility" title="Feasibility" accentColor="#C9A227" onClick={onNavigate}>
          Evaluate study feasibility based on available data.
        </HubCard>
        <HubCard section="diversity" title="Diversity" accentColor="#9B1B30" onClick={onNavigate}>
          Demographic diversity and representation analysis.
        </HubCard>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HubCard section="releases" title="Releases" accentColor="#2DD4BF" onClick={onNavigate}>
          Manage ETL releases and data snapshots per source.
        </HubCard>
        <HubCard section="unmapped-codes" title="Unmapped Codes" accentColor="#C9A227" onClick={onNavigate}>
          Review and prioritize unmapped source codes.
        </HubCard>
        <HubCard section="annotations" title="Annotations" accentColor="#9B1B30" onClick={onNavigate}>
          Chart annotations and contextual notes across visualizations.
        </HubCard>
      </div>

      {/* Row 4 */}
      <div className="grid grid-cols-1 gap-4">
        <HubCard section="cost" title="Cost" accentColor="#C9A227" onClick={onNavigate}>
          Cost analysis and resource utilization across the CDM.
        </HubCard>
      </div>
    </div>
  );
}
