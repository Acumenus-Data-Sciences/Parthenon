import { useState } from "react";
import { Download, Table2, Database } from "lucide-react";
import { HeatmapChart } from "@/features/data-explorer/components/charts/HeatmapChart";
import { FixtureBanner } from "./FixtureBanner";
import { SectionTitle } from "./ui";
import { downloadCsv } from "./csv";
import { asArray, fmt, fmtPct, num, records, str } from "./narrow";

/**
 * Analysis M — Comorbidity prevalence matrix. Renders the 17×6 prevalence
 * heatmap and a collapsible full matrix (Wilson CIs + adjusted OR vs control),
 * exportable to CSV directly from the loaded summary_data.
 */
export function ComorbidityMatrixView({ data }: { data: Record<string, unknown> }) {
  const [showFull, setShowFull] = useState(false);
  const cells = records(data.heatmap);

  const heatmapData = cells
    .map((c) => ({ row: str(c.morbidity), col: str(c.population), value: num(c.prevalence) ?? 0 }))
    .filter((c) => c.row !== "" && c.col !== "");

  const exportCsv = () => {
    downloadCsv(
      "htn_v5_comorbidity_matrix",
      ["morbidity", "population", "prevalence", "wilson_lo", "wilson_hi"],
      cells.map((c) => [str(c.morbidity), str(c.population), num(c.prevalence) ?? 0, num(c.wilson_lo) ?? 0, num(c.wilson_hi) ?? 0]),
    );
  };

  const isRealCdm = str(data.data_source) === "cdm";
  const pending = asArray(data.pending_morbidities).map(String).filter(Boolean);

  return (
    <div className="space-y-4">
      <FixtureBanner data={data} />

      {isRealCdm && (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-[11px] text-success">
          <Database size={14} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold uppercase tracking-wide">Real CDM data · </span>
            {str(data.note) || "Prevalence + Wilson 95% CI computed from the Acumenus omop CDM."}
            {pending.length > 0 && (
              <span className="mt-1 block text-text-muted">
                Not captured in this CDM — concept mapping under review ({pending.length}): {pending.join(", ")}.
              </span>
            )}
          </span>
        </div>
      )}

      {heatmapData.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <SectionTitle>Prevalence heatmap</SectionTitle>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowFull((v) => !v)} className="btn btn-ghost btn-sm">
                <Table2 size={13} /> {showFull ? "Hide" : "View full matrix"}
              </button>
              <button type="button" onClick={exportCsv} className="btn btn-ghost btn-sm">
                <Download size={13} /> CSV
              </button>
            </div>
          </div>
          <HeatmapChart data={heatmapData} rowLabel="Morbidity" colLabel="Population" />
        </div>
      )}

      {showFull && cells.length > 0 && (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-raised">
              <tr className="text-text-ghost text-left">
                <th className="py-1 pr-3 font-medium">Morbidity</th>
                <th className="py-1 pr-3 font-medium">Population</th>
                <th className="py-1 pr-3 font-medium">Prevalence</th>
                <th className="py-1 font-medium">Wilson 95% CI</th>
              </tr>
            </thead>
            <tbody>
              {cells.map((c, i) => (
                <tr key={i} className="border-t border-border-default">
                  <td className="py-1 pr-3 text-text-secondary">{str(c.morbidity)}</td>
                  <td className="py-1 pr-3 text-text-muted">{str(c.population)}</td>
                  <td className="py-1 pr-3 text-text-primary font-mono">{fmtPct(c.prevalence)}</td>
                  <td className="py-1 text-text-muted font-mono">{fmt(c.wilson_lo, 3)}–{fmt(c.wilson_hi, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
