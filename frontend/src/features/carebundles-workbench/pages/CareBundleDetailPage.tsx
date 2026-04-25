import { Fragment, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  GitCompareArrows,
  Info,
  Loader2,
  Play,
  Users,
} from "lucide-react";
import { Shell } from "@/components/workbench/primitives";
import { HelpButton } from "@/features/help";
import { useBundle } from "@/features/care-gaps/hooks/useCareGaps";
import { fetchFhirMeasure } from "../api";
import {
  useCareBundleQualifications,
  useCareBundleRuns,
  useCareBundleSources,
  useMaterializeCareBundle,
} from "../hooks";
import { formatRateWithCI, formatRelativeTime } from "../lib/formatting";
import { WorkbenchTabs } from "../components/WorkbenchTabs";
import { SourceQualifierBanner } from "../components/SourceQualifierBanner";
import { MeasureMethodologyModal } from "../components/MeasureMethodologyModal";
import { MeasureRosterModal } from "../components/MeasureRosterModal";
import { MeasureStrataRow } from "../components/MeasureStrataRow";

interface RosterTarget {
  measureId: number;
  measureCode: string | null;
  measureName: string | null;
}


export default function CareBundleDetailPage() {
  const { bundleId: bundleIdParam } = useParams<{ bundleId: string }>();
  const bundleId = bundleIdParam ? Number(bundleIdParam) : null;

  const [sourceId, setSourceId] = useState<number | null>(null);
  const [methodologyMeasureId, setMethodologyMeasureId] = useState<number | null>(null);
  const [rosterTarget, setRosterTarget] = useState<RosterTarget | null>(null);
  const [stratifiedMeasureIds, setStratifiedMeasureIds] = useState<Set<number>>(
    () => new Set(),
  );

  const toggleStrata = (measureId: number) => {
    setStratifiedMeasureIds((prev) => {
      const next = new Set(prev);
      if (next.has(measureId)) next.delete(measureId);
      else next.add(measureId);
      return next;
    });
  };

  const bundleQuery = useBundle(bundleId);
  const sourcesQuery = useCareBundleSources();
  const qualificationsQuery = useCareBundleQualifications(bundleId, sourceId);
  const runsQuery = useCareBundleRuns(bundleId);
  const materialize = useMaterializeCareBundle();

  const sources = useMemo(() => sourcesQuery.data?.data ?? [], [sourcesQuery.data]);
  const minPop = sourcesQuery.data?.meta.min_population ?? 100_000;

  // Default source: first qualifying one; fall back to any source if none qualify.
  const effectiveSourceId = useMemo(() => {
    if (sourceId != null) return sourceId;
    const firstQualifying = sources.find((s) => s.qualifies);
    return firstQualifying?.id ?? sources[0]?.id ?? null;
  }, [sourceId, sources]);

  const selectedSource = sources.find((s) => s.id === effectiveSourceId) ?? null;

  if (sourceId == null && effectiveSourceId != null) {
    setSourceId(effectiveSourceId);
  }

  const bundle = bundleQuery.data;
  const qualifications = qualificationsQuery.data;
  const runs = runsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <WorkbenchTabs />

      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/workbench/care-bundles"
            className="inline-flex items-center gap-1 text-xs text-text-ghost hover:text-text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            All care bundles
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-text-primary">
            {bundle?.condition_name ?? "…"}
          </h1>
          <p className="text-xs uppercase tracking-wide text-text-ghost">
            {bundle?.bundle_code}
          </p>
          {bundle?.description && (
            <p className="mt-2 max-w-2xl text-sm text-text-muted">
              {bundle.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <HelpButton helpKey="workbench.care-bundles.detail" />
          <select
            value={effectiveSourceId ?? ""}
            onChange={(e) => setSourceId(Number(e.target.value))}
            className="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary"
          >
            <optgroup label="Population measurement eligible (N ≥ 100K)">
              {sources.filter((s) => s.qualifies).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.source_name} ({s.person_count?.toLocaleString() ?? "?"})
                </option>
              ))}
            </optgroup>
            {sources.some((s) => !s.qualifies) && (
              <optgroup label="Research only (N &lt; 100K)">
                {sources.filter((s) => !s.qualifies).map((s) => (
                  <option key={s.id} value={s.id}>
                    ⚠ {s.source_name} ({s.person_count?.toLocaleString() ?? "?"})
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <Link
            to={`/workbench/care-bundles/${bundleId ?? ""}/compare`}
            className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-overlay"
            title="Compare this bundle's measures across qualifying sources"
          >
            <GitCompareArrows className="h-4 w-4" />
            Compare sources
          </Link>

          <button
            onClick={() =>
              bundleId != null && downloadFhirMeasure(bundleId, bundle?.bundle_code)
            }
            disabled={bundleId == null}
            className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-overlay disabled:opacity-60"
            title="Export FHIR R4 Measure resource"
          >
            <Download className="h-4 w-4" />
            FHIR Measure
          </button>

          <button
            onClick={() =>
              bundleId &&
              effectiveSourceId != null &&
              materialize.mutate({ bundleId, sourceId: effectiveSourceId })
            }
            disabled={
              materialize.isPending || !bundleId || effectiveSourceId == null
            }
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {materialize.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Materialize
          </button>
        </div>
      </header>

      <SourceQualifierBanner source={selectedSource} minPopulation={minPop} />

      <section className="grid grid-cols-3 gap-3">
        <MetricTile
          label="Qualified persons"
          value={
            qualifications?.qualified_person_count != null
              ? qualifications.qualified_person_count.toLocaleString()
              : "—"
          }
        />
        <MetricTile
          label="Measures"
          value={String(qualifications?.measures.length ?? bundle?.measures?.length ?? 0)}
        />
        <MetricTile
          label="Last run"
          value={
            qualifications?.run?.completed_at
              ? formatRelativeTime(qualifications.run.completed_at)
              : "—"
          }
        />
      </section>

      <Shell title="Quality measures" subtitle="Denominator is post-exclusion. Rate shown with Wilson 95% CI.">
        <div className="overflow-x-auto">
          {qualificationsQuery.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-text-ghost">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading measures…
            </div>
          ) : !qualifications || qualifications.measures.length === 0 ? (
            <p className="p-6 text-sm text-text-ghost">
              No measure results yet. Click Materialize to compute.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-border-default">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">
                    Measure
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">
                    Domain
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-ghost">
                    Denominator
                  </th>
                  <th
                    className="px-4 py-2 text-right text-xs font-semibold text-text-ghost"
                    title="Removed from both numerator and denominator (hospice, pregnancy, ESRD, etc.)"
                  >
                    Excluded
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-ghost">
                    Numerator
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-ghost">
                    Rate (95% CI)
                  </th>
                  <th className="w-20 px-2 py-2 text-right text-xs font-semibold text-text-ghost">
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody>
                {qualifications.measures.map((m) => {
                  const isStratExpanded = stratifiedMeasureIds.has(
                    m.quality_measure_id,
                  );
                  return (
                    <Fragment key={m.quality_measure_id}>
                      <tr className="border-b border-border-default/60 hover:bg-surface-overlay/40">
                        <td className="px-4 py-2">
                          <div className="text-sm font-medium text-text-primary">
                            {m.measure.measure_name}
                          </div>
                          <div className="text-[10px] uppercase tracking-wide text-text-ghost">
                            {m.measure.measure_code}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-text-muted">
                          {m.measure.domain}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs">
                          {m.denominator_count.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-text-ghost">
                          {m.exclusion_count > 0
                            ? m.exclusion_count.toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs">
                          {m.numerator_count.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs">
                          {formatRateWithCI(m.rate, m.ci_lower, m.ci_upper)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => toggleStrata(m.quality_measure_id)}
                              className="rounded p-1 text-text-ghost transition-colors hover:bg-surface-overlay hover:text-text-primary"
                              title={
                                isStratExpanded
                                  ? "Collapse strata"
                                  : "Stratify by age + sex"
                              }
                              aria-label="Toggle stratification"
                            >
                              {isStratExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                setRosterTarget({
                                  measureId: m.quality_measure_id,
                                  measureCode: m.measure.measure_code,
                                  measureName: m.measure.measure_name,
                                })
                              }
                              className="rounded p-1 text-text-ghost transition-colors hover:bg-surface-overlay hover:text-text-primary"
                              title="View patient roster + export as cohort"
                              aria-label="View patient roster"
                            >
                              <Users className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                setMethodologyMeasureId(m.quality_measure_id)
                              }
                              className="rounded p-1 text-text-ghost transition-colors hover:bg-surface-overlay hover:text-text-primary"
                              title="View methodology + DQ flags"
                              aria-label="View methodology"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isStratExpanded && (
                        <MeasureStrataRow
                          bundleId={bundleId}
                          measureId={m.quality_measure_id}
                          sourceId={effectiveSourceId}
                          colSpan={7}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Shell>

      <MeasureMethodologyModal
        bundleId={bundleId}
        measureId={methodologyMeasureId}
        sourceId={effectiveSourceId}
        onClose={() => setMethodologyMeasureId(null)}
      />

      <MeasureRosterModal
        bundleId={bundleId}
        measureId={rosterTarget?.measureId ?? null}
        measureCode={rosterTarget?.measureCode ?? null}
        measureName={rosterTarget?.measureName ?? null}
        sourceId={effectiveSourceId}
        sourceName={selectedSource?.source_name ?? null}
        onClose={() => setRosterTarget(null)}
      />

      <Shell title="Recent runs" subtitle={`${runs.length} most recent`}>
        {runs.length === 0 ? (
          <p className="p-6 text-sm text-text-ghost">No runs yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-border-default">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">
                  Source
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">
                  Trigger
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-text-ghost">
                  Qualified persons
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-text-ghost">
                  Completed
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const source = sources.find((s) => s.id === run.source_id);
                return (
                  <tr
                    key={run.id}
                    className="border-b border-border-default/60 hover:bg-surface-overlay/40"
                  >
                    <td className="px-4 py-2 text-xs text-text-primary">
                      {source?.source_name ?? `#${run.source_id}`}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <StatusPill status={run.status} />
                    </td>
                    <td className="px-4 py-2 text-xs text-text-muted">
                      {run.trigger_kind}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {run.qualified_person_count?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-text-ghost">
                      {formatRelativeTime(run.completed_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Shell>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-ghost">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

async function downloadFhirMeasure(
  bundleId: number,
  bundleCode: string | undefined,
): Promise<void> {
  const resource = await fetchFhirMeasure(bundleId);
  const blob = new Blob([JSON.stringify(resource, null, 2)], {
    type: "application/fhir+json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${(bundleCode ?? "bundle").toLowerCase()}-measure.fhir.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function StatusPill({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    completed: "bg-teal-900 text-teal-300",
    running: "bg-amber-900 text-amber-300",
    pending: "bg-surface-raised text-text-muted",
    failed: "bg-red-900 text-red-300",
    stale: "bg-surface-raised text-text-ghost",
  };
  const cls = colorMap[status] ?? "bg-surface-raised text-text-muted";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {status}
    </span>
  );
}
