import { Database } from "lucide-react";
import { FixtureBanner } from "./FixtureBanner";
import { SectionTitle, Tile } from "./ui";
import { asRecord, fmt, fmtCount, fmtPct, num, records, str } from "./narrow";

/**
 * Analysis Q — Phenotype robustness. The 90%-never-diagnosed headline stress
 * across the index-rule × threshold × max-gap grid, the visit-linked vs
 * measurement-only split (the 37.9% encounter-coverage finding, NEW-17), the
 * E-values for the headline effects, and the QBA bias-adjusted interval.
 */
export function PhenotypeRobustnessView({ data }: { data: Record<string, unknown> }) {
  const grid = records(data.grid);
  const visitSplit = asRecord(data.visit_split);
  const visitLinked = asRecord(visitSplit.visit_linked);
  const measurementOnly = asRecord(visitSplit.measurement_only);
  const eValues = asRecord(data.e_values);
  const qba = Array.isArray(data.qba_interval) ? data.qba_interval : [];
  const isRealCdm = str(data.data_source) === "cdm";

  return (
    <div className="space-y-4">
      <FixtureBanner data={data} />
      {isRealCdm && (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-[11px] text-success">
          <Database size={14} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold uppercase tracking-wide">Real CDM data · </span>
            {str(data.note) || "Never-diagnosed fraction + visit-linkage strata from the CDM."}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="E-value (MACE)" value={fmt(eValues.mace)} />
        <Tile label="E-value (CKD)" value={fmt(eValues.ckd)} />
        <Tile
          label="QBA-adjusted interval"
          value={qba.length === 2 ? `${fmt(qba[0], 2)}–${fmt(qba[1], 2)}` : "—"}
          hint="never-dx fraction"
        />
      </div>

      {(Object.keys(visitLinked).length > 0 || Object.keys(measurementOnly).length > 0) && (
        <div>
          <SectionTitle>Visit-linked vs measurement-only (NEW-17)</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: "Visit-linked", rec: visitLinked, tone: "border-success/30" },
              { label: "Measurement-only", rec: measurementOnly, tone: "border-warning/30" },
            ].map((col) => (
              <div key={col.label} className={`rounded-lg border ${col.tone} bg-surface-raised p-3`}>
                <p className="text-xs font-semibold text-text-secondary mb-2">{col.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Tile label="Coverage" value={`${fmt(col.rec.coverage_pct, 1)}%`} />
                  <Tile label="Never-dx" value={fmtPct(col.rec.never_dx)} />
                  <Tile label="MACE" value={fmtPct(col.rec.mace)} />
                  <Tile label="CKD" value={fmtPct(col.rec.ckd)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {grid.length > 0 && (
        <div>
          <SectionTitle>Never-diagnosed fraction across the phenotype grid</SectionTitle>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-raised">
                <tr className="text-text-ghost text-left">
                  <th className="py-1 pr-3 font-medium">Index rule</th>
                  <th className="py-1 pr-3 font-medium">Threshold</th>
                  <th className="py-1 pr-3 font-medium">Max gap (d)</th>
                  <th className="py-1 pr-3 font-medium">Never-dx</th>
                  <th className="py-1 pr-3 font-medium">n</th>
                  <th className="py-1 font-medium">Median latency (d)</th>
                </tr>
              </thead>
              <tbody>
                {grid.map((g, i) => {
                  const frac = num(g.never_dx_fraction) ?? 0;
                  return (
                    <tr key={i} className="border-t border-border-default">
                      <td className="py-1 pr-3 text-text-secondary">{str(g.index_rule)}</td>
                      <td className="py-1 pr-3 text-text-muted font-mono">{fmt(g.threshold, 0)}</td>
                      <td className="py-1 pr-3 text-text-muted font-mono">{fmt(g.max_gap, 0)}</td>
                      <td className="py-1 pr-3 font-mono" style={{ color: `rgba(155,27,48,${0.35 + frac * 0.65})` }}>
                        {fmtPct(frac)}
                      </td>
                      <td className="py-1 pr-3 text-text-muted font-mono">{fmtCount(g.n)}</td>
                      <td className="py-1 text-text-muted font-mono">{fmtCount(g.median_latency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
