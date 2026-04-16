// frontend/src/features/finngen-analyses/pages/AnalysisGalleryPage.tsx
import { useCallback } from "react";
import type { FinnGenAnalysisModule } from "@/features/_finngen-foundation";
import { useAnalysisModules } from "../hooks/useAnalysisModules";
import { useAllFinnGenRuns } from "../hooks/useModuleRuns";
import { ModuleCard } from "../components/ModuleCard";
import { Loader2 } from "lucide-react";

interface AnalysisGalleryPageProps {
  sourceKey: string;
  onSelectModule: (module: FinnGenAnalysisModule) => void;
}

export function AnalysisGalleryPage({ sourceKey, onSelectModule }: AnalysisGalleryPageProps) {
  const { data: modules, isLoading: modulesLoading } = useAnalysisModules();
  const { data: runsResponse } = useAllFinnGenRuns({ sourceKey });

  // Filter to CO2 modules only (SP3 scope)
  const co2Modules = (modules ?? []).filter((m) => m.key.startsWith("co2."));

  // Count runs per module
  const runCountByModule = useCallback(
    (moduleKey: string) => {
      if (!runsResponse?.data) return 0;
      return runsResponse.data.filter((r) => r.analysis_type === moduleKey).length;
    },
    [runsResponse],
  );

  if (modulesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-text-ghost" />
        <span className="ml-2 text-sm text-text-ghost">Loading modules...</span>
      </div>
    );
  }

  if (co2Modules.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-text-muted">
        No analysis modules available.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-text-primary">FinnGen Analysis Modules</h2>
        <p className="text-xs text-text-muted mt-1">
          Select a module to configure and run a statistical analysis on your cohorts.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {co2Modules.map((mod) => (
          <ModuleCard
            key={mod.key}
            module={mod}
            runCount={runCountByModule(mod.key)}
            onClick={() => onSelectModule(mod)}
          />
        ))}
      </div>
    </div>
  );
}
