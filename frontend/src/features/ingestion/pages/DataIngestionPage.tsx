import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Lazy-load tab content
const IngestionDashboardPage = lazy(() => import("./IngestionDashboardPage"));
const SourceProfilerPage = lazy(
  () => import("@/features/etl/pages/SourceProfilerPage"),
);
const EtlToolsPage = lazy(
  () => import("@/features/etl/pages/EtlToolsPage"),
);
const FhirProjectWorkspacePage = lazy(
  () => import("./FhirProjectWorkspacePage"),
);
const PoseidonPage = lazy(
  () => import("@/features/poseidon/pages/PoseidonPage"),
);

type TabId = "upload" | "profiler" | "aqueduct" | "poseidon" | "fhir";

const TABS: { id: TabId; label: string }[] = [
  { id: "upload", label: "Ingestion" },
  { id: "profiler", label: "Source Profiler" },
  { id: "aqueduct", label: "Aqueduct" },
  { id: "poseidon", label: "Poseidon" },
  { id: "fhir", label: "Vulcan" },
];

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={20} className="animate-spin text-text-muted" />
    </div>
  );
}

export default function DataIngestionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (tabParam && TABS.some((t) => t.id === tabParam)) return tabParam as TabId;
    return "upload";
  });

  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  // Sync tab changes to URL
  useEffect(() => {
    if (tabParam !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, tabParam, setSearchParams]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Data Ingestion</h1>
          <p className="mt-1 text-sm text-text-muted">
            Upload files, profile sources, design ETL mappings, and import FHIR data
          </p>
        </div>
      </div>

      {/* Tab navigation — matches Data Explorer gold standard */}
      <div className="flex items-center gap-1 border-b border-border-default">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm uppercase tracking-wide transition-colors",
              activeTab === tab.id
                ? "text-text-primary font-medium"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <Suspense fallback={<TabFallback />}>
        {activeTab === "upload" && (
          <IngestionDashboardPage
            activeProjectId={activeProjectId}
            onActiveProjectChange={setActiveProjectId}
          />
        )}
        {activeTab === "profiler" && <SourceProfilerPage />}
        {activeTab === "aqueduct" && <EtlToolsPage />}
        {activeTab === "poseidon" && <PoseidonPage />}
        {activeTab === "fhir" && (
          <FhirProjectWorkspacePage
            activeProjectId={activeProjectId}
            onActiveProjectChange={setActiveProjectId}
          />
        )}
      </Suspense>
    </div>
  );
}
