import { Loader2 } from "lucide-react";
import { useMeasureStrata } from "../hooks";
import { formatRateWithCI } from "../lib/formatting";
import type { MeasureStratum } from "../types";

interface Props {
  bundleId: number | null;
  measureId: number | null;
  sourceId: number | null;
  /** Number of columns to span in the parent table (so the inset row matches the column layout). */
  colSpan: number;
}

export function MeasureStrataRow({
  bundleId,
  measureId,
  sourceId,
  colSpan,
}: Props) {
  const { data, isLoading, error } = useMeasureStrata(
    bundleId,
    measureId,
    sourceId,
  );

  return (
    <tr className="border-b border-border-default/30 bg-surface-base/50">
      <td colSpan={colSpan} className="px-8 py-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-text-ghost">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Computing strata…
          </div>
        )}

        {error && (
          <div className="text-xs text-red-300">Failed to load strata.</div>
        )}

        {data && (
          <div className="grid grid-cols-2 gap-4">
            <StratumGroup title="By age band" rows={data.age_band} />
            <StratumGroup title="By sex" rows={data.sex} />
          </div>
        )}
      </td>
    </tr>
  );
}

function StratumGroup({
  title,
  rows,
}: {
  title: string;
  rows: MeasureStratum[];
}) {
  return (
    <div>
      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-ghost">
        {title}
      </h4>
      {rows.length === 0 ? (
        <p className="text-xs text-text-ghost">No strata available.</p>
      ) : (
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-border-default/40">
              <th className="px-2 py-1 text-left font-normal text-text-ghost">
                Stratum
              </th>
              <th className="px-2 py-1 text-right font-normal text-text-ghost">
                Denom
              </th>
              <th className="px-2 py-1 text-right font-normal text-text-ghost">
                Numer
              </th>
              <th className="px-2 py-1 text-right font-normal text-text-ghost">
                Rate (95% CI)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.stratum} className="border-b border-border-default/20">
                <td className="px-2 py-1 text-text-primary">{s.stratum}</td>
                <td className="px-2 py-1 text-right font-mono">
                  {s.denom.toLocaleString()}
                </td>
                <td className="px-2 py-1 text-right font-mono">
                  {s.numer.toLocaleString()}
                </td>
                <td className="px-2 py-1 text-right font-mono">
                  {formatRateWithCI(s.rate, s.ci_lower, s.ci_upper)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
