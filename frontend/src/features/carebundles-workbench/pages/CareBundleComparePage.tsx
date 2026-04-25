import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, GitCompareArrows, Loader2 } from "lucide-react";
import { Shell } from "@/components/workbench/primitives";
import { useBundle } from "@/features/care-gaps/hooks/useCareGaps";
import { useBundleComparison } from "../hooks";
import { formatRateWithCI } from "../lib/formatting";
import { WorkbenchTabs } from "../components/WorkbenchTabs";
import type { CompareCell, CompareSource } from "../types";

export default function CareBundleComparePage() {
  const { bundleId: bundleIdParam } = useParams<{ bundleId: string }>();
  const bundleId = bundleIdParam ? Number(bundleIdParam) : null;

  const bundleQuery = useBundle(bundleId);
  const compareQuery = useBundleComparison(bundleId);

  const bundle = bundleQuery.data;
  const compare = compareQuery.data;

  // Use the source with the largest qualified population as the baseline
  // for delta computation. Could be made user-selectable later.
  const baselineSource = useMemo(() => {
    if (!compare || compare.sources.length === 0) return null;
    return [...compare.sources]
      .filter((s) => s.run_id != null)
      .sort(
        (a, b) =>
          (b.qualified_person_count ?? 0) - (a.qualified_person_count ?? 0),
      )[0] ?? null;
  }, [compare]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <WorkbenchTabs />

      <Link
        to={`/workbench/care-bundles/${bundleId ?? ""}`}
        className="inline-flex items-center gap-1 text-xs text-text-ghost hover:text-text-primary"
      >
        <ArrowLeft className="h-3 w-3" /> Back to bundle
      </Link>

      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised">
          <GitCompareArrows className="h-5 w-5 text-text-secondary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Source comparison · {bundle?.condition_name ?? "…"}
          </h1>
          <p className="text-sm text-text-ghost">
            Same measures, every qualifying source. Deltas relative to{" "}
            <span className="font-medium text-text-muted">
              {baselineSource?.source_name ?? "baseline"}
            </span>
            .
          </p>
        </div>
      </header>

      {compareQuery.isLoading && (
        <div className="flex items-center gap-2 p-6 text-sm text-text-ghost">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading comparison…
        </div>
      )}

      {compare && compare.sources.length === 0 && (
        <p className="rounded-lg border border-border-default bg-surface-raised p-6 text-sm text-text-ghost">
          No qualifying sources have a current run for this bundle. Materialize
          on at least one source with N ≥ 100K to see comparisons.
        </p>
      )}

      {compare && compare.sources.length > 0 && (
        <Shell
          title="Per-measure rates by source"
          subtitle={`${compare.measures.length} measures × ${compare.sources.length} sources`}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border-default">
                <tr>
                  <th className="sticky left-0 z-10 bg-surface-raised px-4 py-2 text-left text-xs font-semibold text-text-ghost">
                    Measure
                  </th>
                  {compare.sources.map((s) => (
                    <SourceHeaderCell
                      key={s.id}
                      source={s}
                      isBaseline={baselineSource?.id === s.id}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {compare.measures.map((m) => (
                  <tr
                    key={m.measure_id}
                    className="border-b border-border-default/60 hover:bg-surface-overlay/40"
                  >
                    <td className="sticky left-0 z-10 bg-surface-raised px-4 py-2">
                      <div className="text-sm font-medium text-text-primary">
                        {m.measure_name}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-text-ghost">
                        {m.measure_code}
                      </div>
                    </td>
                    {compare.sources.map((s) => {
                      const cell = m.by_source[String(s.id)];
                      const baselineCell = baselineSource
                        ? m.by_source[String(baselineSource.id)]
                        : null;
                      return (
                        <RateCell
                          key={s.id}
                          cell={cell}
                          baselineCell={baselineCell}
                          isBaseline={baselineSource?.id === s.id}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Shell>
      )}
    </div>
  );
}

function SourceHeaderCell({
  source,
  isBaseline,
}: {
  source: CompareSource;
  isBaseline: boolean;
}) {
  return (
    <th className="px-4 py-2 text-right text-xs font-semibold text-text-ghost">
      <div className="flex flex-col items-end">
        <span className="text-text-primary">{source.source_name}</span>
        <span className="font-mono text-[10px] text-text-ghost">
          N={source.qualified_person_count?.toLocaleString() ?? "—"}
          {isBaseline && " · baseline"}
        </span>
      </div>
    </th>
  );
}

function RateCell({
  cell,
  baselineCell,
  isBaseline,
}: {
  cell: CompareCell | undefined;
  baselineCell: CompareCell | null;
  isBaseline: boolean;
}) {
  if (!cell) {
    return (
      <td className="px-4 py-2 text-right font-mono text-xs text-text-ghost">
        —
      </td>
    );
  }

  const delta =
    !isBaseline &&
    baselineCell &&
    cell.rate != null &&
    baselineCell.rate != null
      ? (cell.rate - baselineCell.rate) * 100
      : null;

  const deltaColor =
    delta == null
      ? ""
      : delta > 0
        ? "text-teal-400"
        : delta < 0
          ? "text-red-300"
          : "text-text-ghost";

  return (
    <td className="px-4 py-2 text-right font-mono text-xs">
      <div className="text-text-primary">
        {formatRateWithCI(cell.rate, cell.ci_lower, cell.ci_upper)}
      </div>
      <div className="text-[10px] text-text-ghost">
        N={cell.denominator_count.toLocaleString()}
        {cell.exclusion_count > 0 && (
          <> · excl {cell.exclusion_count.toLocaleString()}</>
        )}
      </div>
      {delta != null && (
        <div className={`text-[10px] font-semibold ${deltaColor}`}>
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}pp
        </div>
      )}
    </td>
  );
}
