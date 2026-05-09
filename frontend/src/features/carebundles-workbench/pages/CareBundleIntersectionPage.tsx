import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, GitMerge, Loader2 } from "lucide-react";
import { Shell } from "@/components/workbench/primitives";
import { HelpButton } from "@/features/help";
import { useBundles } from "@/features/care-gaps/hooks/useCareGaps";
import { useSources } from "@/features/data-sources/hooks/useSources";
import { UpSetPlot } from "../components/UpSetPlot";
import { VennDiagram } from "../components/VennDiagram";
import { IntersectionCohortDialog } from "../components/IntersectionCohortDialog";
import { useCareBundleIntersection } from "../hooks";
import type { IntersectionMode } from "../types";
import { tAuto } from "@/i18n/autoUserFacing";

export default function CareBundleIntersectionPage() {
  const bundlesQuery = useBundles({ per_page: 100 });
  const sourcesQuery = useSources();

  const [sourceId, setSourceId] = useState<number | null>(null);
  const [selectedBundleIds, setSelectedBundleIds] = useState<number[]>([]);
  const [mode, setMode] = useState<IntersectionMode>("all");
  const [chart, setChart] = useState<"upset" | "venn">("upset");
  const [dialogOpen, setDialogOpen] = useState(false);

  const bundles = useMemo(
    () => bundlesQuery.data?.data ?? [],
    [bundlesQuery.data],
  );
  const sources = sourcesQuery.data ?? [];

  // Default source falls back to the first available; we never write the
  // default into `sourceId` state, so all downstream queries use
  // `effectiveSourceId` directly. (Avoids the render-time setState
  // anti-pattern and the setState-in-effect anti-pattern.)
  const effectiveSourceId = sourceId ?? sources[0]?.id ?? null;

  const intersection = useCareBundleIntersection(
    effectiveSourceId,
    selectedBundleIds,
    mode,
  );

  const selectedBundles = useMemo(
    () => bundles.filter((b) => selectedBundleIds.includes(b.id)),
    [bundles, selectedBundleIds],
  );

  const toggleBundle = (id: number) => {
    setSelectedBundleIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/workbench/care-bundles"
            className="inline-flex items-center gap-1 text-xs text-text-ghost hover:text-text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            {tAuto("coverageMatrix_3e46ef46")}
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised">
              <GitMerge className="h-5 w-5 text-text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                {tAuto("intersectionExplorer_9b71c86f")}
              </h1>
              <p className="text-sm text-text-ghost">
                {tAuto("crossBundleComorbidityCountsAgainstOneDataSource_adfdea9e")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <HelpButton helpKey="workbench.care-bundles.intersect" />
          <button
            onClick={() => setDialogOpen(true)}
            disabled={
              intersection.data == null ||
              intersection.data.count === 0 ||
              selectedBundleIds.length < 1
            }
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {tAuto("saveIntersectionAsCohort_aa5896ec")}
          </button>
        </div>
      </header>

      <Shell title={tAuto("query_a618b4be")} subtitle="Pick bundles, a source, and a mode">
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-ghost">
              {tAuto("source_6da13add")}
            </label>
            <select
              value={effectiveSourceId ?? ""}
              onChange={(e) => setSourceId(Number(e.target.value))}
              className="rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-sm text-text-primary"
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.source_name}
                </option>
              ))}
            </select>

            <div className="ml-6 flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-text-ghost">
                {tAuto("mode_a7b93d21")}
              </label>
              {(["all", "any", "exactly"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium uppercase tracking-wide transition-colors ${
                    mode === m
                      ? "bg-primary text-text-primary"
                      : "border border-border-default bg-surface-base text-text-muted hover:bg-surface-overlay"
                  }`}
                  style={mode === m ? { backgroundColor: "var(--primary)" } : {}}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="ml-6 flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-text-ghost">
                {tAuto("chart_66c77347")}
              </label>
              {(["upset", "venn"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setChart(c)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium uppercase tracking-wide transition-colors ${
                    chart === c
                      ? "bg-accent text-text-primary"
                      : "border border-border-default bg-surface-base text-text-muted hover:bg-surface-overlay"
                  }`}
                  style={chart === c ? { backgroundColor: "var(--accent)" } : {}}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-ghost">
              {tAuto("bundles_abf552f5")}{selectedBundleIds.length} {tAuto("selected_23f30dee")}
            </p>
            <div className="flex flex-wrap gap-2">
              {bundles.map((b) => {
                const selected = selectedBundleIds.includes(b.id);
                return (
                  <button
                    key={b.id}
                    onClick={() => toggleBundle(b.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      selected
                        ? "border-primary bg-primary/20 text-text-primary"
                        : "border-border-default bg-surface-base text-text-muted hover:bg-surface-overlay"
                    }`}
                  >
                    <span className="font-semibold">{b.bundle_code}</span>
                    <span className="ml-2 text-text-ghost">{b.condition_name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Shell>

      <Shell title={tAuto("result_5faa59d4")} subtitle={`${mode.toUpperCase()} of ${selectedBundleIds.length} bundles`}>
        {selectedBundleIds.length === 0 ? (
          <p className="p-6 text-sm text-text-ghost">
            {tAuto("pickOneOrMoreBundlesToComputeAn_5a326abd")}
          </p>
        ) : intersection.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-text-ghost">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tAuto("computingIntersection_6911da37")}
          </div>
        ) : intersection.isError ? (
          <p className="p-6 text-sm text-red-300">
            {(intersection.error as Error | null)?.message ??
              "Intersection computation failed."}
          </p>
        ) : intersection.data ? (
          <div className="space-y-4 p-4">
            <div className="flex items-baseline gap-4">
              <p className="text-4xl font-bold text-text-primary">
                {intersection.data.count.toLocaleString()}
              </p>
              <p className="text-sm text-text-ghost">
                {tAuto("qualifiedPersonsIn_d9777523")} {selectedBundles.map((b) => b.bundle_code).join(", ")}
              </p>
            </div>

            <div className="rounded-lg border border-border-default bg-surface-base">
              {chart === "upset" ? (
                <UpSetPlot cells={intersection.data.upset_cells} bundles={selectedBundles} />
              ) : (
                <VennDiagram cells={intersection.data.upset_cells} bundles={selectedBundles} />
              )}
            </div>

            {intersection.data.sample_person_ids.length > 0 && (
              <details className="text-xs text-text-ghost">
                <summary className="cursor-pointer text-text-muted">
                  {tAuto("samplePersonIds_7bbd53bc")}{intersection.data.sample_person_ids.length} of {intersection.data.count})
                </summary>
                <p className="mt-2 font-mono text-[11px]">
                  {intersection.data.sample_person_ids.join(", ")}
                </p>
              </details>
            )}
          </div>
        ) : null}
      </Shell>

      {dialogOpen && effectiveSourceId != null && intersection.data && (
        <IntersectionCohortDialog
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
          sourceId={effectiveSourceId}
          bundleIds={selectedBundleIds}
          bundles={selectedBundles}
          mode={mode}
          intersectionCount={intersection.data.count}
        />
      )}
    </div>
  );
}
