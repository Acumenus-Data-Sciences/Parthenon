// frontend/src/features/finngen-analyses/pages/AnalysisGalleryPage.tsx
import { useCallback } from "react";
import type { FinnGenAnalysisModule } from "@/features/_finngen-foundation";
import { useAnalysisModules } from "../hooks/useAnalysisModules";
import { useAllFinnGenRuns } from "../hooks/useModuleRuns";
import { ModuleCard } from "../components/ModuleCard";
import { Loader2 } from "lucide-react";
import { Shell } from "@/components/workbench/primitives";

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

  return (
    <Shell
      title="Analysis modules"
      subtitle="Pick a CO2 module to configure and run a statistical analysis on your cohorts."
    >
      <div className="p-4">
        {modulesLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-text-ghost" />
            <span className="ml-2 text-sm text-text-ghost">Loading modules…</span>
          </div>
        )}

        {!modulesLoading && co2Modules.length === 0 && (
          <div className="py-10 text-center text-sm text-text-muted">
            No analysis modules available.
          </div>
        )}

        {!modulesLoading && co2Modules.length > 0 && (
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
        )}
      </div>
    </Shell>
  );
}
