import { useState, useCallback, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, PlayCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { SourceSelector } from "../components/SourceSelector";
import { HelpButton } from "@/features/help";
import apiClient from "@/lib/api-client";
import type { Domain } from "../types/dataExplorer";

const VALID_DOMAINS = new Set<Domain>(["condition", "drug", "procedure", "measurement", "observation", "visit"]);

// Lazy-loaded tab content
const OverviewTab = lazy(() => import("./OverviewTab"));
const DomainTab = lazy(() => import("./DomainTab"));
const DqdTab = lazy(() => import("./DqdTab"));
const TemporalTab = lazy(() => import("./TemporalTab"));
const HeelTab = lazy(() => import("./HeelTab"));

type TabId = "overview" | "domains" | "dqd" | "temporal" | "heel";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "domains", label: "Domains" },
  { id: "dqd", label: "Data Quality" },
  { id: "temporal", label: "Temporal" },
  { id: "heel", label: "Heel Checks" },
];

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={20} className="animate-spin text-[#8A857D]" />
    </div>
  );
}

export default function DataExplorerPage() {
  const { sourceId: sourceIdParam } = useParams<{ sourceId?: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [pendingDomain, setPendingDomain] = useState<Domain | null>(null);

  // Derive sourceId from URL param or local state
  const [localSourceId, setLocalSourceId] = useState<number | null>(
    sourceIdParam ? Number(sourceIdParam) : null,
  );
  const sourceId = sourceIdParam ? Number(sourceIdParam) : localSourceId;

  const handleSourceChange = (id: number) => {
    setLocalSourceId(id);
    navigate(`/data-explorer/${id}`, { replace: true });
  };

  // Cross-tab navigation (Overview metric cards → Domains tab)
  const handleNavigateToDomain = useCallback((domain: string) => {
    const resolved = VALID_DOMAINS.has(domain as Domain) ? (domain as Domain) : null;
    setPendingDomain(resolved);
    setActiveTab("domains");
  }, []);

  // Run Achilles mutation
  const achillesMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/sources/${sourceId}/achilles/run`).then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Data Explorer</h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Explore Achilles characterization results and data quality
          </p>
        </div>

        <div className="flex items-center gap-3">
          <HelpButton helpKey="data-explorer" />
          <SourceSelector
            value={sourceId}
            onChange={handleSourceChange}
          />

          {sourceId && sourceId > 0 && (
            <>
              <button
                type="button"
                onClick={() => achillesMutation.mutate()}
                disabled={achillesMutation.isPending}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#C5C0B8]",
                  "hover:bg-[#1A1A1E] hover:text-[#F0EDE8] transition-colors disabled:opacity-50",
                )}
              >
                {achillesMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <PlayCircle size={14} />
                )}
                Run Achilles
              </button>
            </>
          )}
        </div>
      </div>

      {/* Achilles run feedback */}
      {achillesMutation.isSuccess && (
        <div className="rounded-lg border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 px-4 py-2">
          <p className="text-sm text-[#2DD4BF]">Achilles run dispatched successfully</p>
        </div>
      )}
      {achillesMutation.isError && (
        <div className="rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-2">
          <p className="text-sm text-[#E85A6B]">Failed to dispatch Achilles run</p>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-[#232328]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm uppercase tracking-wide transition-colors",
              activeTab === tab.id
                ? "text-[#F0EDE8] font-medium"
                : "text-[#8A857D] hover:text-[#C5C0B8]",
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A227]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {!sourceId || sourceId <= 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-20">
          <p className="text-lg font-semibold text-[#F0EDE8]">
            Select a data source
          </p>
          <p className="mt-2 text-sm text-[#8A857D]">
            Choose a CDM source from the dropdown above to explore its data
          </p>
        </div>
      ) : (
        <Suspense fallback={<TabFallback />}>
          {activeTab === "overview" && <OverviewTab sourceId={sourceId} onNavigateToDomain={handleNavigateToDomain} />}
          {activeTab === "domains" && <DomainTab sourceId={sourceId} initialDomain={pendingDomain ?? undefined} />}
          {activeTab === "dqd" && <DqdTab sourceId={sourceId} />}
          {activeTab === "temporal" && <TemporalTab sourceId={sourceId} />}
          {activeTab === "heel" && <HeelTab sourceId={sourceId} />}
        </Suspense>
      )}
    </div>
  );
}
