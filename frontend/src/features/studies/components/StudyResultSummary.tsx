import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/format";
import type { StudyResult } from "../types/study";

// ---------------------------------------------------------------------------
// Safe narrowing helpers — summary_data is Record<string, unknown> projected
// from analysis result_json, so every access is defensive.
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fmt(value: unknown, digits = 2): string {
  const n = num(value);
  return n === null ? "—" : n.toFixed(digits);
}

function fmtCount(value: unknown): string {
  const n = num(value);
  return n === null ? "—" : formatNumber(n);
}

/**
 * Renders a projected study_results row as a typed, readable view. The projector
 * stores the full normalized analysis result in summary_data, so a naive
 * key/value grid would print "[object Object]" — this component renders each
 * result type with the right table.
 */
export function StudyResultSummary({ result }: { result: StudyResult }) {
  const data = asRecord(result.summary_data);

  switch (result.result_type) {
    case "effect_estimate":
      return <EffectEstimateView data={data} diagnostics={asRecord(result.diagnostics)} />;
    case "incidence_rate":
      return <IncidenceRateView data={data} />;
    case "characterization":
    case "baseline_characteristics":
      return <CharacterizationView data={data} />;
    default:
      return <GenericView data={data} />;
  }
}

// ---------------------------------------------------------------------------

function EffectEstimateView({
  data,
  diagnostics,
}: {
  data: Record<string, unknown>;
  diagnostics: Record<string, unknown>;
}) {
  const { t } = useTranslation("app");
  const summary = asRecord(data.summary);
  const ps = asRecord(data.propensity_score);
  const calibration = asRecord(data.calibration);
  const calibrated = asArray(calibration.calibrated_estimates).map(asRecord).filter((e) => e.calibrated === true);
  const uncalibrated = asArray(data.estimates).map(asRecord);
  const usingCalibrated = calibrated.length > 0;
  const rows = usingCalibrated ? calibrated : uncalibrated;
  const cleared = diagnostics.cleared === true;

  return (
    <div className="space-y-3">
      {!cleared && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {t("studies.results.detail.notCleared")}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label={t("studies.results.detail.targetCount")} value={fmtCount(summary.target_count)} />
        <Tile label={t("studies.results.detail.comparatorCount")} value={fmtCount(summary.comparator_count)} />
        <Tile label="PS AUC" value={fmt(ps.auc, 3)} />
        <Tile label={t("studies.results.detail.maxSmd")} value={fmt(ps.max_smd_after, 3)} />
      </div>

      {rows.length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
            {usingCalibrated
              ? t("studies.results.detail.calibratedEstimates")
              : t("studies.results.detail.uncalibratedEstimates")}
          </h5>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-ghost text-left">
                  <th className="py-1 pr-3 font-medium">{t("studies.results.detail.outcome")}</th>
                  <th className="py-1 pr-3 font-medium">HR</th>
                  <th className="py-1 pr-3 font-medium">95% CI</th>
                  <th className="py-1 font-medium">p</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => {
                  const hr = usingCalibrated ? e.calibrated_hr : e.hazard_ratio;
                  const lo = usingCalibrated ? e.cal_ci_lower : e.ci_95_lower;
                  const hi = usingCalibrated ? e.cal_ci_upper : e.ci_95_upper;
                  const p = usingCalibrated ? e.calibrated_p : e.p_value;
                  return (
                    <tr key={i} className="border-t border-border-default">
                      <td className="py-1 pr-3 text-text-secondary">{String(e.outcome_name ?? `#${i + 1}`)}</td>
                      <td className="py-1 pr-3 text-text-primary font-mono">{fmt(hr)}</td>
                      <td className="py-1 pr-3 text-text-muted font-mono">{fmt(lo)}–{fmt(hi)}</td>
                      <td className="py-1 text-text-muted font-mono">{fmtP(p)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {usingCalibrated && num(calibration.ease) !== null && (
            <p className="text-[10px] text-text-ghost mt-1.5">
              {t("studies.results.detail.calibrationNote", {
                count: num(calibration.informative_negative_controls) ?? 0,
                ease: fmt(calibration.ease, 3),
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function IncidenceRateView({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  const rows = asArray(data.results).map(asRecord);

  if (rows.length === 0) {
    return <EmptyDetail />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-text-ghost text-left">
            <th className="py-1 pr-3 font-medium">{t("studies.results.detail.outcome")}</th>
            <th className="py-1 pr-3 font-medium">{t("studies.results.detail.ratePer1000")}</th>
            <th className="py-1 pr-3 font-medium">95% CI</th>
            <th className="py-1 pr-3 font-medium">{t("studies.results.detail.atRisk")}</th>
            <th className="py-1 font-medium">{t("studies.results.detail.personYears")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border-default">
              <td className="py-1 pr-3 text-text-secondary">{String(r.outcome_cohort_name ?? `#${i + 1}`)}</td>
              <td className="py-1 pr-3 text-text-primary font-mono">{fmt(r.incidence_rate)}</td>
              <td className="py-1 pr-3 text-text-muted font-mono">{fmt(r.rate_95_ci_lower)}–{fmt(r.rate_95_ci_upper)}</td>
              <td className="py-1 pr-3 text-text-muted font-mono">{fmtCount(r.persons_at_risk)}</td>
              <td className="py-1 text-text-muted font-mono">{fmtCount(r.person_years)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CharacterizationView({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  const cohorts = asArray(data.results).map(asRecord);

  if (cohorts.length === 0) {
    return <EmptyDetail />;
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-ghost text-left">
              <th className="py-1 pr-3 font-medium">{t("studies.results.detail.cohort")}</th>
              <th className="py-1 font-medium">{t("studies.results.detail.persons")}</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c, i) => (
              <tr key={i} className="border-t border-border-default">
                <td className="py-1 pr-3 text-text-secondary">{String(c.cohort_name ?? `#${num(c.cohort_id) ?? i + 1}`)}</td>
                <td className="py-1 text-text-primary font-mono">{fmtCount(c.person_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-text-ghost">{t("studies.results.detail.characterizationNote")}</p>
    </div>
  );
}

/** Fallback for unknown result types — scalars as tiles, nested data as JSON. */
function GenericView({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <EmptyDetail />;
  }

  const scalars = entries.filter(([, v]) => typeof v !== "object" || v === null);
  const complex = entries.filter(([, v]) => typeof v === "object" && v !== null);

  return (
    <div className="space-y-3">
      {scalars.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {scalars.map(([key, val]) => (
            <Tile key={key} label={key.replace(/_/g, " ")} value={typeof val === "number" ? formatNumber(val) : String(val)} />
          ))}
        </div>
      )}
      {complex.map(([key, val]) => (
        <CollapsibleJson key={key} label={key.replace(/_/g, " ")} value={val} />
      ))}
    </div>
  );
}

function CollapsibleJson({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary"
      >
        {open ? "▾" : "▸"} {label}
      </button>
      {open && (
        <pre className="mt-1 text-[10px] text-text-muted bg-surface-darkest rounded p-3 overflow-x-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-darkest rounded p-2">
      <p className="text-[9px] text-text-ghost uppercase">{label}</p>
      <p className="text-sm text-text-primary font-mono">{value}</p>
    </div>
  );
}

function EmptyDetail() {
  const { t } = useTranslation("app");
  return <p className="text-xs text-text-ghost italic">{t("studies.results.empty.noSummaryData")}</p>;
}

function fmtP(value: unknown): string {
  const n = num(value);
  if (n === null) return "—";
  return n < 0.0001 ? "<0.0001" : n.toFixed(4);
}
