// Phase 15 Plan 15-07 Task 2 — Stub page for the Phase 16 deep-link route.
//
// UI-SPEC §Deep-Link Forward Compatibility (lines 923-938): Phase 15 reserves
// the `/workbench/finngen-endpoints/:name/gwas/:run_id` path so GwasRunsSection
// <Link>s don't 404 before the PheWeb-lite page ships. The stub renders the
// shared EmptyState primitive with the EXACT copy from the UI-SPEC — future
// Phase 16 work replaces this component wholesale.
//
// Threat T-15-23 (open redirect via url params): this page does NOT read the
// `:name` or `:run_id` path params. It renders static copy only; Phase 16 will
// introduce the param-driven summary_stats fetch.
import { EmptyState } from "@/components/ui/EmptyState";

export default function FinnGenGwasResultsStubPage() {
  return (
    <div className="p-8">
      <EmptyState
        title="GWAS results page"
        message="This page ships in Phase 16 (PheWeb-lite UI)."
      />
    </div>
  );
}
