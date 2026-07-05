import { ForestPlot } from "@/features/estimation/components/ForestPlot";
import { LovePlot } from "@/features/estimation/components/LovePlot";
import { FixtureBanner } from "./FixtureBanner";
import { GateBanner, SectionTitle, Tile } from "./ui";
import { asRecord, fmt, fmtCount, fmtPct, num, records, str, toBalanceEntry, toForestEstimate } from "./narrow";

/**
 * Analysis O — Overlap-weighted (ATO) comparative effect. Renders the headline
 * timely-vs-delayed effect with the estimability gate front and centre; a failed
 * gate withholds the estimate rather than showing a blinded number.
 */
export function OverlapWeightedEffectView({ data }: { data: Record<string, unknown> }) {
  const estimable = data.estimable !== false;
  const gates = asRecord(data.gates);
  const estimates = records(data.estimates);
  const gradient = records(data.gradient);
  const balance = records(data.balance);
  const calibration = asRecord(data.calibration);
  const riskDiff = asRecord(data.risk_difference_5y);

  return (
    <div className="space-y-4">
      <FixtureBanner data={data} />
      <GateBanner estimable={estimable} gates={gates} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Target (timely)" value={fmtCount(data.target_count)} />
        <Tile label="Comparator (delayed)" value={fmtCount(data.comparator_count)} />
        <Tile label="EASE" value={fmt(calibration.ease, 3)} hint="empirical calibration" />
        <Tile label="Informative NCs" value={fmtCount(calibration.informative_negative_controls)} />
      </div>

      {estimable && estimates.length > 0 && (
        <div>
          <SectionTitle>Primary effect (overlap-weighted HR)</SectionTitle>
          <ForestPlot estimates={estimates.map(toForestEstimate)} showNNT />
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-ghost text-left">
                  <th className="py-1 pr-3 font-medium">Outcome</th>
                  <th className="py-1 pr-3 font-medium">HR</th>
                  <th className="py-1 pr-3 font-medium">95% CI</th>
                  <th className="py-1 pr-3 font-medium">Calibrated HR</th>
                  <th className="py-1 font-medium">E-value</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((e, i) => (
                  <tr key={i} className="border-t border-border-default">
                    <td className="py-1 pr-3 text-text-secondary">{str(e.outcome_name) || `#${i + 1}`}</td>
                    <td className="py-1 pr-3 text-text-primary font-mono">{fmt(e.hazard_ratio)}</td>
                    <td className="py-1 pr-3 text-text-muted font-mono">{fmt(e.ci_95_lower)}–{fmt(e.ci_95_upper)}</td>
                    <td className="py-1 pr-3 text-text-muted font-mono">
                      {fmt(e.calibrated_hr)} ({fmt(e.cal_ci_lower)}–{fmt(e.cal_ci_upper)})
                    </td>
                    <td className="py-1 text-text-muted font-mono">{fmt(e.e_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {estimable && gradient.length > 0 && (
        <div>
          <SectionTitle>Dose-response gradient (timeliness quartiles)</SectionTitle>
          <ForestPlot
            estimates={gradient.map((g, i) => toForestEstimate({ ...g, outcome_name: str(g.label) || `Q${num(g.group) ?? i + 1}`, hazard_ratio: g.hr }, i))}
          />
        </div>
      )}

      {balance.length > 0 && (
        <div>
          <SectionTitle>Covariate balance (before / after ATO weighting)</SectionTitle>
          <LovePlot data={balance.map(toBalanceEntry)} />
        </div>
      )}

      {(num(riskDiff.mace) !== null || num(riskDiff.ckd) !== null) && (
        <div>
          <SectionTitle>5-year absolute risk difference</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="MACE" value={fmtPct(riskDiff.mace)} />
            <Tile label="CKD progression" value={fmtPct(riskDiff.ckd)} />
          </div>
        </div>
      )}
    </div>
  );
}
