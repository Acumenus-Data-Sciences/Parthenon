import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SourceSelector } from "@/features/data-explorer/components/SourceSelector";
import { BundleList } from "../components/BundleList";
import { PopulationComplianceDashboard } from "../components/PopulationComplianceDashboard";
import { useCreateBundle } from "../hooks/useCareGaps";
import { HelpButton } from "@/features/help";

type Tab = "bundles" | "population";

export default function CareGapsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("app");
  const [activeTab, setActiveTab] = useState<Tab>("bundles");
  const [sourceId, setSourceId] = useState<number | null>(null);
  const createMutation = useCreateBundle();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateBundle = () => {
    setIsCreating(true);
    createMutation.mutate(
      {
        bundle_code: "UNTITLED",
        condition_name: t("careGaps.page.untitledBundle"),
      },
      {
        onSuccess: (bundle) => {
          navigate(`/care-gaps/${bundle.id}`);
        },
        onSettled: () => {
          setIsCreating(false);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {t("careGaps.page.title")}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {t("careGaps.page.subtitle")}
            </p>
          </div>
          <HelpButton helpKey="care-gaps" />
        </div>

        <div className="flex items-center gap-3">
          {/* Source selector */}
          <SourceSelector value={sourceId} onChange={setSourceId} />

          {/* Create button */}
          <button
            type="button"
            onClick={handleCreateBundle}
            disabled={isCreating}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
          >
            {isCreating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            {t("careGaps.common.actions.newBundle")}
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-border-default">
        {(
          [
            {
              key: "bundles" as const,
              label: t("careGaps.page.tabs.bundles"),
            },
            {
              key: "population" as const,
              label: t("careGaps.page.tabs.population"),
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "text-success"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-success" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "bundles" ? (
        <BundleList onCreateClick={handleCreateBundle} />
      ) : (
        <PopulationComplianceDashboard sourceId={sourceId} />
      )}
    </div>
  );
}
