// Phase 16 Plan 05 Task 3 — FinnGenGwasResultsPage (SC-2 + SC-3 composition).
//
// Replaces the 23-LOC `FinnGenGwasResultsStubPage` at
// `/workbench/finngen-endpoints/:name/gwas/:run_id`. 3-panel layout
// (RESEARCH §Summary L122-128):
//
//   1. Header  — endpoint name (linked back to the endpoint browser
//                detail drawer via ?open=NAME) + run-id tail-8 short-code.
//   2. Manhattan panel — delegated to Plan 04's FinnGenManhattanPanel;
//      peak-click lifts `{ chrom, pos }` into the page so RegionalView
//      lazy-mounts below.
//   3. Top-50 Variants table — Plan 05 Task 2 component; row-click
//      lifts the TopVariantRow into `drawerVariant` state, rendering
//      the VariantDrawer slideover.
//
// Each of the 3 panels is wrapped in an ErrorBoundary with a panel-
// specific EmptyState fallback (Q8 RESOLVED) so a Canvas crash in the
// Manhattan plot doesn't take down the whole page.
//
// Threat T-16-S1b (open redirect via header Link): `encodeURIComponent`
// on the endpoint `name` before interpolating into the href.
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FinnGenManhattanPanel } from "../components/gwas-results/FinnGenManhattanPanel";
import { RegionalView } from "../components/gwas-results/RegionalView";
import { TopVariantsTable } from "../components/gwas-results/TopVariantsTable";
import { VariantDrawer } from "../components/gwas-results/VariantDrawer";
import { useTopVariants } from "../hooks/useTopVariants";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EmptyState } from "@/components/ui/EmptyState";
import type { TopVariantRow } from "../api/gwas-results";

export default function FinnGenGwasResultsPage(): JSX.Element {
  const params = useParams<{ name: string; run_id: string }>();
  const name = params.name ?? "";
  const runId = params.run_id ?? "";

  const [regionCenter, setRegionCenter] = useState<
    { chrom: string; pos: number } | null
  >(null);
  const [drawerVariant, setDrawerVariant] = useState<TopVariantRow | null>(
    null,
  );

  const topVariantsQuery = useTopVariants(runId, "p_value", "asc", 50);

  if (runId === "" || name === "") {
    return (
      <div className="p-8">
        <EmptyState
          title="Missing run parameters"
          message="Both endpoint name and run id are required in the URL."
        />
      </div>
    );
  }

  const runIdTail = runId.length > 8 ? runId.slice(-8) : runId;
  const endpointHref = `/workbench/finngen-endpoints?open=${encodeURIComponent(name)}`;

  return (
    <div
      className="mx-auto max-w-screen-2xl space-y-4 p-6"
      data-testid="finngen-gwas-results-page"
    >
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">GWAS Results</h1>
          <p className="text-xs text-text-muted">
            Endpoint:{" "}
            <Link
              to={endpointHref}
              className="underline"
              data-testid="gwas-header-endpoint-link"
            >
              {name}
            </Link>
            {" \u00B7 "}Run:{" "}
            <span className="font-mono" title={runId}>
              {"\u2026"}
              {runIdTail}
            </span>
          </p>
        </div>
      </header>

      <ErrorBoundary
        fallback={<EmptyState title="Manhattan plot failed to render" />}
      >
        <FinnGenManhattanPanel
          runId={runId}
          onPeakClick={(chrom, pos) => setRegionCenter({ chrom, pos })}
        />
      </ErrorBoundary>

      {regionCenter !== null && (
        <ErrorBoundary fallback={<EmptyState title="Regional view failed" />}>
          <RegionalView
            runId={runId}
            chrom={regionCenter.chrom}
            center={regionCenter.pos}
            onClose={() => setRegionCenter(null)}
          />
        </ErrorBoundary>
      )}

      <ErrorBoundary
        fallback={<EmptyState title="Top variants table failed" />}
      >
        <section
          className="rounded-lg border border-border bg-surface p-4"
          data-testid="gwas-top-variants-section"
        >
          <h2 className="mb-3 text-sm font-semibold">Top 50 Variants</h2>
          {topVariantsQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-text-muted">
              Loading top variants…
            </p>
          ) : (
            <TopVariantsTable
              rows={topVariantsQuery.data?.rows ?? []}
              onRowClick={setDrawerVariant}
            />
          )}
        </section>
      </ErrorBoundary>

      <VariantDrawer
        variant={drawerVariant}
        onClose={() => setDrawerVariant(null)}
      />
    </div>
  );
}
