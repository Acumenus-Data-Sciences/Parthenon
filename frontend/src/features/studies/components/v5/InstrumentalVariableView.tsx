import { Info } from "lucide-react";
import { ForestPlot } from "@/features/estimation/components/ForestPlot";
import { FixtureBanner } from "./FixtureBanner";
import { SectionTitle, StatusPill, Tile } from "./ui";
import { fmt, fmtPct, num, records, str, toForestEstimate } from "./narrow";

/**
 * Analysis R — Instrumental variable (2SRI). Surfaces first-stage strength (F),
 * the LATE for each endpoint, the tertile-balance falsification, and the
 * negative-control-on-instrument check. IV is retained for triangulation only —
 * the caveat is rendered prominently and can never be the sole basis.
 */
export function InstrumentalVariableView({ data }: { data: Record<string, unknown> }) {
  const firstStageF = num(data.first_stage_f);
  const interpretable = data.interpretable === true;
  const late = records(data.late);
  const tertileBalance = records(data.tertile_balance);
  const ncNull = data.nc_on_instrument_null === true;

  return (
    <div className="space-y-4">
      <FixtureBanner data={data} />

      <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-[11px] text-info">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          <span className="font-semibold">Triangulation only.</span> The IV estimate corroborates the
          confounding-adjusted designs (O, P); it is never used as the sole basis for a conclusion.
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile
          label="First-stage F"
          value={fmt(firstStageF, 1)}
          hint={firstStageF !== null && firstStageF >= 10 ? "≥ 10 (interpretable)" : "< 10 (weak instrument)"}
        />
        <div className="bg-surface-darkest rounded p-2">
          <p className="text-[9px] text-text-ghost uppercase tracking-wide">Instrument</p>
          <div className="mt-1">
            <StatusPill label={interpretable ? "interpretable" : "weak"} tone={interpretable ? "ok" : "warn"} />
          </div>
        </div>
        <Tile label="Sites" value={fmt(data.n_sites, 0)} />
        <Tile label="Encounter coverage" value={`${fmt(data.coverage_pct, 1)}%`} />
      </div>

      {late.length > 0 && (
        <div>
          <SectionTitle>Local average treatment effect (LATE)</SectionTitle>
          <ForestPlot estimates={late.map(toForestEstimate)} />
        </div>
      )}

      {tertileBalance.length > 0 && (
        <div>
          <SectionTitle>Instrument-tertile balance (falsification)</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-ghost text-left">
                  <th className="py-1 pr-3 font-medium">Covariate</th>
                  <th className="py-1 pr-3 font-medium">T1</th>
                  <th className="py-1 pr-3 font-medium">T2</th>
                  <th className="py-1 pr-3 font-medium">T3</th>
                  <th className="py-1 font-medium">Balanced</th>
                </tr>
              </thead>
              <tbody>
                {tertileBalance.map((b, i) => (
                  <tr key={i} className="border-t border-border-default">
                    <td className="py-1 pr-3 text-text-secondary">{str(b.covariate)}</td>
                    <td className="py-1 pr-3 text-text-muted font-mono">{fmt(b.t1)}</td>
                    <td className="py-1 pr-3 text-text-muted font-mono">{fmt(b.t2)}</td>
                    <td className="py-1 pr-3 text-text-muted font-mono">{fmt(b.t3)}</td>
                    <td className="py-1">
                      <StatusPill label={b.balanced === true ? "yes" : "no"} tone={b.balanced === true ? "ok" : "bad"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-text-muted">
        <span>Negative-control-on-instrument:</span>
        <StatusPill label={ncNull ? "null (passes)" : "signal (fails)"} tone={ncNull ? "ok" : "bad"} />
      </div>
      <p className="text-[9px] text-text-ghost">
        Coverage {fmtPct((num(data.coverage_pct) ?? 0) / 100)} reflects the encounter-linked share of the
        cohort (NEW-17).
      </p>
    </div>
  );
}
