import { Database } from "lucide-react";
import type { KaplanMeierPoint } from "@/features/estimation/components/KaplanMeierPlot";
import { KaplanMeierPlot } from "@/features/estimation/components/KaplanMeierPlot";
import { FixtureBanner } from "./FixtureBanner";
import { GateBanner, SectionTitle, StatusPill, Tile } from "./ui";
import { asRecord, fmt, fmtPct, num, records, str } from "./narrow";

function toKmPoints(value: unknown): KaplanMeierPoint[] {
  return records(value).map((p) => ({
    time: num(p.time) ?? 0,
    surv: num(p.surv) ?? 1,
    nAtRisk: num(p.nAtRisk) ?? 0,
    nEvents: num(p.nEvents) ?? 0,
    nCensored: num(p.nCensored) ?? 0,
  }));
}

/**
 * Analysis P — Target-trial emulation. Renders the per-protocol effect, the
 * immortal-time integrity check, and (for the fixture) cumulative-incidence
 * curves + IPCW weights. The real CDM run is a landmark new-user emulation via
 * CohortMethod, so it shows PS-gate diagnostics and withholds the effect when a
 * gate fails rather than reporting a blinded number.
 */
export function TargetTrialView({ data }: { data: Record<string, unknown> }) {
  const estimates = records(data.estimates);
  const sensitivity = records(data.sensitivity);
  const km = asRecord(data.km);
  const ipcw = asRecord(data.ipcw);
  const immortal = str(data.immortal_time_check);
  const weightFlagged = ipcw.flag === true;
  const isRealCdm = str(data.data_source) === "cdm";
  const estimable = data.estimable !== false;
  const gates = asRecord(data.gates);
  const hasIpcw = num(ipcw.max_stabilized_weight) !== null;

  return (
    <div className="space-y-4">
      <FixtureBanner data={data} />
      {isRealCdm && (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-[11px] text-success">
          <Database size={14} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold uppercase tracking-wide">Real CDM result · </span>
            {str(data.method) || "Landmark target-trial emulation via CohortMethod."}
            {str(data.withheld_reason) && (
              <span className="mt-1 block text-warning">{str(data.withheld_reason)}</span>
            )}
          </span>
        </div>
      )}
      {isRealCdm && <GateBanner estimable={estimable} gates={gates} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Grace period" value={`${num(data.grace_days) ?? "—"} d`} />
        <div className="bg-surface-darkest rounded p-2">
          <p className="text-[9px] text-text-ghost uppercase tracking-wide">Immortal-time check</p>
          <div className="mt-1">
            <StatusPill label={immortal || "—"} tone={immortal.startsWith("PASS") ? "ok" : immortal ? "bad" : "muted"} />
          </div>
        </div>
        {hasIpcw ? (
          <>
            <Tile label="Max stabilized weight" value={fmt(ipcw.max_stabilized_weight)} hint={weightFlagged ? "⚠ > 10" : "within range"} />
            <Tile label="Mean stabilized weight" value={fmt(ipcw.mean_stabilized_weight)} />
          </>
        ) : (
          <>
            <Tile label="Treated / not (n)" value={`${num(data.comparator_count) ?? "—"} / ${num(data.target_count) ?? "—"}`} />
            <Tile label="max |SMD|" value={fmt(gates.max_smd, 3)} />
          </>
        )}
      </div>

      {estimable && estimates.length > 0 && (
        <div>
          <SectionTitle>Per-protocol effect</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-ghost text-left">
                  <th className="py-1 pr-3 font-medium">Outcome</th>
                  <th className="py-1 pr-3 font-medium">HR</th>
                  <th className="py-1 pr-3 font-medium">95% CI</th>
                  <th className="py-1 font-medium">5-yr risk diff</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((e, i) => (
                  <tr key={i} className="border-t border-border-default">
                    <td className="py-1 pr-3 text-text-secondary">{str(e.outcome_name) || `#${i + 1}`}</td>
                    <td className="py-1 pr-3 text-text-primary font-mono">{fmt(e.hazard_ratio)}</td>
                    <td className="py-1 pr-3 text-text-muted font-mono">{fmt(e.ci_95_lower)}–{fmt(e.ci_95_upper)}</td>
                    <td className="py-1 text-text-muted font-mono">{fmtPct(e.risk_diff_5y)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(toKmPoints(km.timely).length > 0 || toKmPoints(km.delayed).length > 0) && (
        <div>
          <SectionTitle>Cumulative incidence by strategy</SectionTitle>
          <KaplanMeierPlot
            targetCurve={toKmPoints(km.timely)}
            comparatorCurve={toKmPoints(km.delayed)}
            targetLabel="Timely initiation"
            comparatorLabel="Delayed initiation"
            timeUnit="months"
          />
        </div>
      )}

      {sensitivity.length > 0 && (
        <div>
          <SectionTitle>Grace-period sensitivity</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {sensitivity.map((s, i) => (
              <div key={i} className="bg-surface-darkest rounded px-2 py-1 text-[11px] text-text-muted">
                <span className="text-text-ghost">{num(s.grace_days) ?? "—"} d · {str(s.outcome_name)}</span>
                <span className="ml-2 font-mono text-text-primary">HR {fmt(s.hazard_ratio)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
