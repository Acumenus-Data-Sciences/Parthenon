import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDomainSummary, useTemporalTrends } from "../hooks/useAchillesData";
import { TopConceptsBar } from "../components/charts/TopConceptsBar";
import { TemporalTrendChart } from "../components/charts/TemporalTrendChart";
import { ConceptDrilldownPanel } from "../components/ConceptDrilldownPanel";
import type { Domain } from "../types/dataExplorer";
import { DOMAIN_LABELS } from "../types/dataExplorer";

interface DomainTabProps {
  sourceId: number;
}

const DOMAINS: Domain[] = [
  "condition",
  "drug",
  "procedure",
  "measurement",
  "observation",
  "visit",
];

export default function DomainTab({ sourceId }: DomainTabProps) {
  const [activeDomain, setActiveDomain] = useState<Domain>("condition");
  const [selectedConceptId, setSelectedConceptId] = useState<number | null>(null);

  const domainSummary = useDomainSummary(sourceId, activeDomain);
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
        <div className="flex items-center gap-1 border-b border-[#232328]">
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
                  ? "text-[#F0EDE8] font-medium"
                  : "text-[#8A857D] hover:text-[#C5C0B8]",
              )}
            >
              {DOMAIN_LABELS[domain]}
              {activeDomain === domain && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A227]" />
              )}
            </button>
          ))}
        </div>

        {/* Domain summary stats */}
        {domainSummary.data && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#232328] bg-[#151518] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
                Total Records
              </p>
              <p className="mt-1 font-serif text-xl font-bold text-[#F0EDE8]">
                {domainSummary.data.totalRecords.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-[#232328] bg-[#151518] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
                Distinct Concepts
              </p>
              <p className="mt-1 font-serif text-xl font-bold text-[#F0EDE8]">
                {domainSummary.data.totalConcepts.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {domainSummary.isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-[#8A857D]" />
          </div>
        )}

        {/* Error state */}
        {domainSummary.error && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-[#E85A6B]">
              Failed to load {DOMAIN_LABELS[activeDomain]} data
            </p>
          </div>
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
            title={`${DOMAIN_LABELS[activeDomain]} Temporal Trend`}
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
