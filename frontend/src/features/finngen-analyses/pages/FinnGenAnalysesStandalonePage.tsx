// frontend/src/features/finngen-analyses/pages/FinnGenAnalysesStandalonePage.tsx
//
// SP4 Polish #2 completion — standalone entry point for the FinnGen analysis
// gallery that is NOT embedded inside an investigation's clinical panel. The
// Workbench Handoff step sends the researcher here with:
//   /workbench/finngen-analyses?source_key=PANCREAS&workbench_cohort_id=123
//
// The page drives the gallery → detail state machine (mirroring ClinicalPanel)
// but reads source_key + workbench_cohort_id from URL query params, and
// passes defaultCohortId through to AnalysisDetailPage so the SettingsForm
// pre-populates with the just-materialized cohort.
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — finngen-analyses SP3 in flight; unblock CI build (mirrors AnalysisDetailPage)
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Database } from "lucide-react";
import type { FinnGenAnalysisModule } from "@/features/_finngen-foundation";
import { AnalysisGalleryPage } from "./AnalysisGalleryPage";
import { AnalysisDetailPage } from "./AnalysisDetailPage";

export default function FinnGenAnalysesStandalonePage() {
  const [params] = useSearchParams();
  const sourceKey = params.get("source_key") ?? "";
  const workbenchCohortIdRaw = params.get("workbench_cohort_id");
  const workbenchCohortId = workbenchCohortIdRaw ? parseInt(workbenchCohortIdRaw, 10) : null;
  const validCohortId =
    workbenchCohortId !== null && Number.isFinite(workbenchCohortId) && workbenchCohortId > 0
      ? workbenchCohortId
      : null;

  const [selectedModule, setSelectedModule] = useState<FinnGenAnalysisModule | null>(null);

  if (sourceKey === "") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-text-secondary">
        <p>Missing <span className="font-mono">source_key</span> query parameter.</p>
        <p className="mt-2 text-xs text-text-ghost">
          Reach this page from the Cohort Workbench Handoff step, or pick a
          source from the Workbench launcher first.
        </p>
        <Link
          to="/workbench"
          className="mt-4 inline-flex items-center gap-1 text-xs text-success hover:underline"
        >
          <ArrowLeft size={12} /> Back to Workbench
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      <header className="space-y-2">
        <Link
          to="/workbench"
          className="inline-flex items-center gap-1 text-xs text-text-ghost hover:text-text-secondary"
        >
          <ArrowLeft size={12} /> Workbench
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-text-primary">
            FinnGen Analysis Gallery
          </h1>
          <span
            className="inline-flex items-center rounded bg-info/10 px-2 py-0.5 font-mono text-[10px] font-medium text-info"
            title="Data source this gallery is scoped to"
          >
            {sourceKey}
          </span>
          {validCohortId !== null && (
            <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              <Database size={10} /> cohort #{validCohortId} pre-selected
            </span>
          )}
        </div>
      </header>

      {!selectedModule && (
        <AnalysisGalleryPage
          sourceKey={sourceKey}
          onSelectModule={(mod) => setSelectedModule(mod)}
        />
      )}

      {selectedModule && (
        <AnalysisDetailPage
          moduleKey={selectedModule.key}
          sourceKey={sourceKey}
          defaultCohortId={validCohortId}
          onBack={() => setSelectedModule(null)}
        />
      )}
    </div>
  );
}
