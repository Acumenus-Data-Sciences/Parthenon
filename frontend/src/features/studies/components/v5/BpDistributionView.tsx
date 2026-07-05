import { Download } from "lucide-react";
import { FixtureBanner } from "./FixtureBanner";
import { SectionTitle, Tile } from "./ui";
import { RidgelinePlot } from "./charts/RidgelinePlot";
import { PairedArrowTrellis } from "./charts/PairedArrowTrellis";
import { toRidgeSeries, toTrellisRows } from "./charts/chartAdapters";
import { downloadCsv } from "./csv";
import { fmt, fmtPct, num, records, str } from "./narrow";

/**
 * Analysis N — Blood-pressure distribution across groups and timepoints.
 * Ridgeline (KDE) + paired-arrow trellis show the leftward shift from baseline to
 * diagnosis; the summary table carries the moments, and the below-trigger callout
 * quantifies regression-to-the-mean / white-coat fraction.
 */
export function BpDistributionView({ data }: { data: Record<string, unknown> }) {
  const summary = records(data.summary);
  const ridge = toRidgeSeries(data.kde);
  const trellis = toTrellisRows(data.trellis);
  const belowTrigger = num(data.below_trigger_fraction);

  const exportCsv = () => {
    downloadCsv(
      "htn_v5_bp_distribution",
      ["group", "timepoint", "measure", "n", "mean", "sd", "median", "q1", "q3", "skew", "kurt"],
      summary.map((s) => [
        str(s.group), str(s.timepoint), str(s.measure), num(s.n) ?? 0,
        num(s.mean) ?? 0, num(s.sd) ?? 0, num(s.median) ?? 0, num(s.q1) ?? 0, num(s.q3) ?? 0,
        num(s.skew) ?? 0, num(s.kurt) ?? 0,
      ]),
    );
  };

  return (
    <div className="space-y-4">
      <FixtureBanner data={data} />

      {belowTrigger !== null && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Below-trigger fraction" value={fmtPct(belowTrigger)} hint="RTM / white-coat" />
        </div>
      )}

      {ridge.length > 0 && (
        <div>
          <SectionTitle>SBP distribution (baseline → diagnosis)</SectionTitle>
          <RidgelinePlot series={ridge} xLabel="SBP (mmHg)" />
        </div>
      )}

      {trellis.length > 0 && (
        <div>
          <SectionTitle>Mean SBP trajectory (t₁ → t₂ → t_dx)</SectionTitle>
          <PairedArrowTrellis rows={trellis} />
        </div>
      )}

      {summary.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <SectionTitle>Summary statistics</SectionTitle>
            <button type="button" onClick={exportCsv} className="btn btn-ghost btn-sm">
              <Download size={13} /> CSV
            </button>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-raised">
                <tr className="text-text-ghost text-left">
                  <th className="py-1 pr-3 font-medium">Group</th>
                  <th className="py-1 pr-3 font-medium">Timepoint</th>
                  <th className="py-1 pr-3 font-medium">Measure</th>
                  <th className="py-1 pr-3 font-medium">Mean ± SD</th>
                  <th className="py-1 pr-3 font-medium">Median (IQR)</th>
                  <th className="py-1 pr-3 font-medium">Skew</th>
                  <th className="py-1 font-medium">Kurt</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s, i) => (
                  <tr key={i} className="border-t border-border-default">
                    <td className="py-1 pr-3 text-text-secondary">{str(s.group)}</td>
                    <td className="py-1 pr-3 text-text-muted">{str(s.timepoint)}</td>
                    <td className="py-1 pr-3 text-text-muted">{str(s.measure)}</td>
                    <td className="py-1 pr-3 text-text-primary font-mono">{fmt(s.mean, 1)} ± {fmt(s.sd, 1)}</td>
                    <td className="py-1 pr-3 text-text-muted font-mono">{fmt(s.median, 1)} ({fmt(s.q1, 1)}–{fmt(s.q3, 1)})</td>
                    <td className="py-1 pr-3 text-text-muted font-mono">{fmt(s.skew)}</td>
                    <td className="py-1 text-text-muted font-mono">{fmt(s.kurt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
