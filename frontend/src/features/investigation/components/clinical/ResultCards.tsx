import { Pin } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ClinicalAnalysisType } from "../../types";
import { ForestPlotWrapper } from "../phenotype/ForestPlotWrapper";
import { KaplanMeierChart } from "./KaplanMeierChart";
import { PSDistributionChart } from "./PSDistributionChart";

// ── Shared types ──────────────────────────────────────────────────────────────

interface PinFinding {
  domain: string;
  section: string;
  finding_type: string;
  finding_payload: Record<string, unknown>;
}

interface ResultCardsProps {
  analysisType: ClinicalAnalysisType;
  result: Record<string, unknown>;
  onPinFinding: (finding: PinFinding) => void;
}

// ── Shared primitives ─────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number | null | undefined;
  favorable?: boolean;
  unfavorable?: boolean;
}

function MetricCard({ label, value, favorable, unfavorable }: MetricCardProps) {
  const valueClass = unfavorable
    ? "text-primary"
    : favorable
      ? "text-success"
      : "text-text-primary";

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border-default bg-surface-base/60 p-3">
      <span className={`text-3xl font-bold leading-none ${valueClass}`}>
        {value ?? "—"}
      </span>
      <span className="text-xs text-text-ghost">{label}</span>
    </div>
  );
}

interface CIBadgeProps {
  lower: number | null | undefined;
  upper: number | null | undefined;
}

function CIBadge({ lower, upper }: CIBadgeProps) {
  if (lower == null || upper == null) return null;
  return (
    <span className="text-xs text-text-muted">
      [{lower.toFixed(2)}, {upper.toFixed(2)}]
    </span>
  );
}

interface PinButtonProps {
  onClick: () => void;
}

function PinButton({ onClick }: PinButtonProps) {
  const { t } = useTranslation("app");
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-border-default bg-surface-raised/60 px-2.5 py-1 text-xs text-text-muted transition hover:border-accent/60 hover:text-accent"
    >
      <Pin className="h-3 w-3" />
      {t("investigation.common.actions.pinToDossier")}
    </button>
  );
}

// ── Per-type result sections ───────────────────────────────────────────────────

// Characterization
function CharacterizationResults({
  result,
  onPinFinding,
}: {
  result: Record<string, unknown>;
  onPinFinding: (f: PinFinding) => void;
}) {
  const { t } = useTranslation("app");
  const targetCount = result?.target_count as number | undefined;
  const comparatorCount = result?.comparator_count as number | undefined;

  type Covariate = { covariate_name?: string; name?: string; std_diff?: number; smd?: number };
  const rawCovariates = result?.aggregate_covariates as Covariate[] | undefined;
  const topFeatures = rawCovariates
    ?.slice()
    .sort((a, b) => {
      const aVal = Math.abs((a.std_diff ?? a.smd) ?? 0);
      const bVal = Math.abs((b.std_diff ?? b.smd) ?? 0);
      return bVal - aVal;
    })
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      {/* Cohort counts */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-ghost">
          {t("investigation.clinical.results.cohortCounts")}
        </span>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label={t("investigation.clinical.results.targetSubjects")}
            value={targetCount?.toLocaleString() ?? "—"}
          />
          <MetricCard
            label={t("investigation.clinical.results.comparatorSubjects")}
            value={comparatorCount?.toLocaleString() ?? "—"}
          />
        </div>
        <PinButton
          onClick={() =>
            onPinFinding({
              domain: "clinical",
              section: "clinical_evidence",
              finding_type: "cohort_summary",
              finding_payload: { target_count: targetCount, comparator_count: comparatorCount },
            })
          }
        />
      </div>

      {/* Top features by SMD */}
      {topFeatures && topFeatures.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-ghost">
            {t("investigation.clinical.results.topFeaturesBySmd")}
          </span>
          <div className="overflow-hidden rounded-lg border border-border-default">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-default bg-surface-base/80">
                  <th className="px-3 py-2 text-left font-medium text-text-ghost">
                    {t("investigation.clinical.results.covariate")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-text-ghost">
                    SMD
                  </th>
                </tr>
              </thead>
              <tbody>
                {topFeatures.map((cov, i) => {
                  const smd = (cov.std_diff ?? cov.smd) as number | undefined;
                  return (
                    <tr
                      key={i}
                      className="border-b border-border-default/50 last:border-0"
                    >
                      <td className="px-3 py-1.5 text-text-secondary">
                        {(cov.covariate_name ?? cov.name) as string | undefined ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-text-muted">
                        {smd != null ? smd.toFixed(3) : "—"}
                      </td>
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

// Incidence Rate
function IncidenceRateResults({
  result,
  onPinFinding,
}: {
  result: Record<string, unknown>;
  onPinFinding: (f: PinFinding) => void;
}) {
  const { t } = useTranslation("app");
  const rate = result?.rate as number | undefined;
  const ciLower = result?.ci_lower as number | undefined;
  const ciUpper = result?.ci_upper as number | undefined;
  const personYears = result?.person_years as number | undefined;
  const cases = result?.cases as number | undefined;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-text-ghost">
        {t("investigation.clinical.results.incidenceRate")}
      </span>

      {/* Rate card */}
      <div className="flex flex-col gap-1 rounded-lg border border-border-default bg-surface-base/60 p-4">
        <span className="text-3xl font-bold text-success">
          {rate != null ? rate.toFixed(4) : "—"}
        </span>
        <span className="text-xs text-text-ghost">
          {t("investigation.clinical.results.perPersonYear")}
        </span>
        <CIBadge lower={ciLower} upper={ciUpper} />
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label={t("investigation.clinical.results.personYears")}
          value={personYears?.toLocaleString() ?? "—"}
        />
        <MetricCard
          label={t("investigation.clinical.results.cases")}
          value={cases?.toLocaleString() ?? "—"}
        />
      </div>

      <PinButton
        onClick={() =>
          onPinFinding({
            domain: "clinical",
            section: "clinical_evidence",
            finding_type: "incidence_rate",
            finding_payload: { rate, ci_lower: ciLower, ci_upper: ciUpper, person_years: personYears, cases },
          })
        }
      />
    </div>
  );
}

// Estimation (CohortMethod / Comparative Effectiveness)
function EstimationResults({
  result,
  onPinFinding,
}: {
  result: Record<string, unknown>;
  onPinFinding: (f: PinFinding) => void;
}) {
  const { t } = useTranslation("app");
  const hr = result?.hazard_ratio as number | undefined;
  const ciLower = (result?.ci_95_lower ?? result?.ci_lower) as number | undefined;
  const ciUpper = (result?.ci_95_upper ?? result?.ci_upper) as number | undefined;
  const pValue = result?.p_value as number | undefined;
  const targetCount = result?.target_count as number | undefined;
  const comparatorCount = result?.comparator_count as number | undefined;
  const outcomeEvents = result?.outcome_events as number | undefined;

  type EstimateRow = { label?: string; hr?: number; ci_95_lower?: number; ci_95_upper?: number };
  const estimatesRaw = result?.estimates as EstimateRow[] | undefined;
  const forestData = estimatesRaw
    ?.filter((e) => e.hr != null && e.ci_95_lower != null && e.ci_95_upper != null)
    .map((e) => ({
      label: e.label ?? t("investigation.clinical.results.estimateFallback"),
      hr: e.hr!,
      lower: e.ci_95_lower!,
      upper: e.ci_95_upper!,
    }));

  // Kaplan-Meier curve data
  type KMRaw = { target_curve?: Array<{ time: number; survival: number; censored?: boolean }>; comparator_curve?: Array<{ time: number; survival: number; censored?: boolean }> };
  const kmData = result?.kaplan_meier as KMRaw | undefined;
  const kmCurves =
    kmData?.target_curve || kmData?.comparator_curve
      ? [
          ...(kmData?.target_curve
            ? [{
                label: t("investigation.clinical.results.target"),
                color: "var(--success)",
                points: kmData.target_curve,
              }]
            : []),
          ...(kmData?.comparator_curve
            ? [{
                label: t("investigation.clinical.results.comparator"),
                color: "var(--primary)",
                points: kmData.comparator_curve,
              }]
            : []),
        ]
      : undefined;

  // Propensity score distribution data
  type PSRaw = { target_distribution?: Array<{ bin: number; count: number }>; comparator_distribution?: Array<{ bin: number; count: number }> };
  const psData = result?.propensity_score as PSRaw | undefined;
  const psTarget = psData?.target_distribution;
  const psComparator = psData?.comparator_distribution;

  const hrFavorable = hr != null && hr < 1.0;
  const hrUnfavorable = hr != null && hr > 1.0;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-text-ghost">
        {t("investigation.clinical.results.comparativeEffectiveness")}
      </span>

      {/* HR card */}
      <div className="flex flex-col gap-1 rounded-lg border border-border-default bg-surface-base/60 p-4">
        <span
          className={`text-3xl font-bold leading-none ${
            hrFavorable
              ? "text-success"
              : hrUnfavorable
                ? "text-primary"
                : "text-text-primary"
          }`}
        >
          {hr != null ? hr.toFixed(2) : "—"}
        </span>
        <span className="text-xs text-text-ghost">
          {t("investigation.clinical.results.hazardRatio")}
        </span>
        <div className="flex items-center gap-2">
          <CIBadge lower={ciLower} upper={ciUpper} />
          {pValue != null && (
            <span className="text-xs text-text-ghost">
              {t("investigation.common.labels.pValueInline", {
                value: pValue < 0.001 ? "<0.001" : pValue.toFixed(3),
              })}
            </span>
          )}
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          label={t("investigation.clinical.results.target")}
          value={targetCount?.toLocaleString() ?? "—"}
        />
        <MetricCard
          label={t("investigation.clinical.results.comparator")}
          value={comparatorCount?.toLocaleString() ?? "—"}
        />
        <MetricCard
          label={t("investigation.clinical.results.outcomeEvents")}
          value={outcomeEvents?.toLocaleString() ?? "—"}
        />
      </div>

      {/* Forest plot */}
      {forestData && forestData.length > 0 && (
        <ForestPlotWrapper
          data={forestData}
          title={t("investigation.clinical.results.estimates")}
        />
      )}

      {/* Kaplan-Meier survival curves */}
      {kmCurves && kmCurves.length > 0 && (
        <KaplanMeierChart curves={kmCurves} />
      )}

      {/* Propensity score distribution */}
      {(psTarget || psComparator) && (
        <PSDistributionChart
          target={psTarget ?? []}
          comparator={psComparator ?? []}
        />
      )}

      <PinButton
        onClick={() =>
          onPinFinding({
            domain: "clinical",
            section: "clinical_evidence",
            finding_type: "hazard_ratio",
            finding_payload: {
              hazard_ratio: hr,
              ci_95_lower: ciLower,
              ci_95_upper: ciUpper,
              p_value: pValue,
              target_count: targetCount,
              comparator_count: comparatorCount,
              outcome_events: outcomeEvents,
            },
          })
        }
      />
    </div>
  );
}

// Prediction (Patient-Level Prediction)
function PredictionResults({
  result,
  onPinFinding,
}: {
  result: Record<string, unknown>;
  onPinFinding: (f: PinFinding) => void;
}) {
  const { t } = useTranslation("app");
  const auc = (result?.auc ?? result?.auroc) as number | undefined;
  const sensitivity = result?.sensitivity as number | undefined;
  const specificity = result?.specificity as number | undefined;
  const ppv = result?.ppv as number | undefined;
  const npv = result?.npv as number | undefined;

  const aucDisplay = auc != null ? auc.toFixed(3) : "—";
  const aucFavorable = auc != null && auc >= 0.75;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-text-ghost">
        {t("investigation.clinical.results.predictionPerformance")}
      </span>

      {/* AUC card */}
      <div className="flex flex-col gap-1 rounded-lg border border-border-default bg-surface-base/60 p-4">
        <span
          className={`text-3xl font-bold leading-none ${aucFavorable ? "text-success" : "text-text-primary"}`}
        >
          {aucDisplay}
        </span>
        <span className="text-xs text-text-ghost">
          {t("investigation.clinical.results.aucAuroc")}
        </span>
      </div>

      {/* Summary metrics */}
      {(sensitivity != null ||
        specificity != null ||
        ppv != null ||
        npv != null) && (
        <div className="grid grid-cols-2 gap-3">
          {sensitivity != null && (
            <MetricCard
              label={t("investigation.clinical.results.sensitivity")}
              value={sensitivity.toFixed(3)}
            />
          )}
          {specificity != null && (
            <MetricCard
              label={t("investigation.clinical.results.specificity")}
              value={specificity.toFixed(3)}
            />
          )}
          {ppv != null && (
            <MetricCard
              label={t("investigation.clinical.results.ppv")}
              value={ppv.toFixed(3)}
            />
          )}
          {npv != null && (
            <MetricCard
              label={t("investigation.clinical.results.npv")}
              value={npv.toFixed(3)}
            />
          )}
        </div>
      )}

      <PinButton
        onClick={() =>
          onPinFinding({
            domain: "clinical",
            section: "clinical_evidence",
            finding_type: "prediction_model",
            finding_payload: { auc, sensitivity, specificity, ppv, npv },
          })
        }
      />
    </div>
  );
}

// SCCS (Self-Controlled Case Series)
function SccsResults({
  result,
  onPinFinding,
}: {
  result: Record<string, unknown>;
  onPinFinding: (f: PinFinding) => void;
}) {
  const { t } = useTranslation("app");
  const irr = result?.irr as number | undefined;
  const ciLower = (result?.ci_95_lower ?? result?.ci_lower) as number | undefined;
  const ciUpper = (result?.ci_95_upper ?? result?.ci_upper) as number | undefined;
  const pValue = result?.p_value as number | undefined;

  const irrFavorable = irr != null && irr < 1.0;
  const irrUnfavorable = irr != null && irr > 1.0;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-text-ghost">
        {t("investigation.clinical.results.selfControlledCaseSeries")}
      </span>

      <div className="flex flex-col gap-1 rounded-lg border border-border-default bg-surface-base/60 p-4">
        <span
          className={`text-3xl font-bold leading-none ${
            irrFavorable
              ? "text-success"
              : irrUnfavorable
                ? "text-primary"
                : "text-text-primary"
          }`}
        >
          {irr != null ? irr.toFixed(2) : "—"}
        </span>
        <span className="text-xs text-text-ghost">
          {t("investigation.clinical.results.incidenceRateRatio")}
        </span>
        <div className="flex items-center gap-2">
          <CIBadge lower={ciLower} upper={ciUpper} />
          {pValue != null && (
            <span className="text-xs text-text-ghost">
              {t("investigation.common.labels.pValueInline", {
                value: pValue < 0.001 ? "<0.001" : pValue.toFixed(3),
              })}
            </span>
          )}
        </div>
      </div>

      <PinButton
        onClick={() =>
          onPinFinding({
            domain: "clinical",
            section: "clinical_evidence",
            finding_type: "hazard_ratio",
            finding_payload: {
              irr,
              ci_95_lower: ciLower,
              ci_95_upper: ciUpper,
              p_value: pValue,
            },
          })
        }
      />
    </div>
  );
}

// Evidence Synthesis
function EvidenceSynthesisResults({
  result,
  onPinFinding,
}: {
  result: Record<string, unknown>;
  onPinFinding: (f: PinFinding) => void;
}) {
  const { t } = useTranslation("app");
  const pooledHr = (result?.pooled_hr ?? result?.hazard_ratio) as number | undefined;
  const ciLower = (result?.ci_95_lower ?? result?.ci_lower) as number | undefined;
  const ciUpper = (result?.ci_95_upper ?? result?.ci_upper) as number | undefined;
  const tau = result?.tau as number | undefined;
  const iSquared = (result?.i_squared ?? result?.i2) as number | undefined;

  const hrFavorable = pooledHr != null && pooledHr < 1.0;
  const hrUnfavorable = pooledHr != null && pooledHr > 1.0;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-text-ghost">
        {t("investigation.common.sections.evidenceSynthesis")}
      </span>

      {/* Pooled HR */}
      <div className="flex flex-col gap-1 rounded-lg border border-border-default bg-surface-base/60 p-4">
        <span
          className={`text-3xl font-bold leading-none ${
            hrFavorable
              ? "text-success"
              : hrUnfavorable
                ? "text-primary"
                : "text-text-primary"
          }`}
        >
          {pooledHr != null ? pooledHr.toFixed(2) : "—"}
        </span>
        <span className="text-xs text-text-ghost">
          {t("investigation.clinical.results.pooledHazardRatio")}
        </span>
        <CIBadge lower={ciLower} upper={ciUpper} />
      </div>

      {/* Heterogeneity */}
      {(tau != null || iSquared != null) && (
        <div className="grid grid-cols-2 gap-3">
          {tau != null && (
            <MetricCard
              label={t("investigation.clinical.results.tauHeterogeneity")}
              value={tau.toFixed(3)}
            />
          )}
          {iSquared != null && (
            <MetricCard label="I² (%)" value={(iSquared * 100).toFixed(1)} />
          )}
        </div>
      )}

      <PinButton
        onClick={() =>
          onPinFinding({
            domain: "clinical",
            section: "clinical_evidence",
            finding_type: "hazard_ratio",
            finding_payload: {
              pooled_hr: pooledHr,
              ci_95_lower: ciLower,
              ci_95_upper: ciUpper,
              tau,
              i_squared: iSquared,
            },
          })
        }
      />
    </div>
  );
}

// Pathway (Treatment Sequences)
function PathwayResults({
  result,
  onPinFinding,
}: {
  result: Record<string, unknown>;
  onPinFinding: (f: PinFinding) => void;
}) {
  const { t } = useTranslation("app");
  type Sequence = { sequence?: string; label?: string; count?: number; proportion?: number };
  const sequences = result?.top_sequences as Sequence[] | undefined;
  const topN = sequences?.slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-text-ghost">
        {t("investigation.clinical.results.topTreatmentSequences")}
      </span>

      {topN && topN.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {topN.map((seq, i) => {
            const label = (seq.sequence ?? seq.label) as string | undefined;
            const count = seq.count;
            const proportion = seq.proportion;
            return (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border-default bg-surface-base/60 px-3 py-2"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[10px] font-bold text-text-muted">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-text-primary">
                      {label ?? "—"}
                    </span>
                  {(count != null || proportion != null) && (
                    <span className="text-xs text-text-ghost">
                      {count != null &&
                        t("investigation.common.counts.patient", {
                          count,
                        })}
                      {count != null && proportion != null && " · "}
                      {proportion != null &&
                        `${(proportion * 100).toFixed(1)}%`}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="rounded-lg border border-border-default bg-surface-base/60 px-4 py-6 text-center text-sm text-text-ghost">
          {t("investigation.common.empty.noSequenceData")}
        </div>
      )}

      <PinButton
        onClick={() =>
          onPinFinding({
            domain: "clinical",
            section: "clinical_evidence",
            finding_type: "cohort_summary",
            finding_payload: { top_sequences: topN },
          })
        }
      />
    </div>
  );
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export function ResultCards({
  analysisType,
  result,
  onPinFinding,
}: ResultCardsProps) {
  return (
    <div className="rounded-b-lg border border-t-0 border-border-default bg-surface-darkest/40 p-4">
      {analysisType === "characterization" && (
        <CharacterizationResults result={result} onPinFinding={onPinFinding} />
      )}
      {analysisType === "incidence_rate" && (
        <IncidenceRateResults result={result} onPinFinding={onPinFinding} />
      )}
      {analysisType === "estimation" && (
        <EstimationResults result={result} onPinFinding={onPinFinding} />
      )}
      {analysisType === "prediction" && (
        <PredictionResults result={result} onPinFinding={onPinFinding} />
      )}
      {analysisType === "sccs" && (
        <SccsResults result={result} onPinFinding={onPinFinding} />
      )}
      {analysisType === "evidence_synthesis" && (
        <EvidenceSynthesisResults result={result} onPinFinding={onPinFinding} />
      )}
      {analysisType === "pathway" && (
        <PathwayResults result={result} onPinFinding={onPinFinding} />
      )}
    </div>
  );
}
