import { Pin } from "lucide-react";
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
    ? "text-[#9B1B30]"
    : favorable
      ? "text-[#2DD4BF]"
      : "text-zinc-100";

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <span className={`text-3xl font-bold leading-none ${valueClass}`}>
        {value ?? "—"}
      </span>
      <span className="text-xs text-zinc-500">{label}</span>
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
    <span className="text-xs text-zinc-400">
      [{lower.toFixed(2)}, {upper.toFixed(2)}]
    </span>
  );
}

interface PinButtonProps {
  onClick: () => void;
}

function PinButton({ onClick }: PinButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-[#C9A227]/60 hover:text-[#C9A227]"
    >
      <Pin className="h-3 w-3" />
      Pin to Dossier
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
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Cohort Counts
        </span>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Target subjects"
            value={targetCount?.toLocaleString() ?? "—"}
          />
          <MetricCard
            label="Comparator subjects"
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
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Top Features by SMD
          </span>
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">
                    Covariate
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">
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
                      className="border-b border-zinc-800/50 last:border-0"
                    >
                      <td className="px-3 py-1.5 text-zinc-300">
                        {(cov.covariate_name ?? cov.name) as string | undefined ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-zinc-400">
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
  const rate = result?.rate as number | undefined;
  const ciLower = result?.ci_lower as number | undefined;
  const ciUpper = result?.ci_upper as number | undefined;
  const personYears = result?.person_years as number | undefined;
  const cases = result?.cases as number | undefined;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Incidence Rate
      </span>

      {/* Rate card */}
      <div className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <span className="text-3xl font-bold text-[#2DD4BF]">
          {rate != null ? rate.toFixed(4) : "—"}
        </span>
        <span className="text-xs text-zinc-500">per person-year</span>
        <CIBadge lower={ciLower} upper={ciUpper} />
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Person-years"
          value={personYears?.toLocaleString() ?? "—"}
        />
        <MetricCard label="Cases" value={cases?.toLocaleString() ?? "—"} />
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
      label: e.label ?? "Estimate",
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
            ? [{ label: "Target", color: "#2DD4BF", points: kmData.target_curve }]
            : []),
          ...(kmData?.comparator_curve
            ? [{ label: "Comparator", color: "#9B1B30", points: kmData.comparator_curve }]
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
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Comparative Effectiveness
      </span>

      {/* HR card */}
      <div className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <span
          className={`text-3xl font-bold leading-none ${
            hrFavorable
              ? "text-[#2DD4BF]"
              : hrUnfavorable
                ? "text-[#9B1B30]"
                : "text-zinc-100"
          }`}
        >
          {hr != null ? hr.toFixed(2) : "—"}
        </span>
        <span className="text-xs text-zinc-500">Hazard Ratio</span>
        <div className="flex items-center gap-2">
          <CIBadge lower={ciLower} upper={ciUpper} />
          {pValue != null && (
            <span className="text-xs text-zinc-500">
              p = {pValue < 0.001 ? "<0.001" : pValue.toFixed(3)}
            </span>
          )}
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          label="Target"
          value={targetCount?.toLocaleString() ?? "—"}
        />
        <MetricCard
          label="Comparator"
          value={comparatorCount?.toLocaleString() ?? "—"}
        />
        <MetricCard
          label="Outcome events"
          value={outcomeEvents?.toLocaleString() ?? "—"}
        />
      </div>

      {/* Forest plot */}
      {forestData && forestData.length > 0 && (
        <ForestPlotWrapper data={forestData} title="Estimates" />
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
  const auc = (result?.auc ?? result?.auroc) as number | undefined;
  const sensitivity = result?.sensitivity as number | undefined;
  const specificity = result?.specificity as number | undefined;
  const ppv = result?.ppv as number | undefined;
  const npv = result?.npv as number | undefined;

  const aucDisplay = auc != null ? auc.toFixed(3) : "—";
  const aucFavorable = auc != null && auc >= 0.75;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Prediction Performance
      </span>

      {/* AUC card */}
      <div className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <span
          className={`text-3xl font-bold leading-none ${aucFavorable ? "text-[#2DD4BF]" : "text-zinc-100"}`}
        >
          {aucDisplay}
        </span>
        <span className="text-xs text-zinc-500">AUC / AUROC</span>
      </div>

      {/* Summary metrics */}
      {(sensitivity != null ||
        specificity != null ||
        ppv != null ||
        npv != null) && (
        <div className="grid grid-cols-2 gap-3">
          {sensitivity != null && (
            <MetricCard
              label="Sensitivity"
              value={sensitivity.toFixed(3)}
            />
          )}
          {specificity != null && (
            <MetricCard
              label="Specificity"
              value={specificity.toFixed(3)}
            />
          )}
          {ppv != null && (
            <MetricCard label="PPV" value={ppv.toFixed(3)} />
          )}
          {npv != null && (
            <MetricCard label="NPV" value={npv.toFixed(3)} />
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
  const irr = result?.irr as number | undefined;
  const ciLower = (result?.ci_95_lower ?? result?.ci_lower) as number | undefined;
  const ciUpper = (result?.ci_95_upper ?? result?.ci_upper) as number | undefined;
  const pValue = result?.p_value as number | undefined;

  const irrFavorable = irr != null && irr < 1.0;
  const irrUnfavorable = irr != null && irr > 1.0;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Self-Controlled Case Series
      </span>

      <div className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <span
          className={`text-3xl font-bold leading-none ${
            irrFavorable
              ? "text-[#2DD4BF]"
              : irrUnfavorable
                ? "text-[#9B1B30]"
                : "text-zinc-100"
          }`}
        >
          {irr != null ? irr.toFixed(2) : "—"}
        </span>
        <span className="text-xs text-zinc-500">
          Incidence Rate Ratio (IRR)
        </span>
        <div className="flex items-center gap-2">
          <CIBadge lower={ciLower} upper={ciUpper} />
          {pValue != null && (
            <span className="text-xs text-zinc-500">
              p = {pValue < 0.001 ? "<0.001" : pValue.toFixed(3)}
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
  const pooledHr = (result?.pooled_hr ?? result?.hazard_ratio) as number | undefined;
  const ciLower = (result?.ci_95_lower ?? result?.ci_lower) as number | undefined;
  const ciUpper = (result?.ci_95_upper ?? result?.ci_upper) as number | undefined;
  const tau = result?.tau as number | undefined;
  const iSquared = (result?.i_squared ?? result?.i2) as number | undefined;

  const hrFavorable = pooledHr != null && pooledHr < 1.0;
  const hrUnfavorable = pooledHr != null && pooledHr > 1.0;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Evidence Synthesis
      </span>

      {/* Pooled HR */}
      <div className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <span
          className={`text-3xl font-bold leading-none ${
            hrFavorable
              ? "text-[#2DD4BF]"
              : hrUnfavorable
                ? "text-[#9B1B30]"
                : "text-zinc-100"
          }`}
        >
          {pooledHr != null ? pooledHr.toFixed(2) : "—"}
        </span>
        <span className="text-xs text-zinc-500">Pooled Hazard Ratio</span>
        <CIBadge lower={ciLower} upper={ciUpper} />
      </div>

      {/* Heterogeneity */}
      {(tau != null || iSquared != null) && (
        <div className="grid grid-cols-2 gap-3">
          {tau != null && (
            <MetricCard label="Tau (heterogeneity)" value={tau.toFixed(3)} />
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
  type Sequence = { sequence?: string; label?: string; count?: number; proportion?: number };
  const sequences = result?.top_sequences as Sequence[] | undefined;
  const topN = sequences?.slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Top Treatment Sequences
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
                className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-400">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-zinc-200">
                    {label ?? "—"}
                  </span>
                  {(count != null || proportion != null) && (
                    <span className="text-xs text-zinc-500">
                      {count != null && `${count.toLocaleString()} patients`}
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
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-6 text-center text-sm text-zinc-500">
          No sequence data available
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
    <div className="rounded-b-lg border border-t-0 border-zinc-800 bg-zinc-950/40 p-4">
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
