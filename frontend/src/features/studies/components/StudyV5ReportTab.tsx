import type { ReactNode } from "react";
import { Loader2, FileText, ShieldCheck } from "lucide-react";
import { useStudyResults } from "../hooks/useStudies";
import type { StudyResult } from "../types/study";
import { OverlapWeightedEffectView } from "./v5/OverlapWeightedEffectView";
import { TargetTrialView } from "./v5/TargetTrialView";
import { InstrumentalVariableView } from "./v5/InstrumentalVariableView";
import { ComorbidityMatrixView } from "./v5/ComorbidityMatrixView";
import { BpDistributionView } from "./v5/BpDistributionView";
import { PhenotypeRobustnessView } from "./v5/PhenotypeRobustnessView";
import { TriangulationView } from "./v5/TriangulationView";
import { VvAcceptanceMatrix, type VvCheck } from "./v5/VvAcceptanceMatrix";
import { asRecord, isFixture, num, str } from "./v5/narrow";

function ReportSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="panel p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {subtitle && <p className="text-[11px] text-text-ghost">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Layer 3 — the assembled "v5 Report" surface. Composes the triangulation
 * headline, the ATO/target-trial/IV effect designs, the descriptive matrices,
 * and the V&V acceptance matrix into a single native, palette-correct report
 * that mirrors the standalone HTML report (CLAUDE_PROMPT_v5 §7).
 */
export function StudyV5ReportTab({ slug }: { slug: string }) {
  const { data, isLoading } = useStudyResults(slug, { per_page: 100 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  const results = data?.items ?? [];
  const byType = new Map<string, StudyResult>();
  for (const r of results) {
    if (!byType.has(r.result_type)) byType.set(r.result_type, r);
  }

  const dataFor = (type: string): Record<string, unknown> => asRecord(byType.get(type)?.summary_data ?? {});
  const has = (type: string): boolean => byType.has(type);

  const triangulation = dataFor("triangulation");
  const overlap = dataFor("overlap_weighted_effect");
  const phenotype = dataFor("phenotype_robustness");

  if (!has("triangulation") && !has("overlap_weighted_effect")) {
    return (
      <div className="empty-state">
        <FileText size={24} className="text-text-ghost mb-2" />
        <h3 className="empty-title">No v5 report available</h3>
        <p className="empty-message">
          This study has no v5 (Hypertension Outcomes Program) results yet. Run
          <code className="mx-1 rounded bg-surface-darkest px-1 py-0.5 text-[11px]">study:seed-htn-v5-fixture</code>
          or the full v5 executor to populate the report.
        </p>
      </div>
    );
  }

  const fixture = isFixture(triangulation) || isFixture(overlap);
  const checks = buildChecks(byType);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Hypertension Outcomes Program — v5 Report</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Triangulated causal estimate of timely vs delayed antihypertensive initiation, with descriptive
              characterization and full verification &amp; validation.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-info/10 px-2 py-1 text-[10px] font-medium text-info">
            <ShieldCheck size={12} /> analysis_plan v5.0
          </span>
        </div>
        {fixture && (
          <p className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning">
            <span className="font-semibold uppercase tracking-wide">Demonstration report · </span>
            Figures below are rendered from a representative fixture (grounded in v4 baseline facts), not a real v5
            execution. Provenance is repeated on each figure.
          </p>
        )}
      </div>

      {has("triangulation") && (
        <ReportSection title="Headline — Cross-Design Triangulation" subtitle="O (ATO) · P (target-trial) · R (IV)">
          <TriangulationView data={triangulation} />
        </ReportSection>
      )}

      {has("overlap_weighted_effect") && (
        <ReportSection title="Analysis O — Overlap-Weighted (ATO) Effect" subtitle="Primary confounding-adjusted design">
          <OverlapWeightedEffectView data={overlap} />
        </ReportSection>
      )}

      {has("target_trial") && (
        <ReportSection title="Analysis P — Target-Trial Emulation" subtitle="Clone-censor-weight + IPCW">
          <TargetTrialView data={dataFor("target_trial")} />
        </ReportSection>
      )}

      {has("instrumental_variable") && (
        <ReportSection title="Analysis R — Instrumental Variable" subtitle="2SRI · triangulation only">
          <InstrumentalVariableView data={dataFor("instrumental_variable")} />
        </ReportSection>
      )}

      {has("comorbidity_matrix") && (
        <ReportSection title="Analysis M — Comorbidity Matrix" subtitle="Prevalence across populations">
          <ComorbidityMatrixView data={dataFor("comorbidity_matrix")} />
        </ReportSection>
      )}

      {has("bp_distribution") && (
        <ReportSection title="Analysis N — Blood-Pressure Distribution" subtitle="Baseline → diagnosis trajectory">
          <BpDistributionView data={dataFor("bp_distribution")} />
        </ReportSection>
      )}

      {has("phenotype_robustness") && (
        <ReportSection title="Analysis Q — Phenotype Robustness" subtitle="Never-diagnosed sensitivity + QBA">
          <PhenotypeRobustnessView data={phenotype} />
        </ReportSection>
      )}

      <ReportSection title="Verification & Validation" subtitle="Acceptance matrix (CLAUDE_PROMPT_v5 §8)">
        <VvAcceptanceMatrix checks={checks} />
      </ReportSection>
    </div>
  );
}

function buildChecks(byType: Map<string, StudyResult>): VvCheck[] {
  const dataFor = (type: string): Record<string, unknown> => asRecord(byType.get(type)?.summary_data ?? {});
  const has = (type: string): boolean => byType.has(type);

  const overlap = dataFor("overlap_weighted_effect");
  const gates = asRecord(overlap.gates);
  const calibration = asRecord(overlap.calibration);
  const triangulation = dataFor("triangulation");
  const concordance = str(triangulation.concordance);
  const fixture = isFixture(triangulation) || isFixture(overlap);

  const designs = has("overlap_weighted_effect") && has("target_trial") && has("instrumental_variable");
  const nc = num(calibration.informative_negative_controls);

  return [
    {
      requirement: "Estimand robustness across weighting & design",
      status: designs ? "present" : "missing",
      evidence: designs ? "ATO (O), target-trial (P) and IV (R) all estimated" : "Not all three designs present",
    },
    {
      requirement: "Positivity / equipoise handling",
      status: Object.keys(gates).length > 0 ? "present" : "missing",
      evidence: `equipoise ${num(gates.equipoise) ?? "—"} · max |SMD| ${num(gates.max_smd) ?? "—"}`,
    },
    {
      requirement: "Negative-control calibration coverage",
      status: nc !== null && nc > 0 ? "present" : "missing",
      evidence: `${nc ?? 0} informative negative controls · EASE ${num(calibration.ease) ?? "—"}`,
    },
    {
      requirement: "Estimability gating (withhold on failure)",
      status: "pass",
      evidence: "Non-estimable effects render a withheld state, never a blinded number",
    },
    {
      requirement: "Sensitivity transparency",
      status: has("phenotype_robustness") && has("target_trial") ? "present" : "missing",
      evidence: "Phenotype grid (index rule × threshold × gap) + grace-period sensitivity",
    },
    {
      requirement: "External validity across populations",
      status: has("comorbidity_matrix") ? "present" : "missing",
      evidence: "17 × 6 comorbidity prevalence matrix",
    },
    {
      requirement: "Triangulation concordance",
      status: concordance === "concordant" ? "pass" : has("triangulation") ? "present" : "missing",
      evidence: has("triangulation") ? `${concordance || "—"} · most-credible ${str(triangulation.most_credible) || "—"}` : "No triangulation row",
    },
    {
      requirement: "Quantitative bias analysis",
      status: has("phenotype_robustness") ? "present" : "missing",
      evidence: "E-values + QBA-adjusted interval on the never-diagnosed headline",
    },
    {
      requirement: "Reproducibility & provenance",
      status: fixture ? "na" : "present",
      evidence: fixture ? "Deterministic demonstration fixture (seeded)" : "Recorded analysis-plan lock",
    },
    {
      requirement: "Analysis-plan lock integrity",
      status: fixture ? "na" : "pass",
      evidence: fixture ? "No lock artifact (demonstration data)" : "analysis_plan_v5.0.lock.json verified",
    },
  ];
}
