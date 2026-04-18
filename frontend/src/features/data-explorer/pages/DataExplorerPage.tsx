import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSourceStore } from "@/stores/sourceStore";
import { HelpButton } from "@/features/help";
import type { Domain } from "../types/dataExplorer";

const VALID_DOMAINS = new Set<Domain>(["condition", "drug", "procedure", "measurement", "observation", "visit"]);

// Lazy-loaded tab content
const OverviewTab = lazy(() => import("./OverviewTab"));
const DomainTab = lazy(() => import("./DomainTab"));
const DqdTab = lazy(() => import("./DqdTab"));
const TemporalTab = lazy(() => import("./TemporalTab"));
const AchillesTab = lazy(() => import("./AchillesTab"));
const AresTab = lazy(() => import("./AresTab"));

type TabId = "overview" | "domains" | "dqd" | "temporal" | "heel" | "ares";

const TABS: TabId[] = ["overview", "domains", "temporal", "heel", "dqd", "ares"];

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={20} className="animate-spin text-text-muted" />
    </div>
  );
}

export default function DataExplorerPage() {
  const { t } = useTranslation("app");
  const { sourceId: sourceIdParam } = useParams<{ sourceId?: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [pendingDomain, setPendingDomain] = useState<Domain | null>(null);

  const { activeSourceId, setActiveSource } = useSourceStore();

  // Sync URL param → store on mount (deep-link support)
  useEffect(() => {
    if (sourceIdParam) {
      const paramId = Number(sourceIdParam);
      if (paramId !== activeSourceId) setActiveSource(paramId);
    }
  }, [sourceIdParam, activeSourceId, setActiveSource]);

  // Sync store → URL when store changes (header selector picks a new source)
  useEffect(() => {
    if (activeSourceId && activeSourceId !== Number(sourceIdParam)) {
      navigate(`/data-explorer/${activeSourceId}`, { replace: true });
    }
  }, [activeSourceId, sourceIdParam, navigate]);

  const sourceId = activeSourceId;

  // Cross-tab navigation (Overview metric cards → Domains tab)
  const handleNavigateToDomain = useCallback((domain: string) => {
    const resolved = VALID_DOMAINS.has(domain as Domain) ? (domain as Domain) : null;
    setPendingDomain(resolved);
    setActiveTab("domains");
  }, []);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {t("dataExplorer.page.title")}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {t("dataExplorer.page.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <HelpButton helpKey="data-explorer" />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-border-default">
        {TABS.map((tabId) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setActiveTab(tabId)}
            className={cn(
              "relative px-4 py-2.5 text-sm uppercase tracking-wide transition-colors",
              activeTab === tabId
                ? "text-text-primary font-medium"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {t(`dataExplorer.tabs.${tabId}`)}
            {activeTab === tabId && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "ares" ? (
        <Suspense fallback={<TabFallback />}>
          <AresTab />
        </Suspense>
      ) : !sourceId || sourceId <= 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-highlight bg-surface-raised py-20">
          <p className="text-lg font-semibold text-text-primary">
            {t("dataExplorer.page.selectSourceTitle")}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            {t("dataExplorer.page.selectSourceMessage")}
          </p>
        </div>
      ) : (
        <Suspense fallback={<TabFallback />}>
          {activeTab === "overview" && <OverviewTab sourceId={sourceId} onNavigateToDomain={handleNavigateToDomain} />}
          {activeTab === "domains" && <DomainTab sourceId={sourceId} initialDomain={pendingDomain ?? undefined} />}
          {activeTab === "dqd" && <DqdTab sourceId={sourceId} />}
          {activeTab === "temporal" && <TemporalTab sourceId={sourceId} />}
          {activeTab === "heel" && <AchillesTab sourceId={sourceId} />}
        </Suspense>
      )}
    </div>
  );
}
