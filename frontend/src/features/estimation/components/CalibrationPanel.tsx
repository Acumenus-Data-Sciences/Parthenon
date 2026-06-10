import { ShieldCheck, AlertTriangle } from "lucide-react";
import { SystematicErrorPlot } from "./SystematicErrorPlot";
import { fmt, num } from "@/lib/formatters";
import type {
  CalibratedEstimateEntry,
  EstimationResult,
} from "../types/estimation";

interface CalibrationPanelProps {
  result: EstimationResult;
}

interface MetricProps {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}

function Metric({ label, value, hint, accent }: MetricProps) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-base p-3">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p
        className={
          "mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold " +
          (accent ? "text-accent" : "text-success")
        }
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] text-text-ghost">{hint}</p> : null}
    </div>
  );
}

/**
 * Empirical-calibration section for population-level estimation
 * (Clio / ADR-0020 Phase 2). Surfaces the systematic-error model, EASE,
 * calibrated-vs-uncalibrated effect estimates, and the negative-control
 * distribution — or a clear warning when the control panel is too thin to
 * calibrate (the study-114 failure mode the S6 gate blocks on).
 */
export function CalibrationPanel({ result }: CalibrationPanelProps) {
  const calibration = result.calibration;
  if (!calibration) return null;

  const insufficient = calibration.status === "insufficient_controls";
  const sem = calibration.systematic_error_model ?? {};
  const ncPoints = calibration.calibration_plot?.negative_controls ?? [];

  const scatterControls = ncPoints.map((p, i) => ({
    outcome_name: `Negative control ${i + 1}`,
    log_rr: p.log_rr,
    se_log_rr: p.se_log_rr,
    ci_95_lower: Math.exp(p.log_rr - 1.96 * p.se_log_rr),
    ci_95_upper: Math.exp(p.log_rr + 1.96 * p.se_log_rr),
  }));

  const calibratedById = new Map<number, CalibratedEstimateEntry>();
  calibration.calibrated_estimates.forEach((c) =>
    calibratedById.set(c.outcome_id, c),
  );

  return (
    <div
      data-testid="calibration-panel"
      className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4"
    >
      <div className="flex items-center gap-2">
        {insufficient ? (
          <AlertTriangle size={18} className="text-accent shrink-0" />
        ) : (
          <ShieldCheck size={18} className="text-success shrink-0" />
        )}
        <h3 className="text-sm font-semibold text-text-primary">
          Empirical Calibration
        </h3>
      </div>

      {insufficient ? (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
          <p className="text-xs font-medium text-accent">
            {calibration.message ??
              `Only ${calibration.informative_negative_controls} informative negative control(s) ` +
                `(need at least ${calibration.min_negative_controls}). Effect estimates are NOT ` +
                `calibrated — interpret uncalibrated results with caution.`}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Metric
              label="EASE"
              value={fmt(calibration.ease ?? 0)}
              hint="Expected absolute systematic error"
            />
            <Metric
              label="Systematic bias"
              value={fmt(sem.null_mean ?? 0)}
              hint="Mean of empirical null (log scale)"
              accent
            />
            <Metric label="Null SD" value={fmt(sem.null_sd ?? 0)} />
            <Metric
              label="Informative controls"
              value={String(calibration.informative_negative_controls)}
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-border-default">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-overlay">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Outcome
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    HR (uncalibrated)
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    HR (calibrated)
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Calibrated 95% CI
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Calibrated p
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.estimates.map((est, i) => {
                  const cal = calibratedById.get(est.outcome_id);
                  const isCalibrated = cal?.calibrated === true;
                  return (
                    <tr
                      key={est.outcome_id}
                      className={
                        i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay"
                      }
                    >
                      <td className="px-4 py-3 text-sm text-text-primary">
                        {est.outcome_name}
                      </td>
                      <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-sm text-text-secondary">
                        {fmt(est.hazard_ratio)}
                      </td>
                      <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-sm text-text-primary">
                        {isCalibrated ? fmt(cal?.calibrated_hr ?? 0) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
                        {isCalibrated
                          ? `${fmt(cal?.cal_ci_lower ?? 0, 2)} – ${fmt(cal?.cal_ci_upper ?? 0, 2)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-accent">
                        {isCalibrated
                          ? num(cal?.calibrated_p ?? 1) < 0.001
                            ? "<0.001"
                            : fmt(cal?.calibrated_p ?? 0)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {scatterControls.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-muted mb-3">
                Negative-control distribution
              </h4>
              <div className="flex justify-center">
                <SystematicErrorPlot negativeControls={scatterControls} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
