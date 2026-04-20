import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useDomainSummary, useTemporalTrends, useConceptHierarchy } from "../hooks/useAchillesData";
import { TopConceptsBar } from "../components/charts/TopConceptsBar";
import { HierarchyBarChart } from "../components/charts/HierarchyBarChart";
import { TemporalTrendChart } from "../components/charts/TemporalTrendChart";
import { ConceptDrilldownPanel } from "../components/ConceptDrilldownPanel";
import type { Domain } from "../types/dataExplorer";

interface DomainTabProps {
  sourceId: number;
  initialDomain?: Domain;
}

const DOMAINS: Domain[] = [
  "condition",
  "drug",
  "procedure",
  "measurement",
  "observation",
  "visit",
];

export default function DomainTab({ sourceId, initialDomain }: DomainTabProps) {
  const { t } = useTranslation("app");
  const [activeDomain, setActiveDomain] = useState<Domain>(initialDomain ?? "condition");
  const [selectedConceptId, setSelectedConceptId] = useState<number | null>(null);

  const domainSummary = useDomainSummary(sourceId, activeDomain);
  const conceptHierarchy = useConceptHierarchy(sourceId, activeDomain);
  const temporalTrends = useTemporalTrends(sourceId, activeDomain);

  const handleConceptClick = useCallback((conceptId: number) => {
    setSelectedConceptId(conceptId);
  }, []);

  const handleCloseDrilldown = useCallback(() => {
    setSelectedConceptId(null);
  }, []);

  return (
    <div className="flex gap-0">
      {/* Main content */}
      <div className={cn("flex-1 space-y-6", selectedConceptId != null && "pr-4")}>
        {/* Domain sub-tabs */}
        <div className="flex items-center gap-1 border-b border-border-default">
          {DOMAINS.map((domain) => (
            <button
              key={domain}
              type="button"
              onClick={() => {
                setActiveDomain(domain);
                setSelectedConceptId(null);
              }}
              className={cn(
                "relative px-4 py-2.5 text-sm transition-colors",
                activeDomain === domain
                  ? "text-text-primary font-medium"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {t(`dataExplorer.domains.${domain}`)}
              {activeDomain === domain && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
              )}
            </button>
          ))}
        </div>

        {/* Domain summary stats */}
        {domainSummary.data && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border-default bg-surface-raised p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {t("dataExplorer.domain.metrics.totalRecords")}
              </p>
              <p className="mt-1 font-serif text-xl font-bold text-text-primary">
                {domainSummary.data.totalRecords.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-border-default bg-surface-raised p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {t("dataExplorer.domain.metrics.distinctConcepts")}
              </p>
              <p className="mt-1 font-serif text-xl font-bold text-text-primary">
                {domainSummary.data.totalConcepts.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {domainSummary.isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        )}

        {/* Error state */}
        {domainSummary.error && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-critical">
              {t("dataExplorer.domain.loadFailed", {
                domain: t(`dataExplorer.domains.${activeDomain}`),
              })}
            </p>
          </div>
        )}

        {/* Classification hierarchy */}
        {conceptHierarchy.data?.hierarchy && conceptHierarchy.data.hierarchy.length > 0 && (
          <HierarchyBarChart
            data={conceptHierarchy.data.hierarchy}
            hasHierarchy={conceptHierarchy.data.hasHierarchy}
            domain={activeDomain}
          />
        )}

        {/* Top concepts */}
        {domainSummary.data?.topConcepts && (
          <TopConceptsBar
            data={domainSummary.data.topConcepts}
            onConceptClick={handleConceptClick}
          />
        )}

        {/* Temporal trends */}
        {temporalTrends.data && temporalTrends.data.length > 0 && (
          <TemporalTrendChart
            data={temporalTrends.data}
            title={t("dataExplorer.domain.temporalTrendTitle", {
              domain: t(`dataExplorer.domains.${activeDomain}`),
            })}
          />
        )}
      </div>

      {/* Drilldown panel (slide-in from right) */}
      {selectedConceptId != null && (
        <div className="w-[420px] shrink-0 animate-in slide-in-from-right duration-200">
          <ConceptDrilldownPanel
            sourceId={sourceId}
            domain={activeDomain}
            conceptId={selectedConceptId}
            onClose={handleCloseDrilldown}
          />
        </div>
      )}
    </div>
  );
}
