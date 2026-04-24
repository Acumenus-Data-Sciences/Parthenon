import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, PanelsTopLeft, RefreshCw } from "lucide-react";
import { Shell } from "@/components/workbench/primitives";
import { useBundles } from "@/features/care-gaps/hooks/useCareGaps";
import {
  useCareBundleCoverage,
  useCareBundleSources,
  useMaterializeAllCareBundles,
} from "../hooks";
import { formatRelativeTime } from "../lib/formatting";
import { WorkbenchTabs } from "../components/WorkbenchTabs";

export default function CareBundlesHomePage() {
  const bundlesQuery = useBundles({ per_page: 100 });
  const sourcesQuery = useCareBundleSources();
  const coverageQuery = useCareBundleCoverage();
  const materializeAll = useMaterializeAllCareBundles();

  const [showResearchOnly, setShowResearchOnly] = useState(false);

  const bundles = bundlesQuery.data?.data ?? [];
  const allSources = sourcesQuery.data?.data ?? [];
  const minPop = sourcesQuery.data?.meta.min_population ?? 100_000;
  const sources = showResearchOnly ? allSources : allSources.filter((s) => s.qualifies);
  const coverage = coverageQuery.data ?? [];
  const nonQualifyingCount = allSources.length - allSources.filter((s) => s.qualifies).length;

  const cellKey = (bundleId: number, sourceId: number) =>
    `${bundleId}:${sourceId}`;
  const coverageByCell = new Map(
    coverage.map((c) => [cellKey(c.condition_bundle_id, c.source_id), c]),
  );

  const isLoading =
    bundlesQuery.isLoading || sourcesQuery.isLoading || coverageQuery.isLoading;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised">
            <PanelsTopLeft className="h-5 w-5 text-text-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              CareBundles Workbench
            </h1>
            <p className="text-sm text-text-ghost">
              Qualified patient counts per care bundle × data source.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => materializeAll.mutate()}
            disabled={materializeAll.isPending}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {materializeAll.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Materialize all
          </button>
        </div>
      </header>

      <WorkbenchTabs />

      {nonQualifyingCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-xs">
          <span className="text-text-ghost">
            {nonQualifyingCount} source{nonQualifyingCount === 1 ? "" : "s"} hidden
            (N &lt; {minPop.toLocaleString()} — not adequate for quality measurement).
          </span>
          <label className="flex items-center gap-2 text-text-muted">
            <input
              type="checkbox"
              checked={showResearchOnly}
              onChange={(e) => setShowResearchOnly(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Show research-only sources
          </label>
        </div>
      )}

      <Shell
        title="Coverage matrix"
        subtitle={`${bundles.length} bundles × ${sources.length} sources`}
      >
        <div className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-text-ghost">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading coverage…
            </div>
          ) : bundles.length === 0 || sources.length === 0 ? (
            <p className="p-6 text-sm text-text-ghost">
              No bundles or sources configured yet.
            </p>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="sticky left-0 z-10 bg-surface-raised px-4 py-2 text-left text-xs font-semibold text-text-ghost">
                    Bundle
                  </th>
                  {sources.map((source) => (
                    <th
                      key={source.id}
                      className="px-4 py-2 text-right text-xs font-semibold text-text-ghost"
                    >
                      {source.source_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bundles.map((bundle) => (
                  <tr
                    key={bundle.id}
                    className="border-b border-border-default/60 hover:bg-surface-overlay/40"
                  >
                    <td className="sticky left-0 z-10 bg-surface-raised px-4 py-2">
                      <Link
                        to={`/workbench/care-bundles/${bundle.id}`}
                        className="text-sm font-medium text-text-primary hover:underline"
                      >
                        {bundle.condition_name}
                      </Link>
                      <div className="text-[10px] uppercase tracking-wide text-text-ghost">
                        {bundle.bundle_code}
                      </div>
                    </td>
                    {sources.map((source) => {
                      const cell = coverageByCell.get(cellKey(bundle.id, source.id));
                      return (
                        <td
                          key={source.id}
                          className="px-4 py-2 text-right font-mono text-xs"
                          style={{
                            color: cell
                              ? "var(--text-primary)"
                              : "var(--text-ghost)",
                          }}
                          title={
                            cell
                              ? `Updated ${formatRelativeTime(cell.updated_at)}`
                              : "No materialization yet"
                          }
                        >
                          {cell ? cell.qualified_patients.toLocaleString() : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Shell>
    </div>
  );
}
