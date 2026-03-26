import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Upload,
  ScanSearch,
  GitMerge,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Lazy-load tab content to avoid loading everything upfront
const IngestionDashboardPage = lazy(
  () => import("./IngestionDashboardPage"),
);
const SourceProfilerPage = lazy(
  () => import("@/features/etl/pages/SourceProfilerPage"),
);
const EtlToolsPage = lazy(
  () => import("@/features/etl/pages/EtlToolsPage"),
);
const FhirIngestionPage = lazy(
  () => import("@/features/etl/pages/FhirIngestionPage"),
);

// React Flow icon (inline SVG to avoid adding a dependency for one icon)
function AqueductIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="5" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M7 6h10M7 18h10M5 8v8M19 8v8" />
    </svg>
  );
}

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon | typeof AqueductIcon;
  description: string;
}

const TABS: Tab[] = [
  {
    id: "upload",
    label: "Upload Files",
    icon: Upload,
    description: "Upload CSV/Excel files for CDM ingestion",
  },
  {
    id: "profiler",
    label: "Source Profiler",
    icon: ScanSearch,
    description: "Profile source databases with WhiteRabbit",
  },
  {
    id: "aqueduct",
    label: "Aqueduct",
    icon: AqueductIcon as unknown as LucideIcon,
    description: "Design ETL mappings to OMOP CDM",
  },
  {
    id: "fhir",
    label: "FHIR Ingestion",
    icon: GitMerge,
    description: "Import FHIR Bundles into CDM",
  },
];

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  );
}

export default function DataIngestionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");

  // Determine initial tab from URL param or default
  const [activeTab, setActiveTab] = useState(() => {
    if (tabParam && TABS.some((t) => t.id === tabParam)) return tabParam;
    return "upload";
  });

  // Sync tab changes to URL
  useEffect(() => {
    if (tabParam !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, tabParam, setSearchParams]);

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="border-b border-[#2a2a3e] bg-[#0E0E11]">
        <div className="flex items-center gap-1 px-6 pt-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors",
                  isActive
                    ? "bg-[#1a1a2e] text-white border-t border-x border-[#2a2a3e] -mb-px"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2e]/50",
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        <Suspense fallback={<LoadingFallback />}>
          {activeTab === "upload" && <IngestionDashboardPage />}
          {activeTab === "profiler" && <SourceProfilerPage />}
          {activeTab === "aqueduct" && <EtlToolsPage />}
          {activeTab === "fhir" && <FhirIngestionPage />}
        </Suspense>
      </div>
    </div>
  );
}
