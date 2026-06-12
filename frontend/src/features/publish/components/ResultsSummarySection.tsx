// ---------------------------------------------------------------------------
// ResultsSummarySection — Condensed verdict summary for each analysis type
// ---------------------------------------------------------------------------

import { useTranslation } from "react-i18next";
import type { ReportSection } from "../types/publish";
import { fmt, num } from "@/lib/formatters";
import { getPublishAnalysisTypeLabel } from "../lib/i18n";

interface ResultsSummarySectionProps {
  section: ReportSection;
}

// Sections carry the analysisType in two forms: plural group keys from the
// analysis picker (`estimations`, `incidence_rates`, …) and singular slugs from
// study analyses (`estimation`, …). Normalize to singular so the typed summary
// renders instead of falling through to the generic dump.
const SINGULAR_ANALYSIS_TYPE: Record<string, string> = {
  estimations: "estimation",
  predictions: "prediction",
  incidence_rates: "incidence_rate",
  characterizations: "characterization",
  pathways: "pathway",
  sccs: "sccs",
  evidence_synthesis: "evidence_synthesis",
};

function toSingularAnalysisType(type: string | undefined): string {
  if (!type) return "unknown";
  return SINGULAR_ANALYSIS_TYPE[type] ?? type;
}

/**
 * Renders a condensed summary of analysis results for the publish report.
 * Adapts display based on analysis type (estimation, prediction, etc.).
 */
export function ResultsSummarySection({ section }: ResultsSummarySectionProps) {
  const { t } = useTranslation("app");
  const content = section.content as Record<string, unknown> | null;

  if (!content) {
    return (
      <div data-testid="results-summary-section" className="text-sm text-text-primary/50 italic">
        {t("publish.resultsSummary.empty")}
      </div>
    );
  }

  const analysisType = toSingularAnalysisType(section.analysisType);

  return (
    <div data-testid="results-summary-section" className="space-y-3">
      <div className="inline-flex items-center gap-2 rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success">
        {getPublishAnalysisTypeLabel(t, analysisType)}
      </div>

      {analysisType === "estimation" && <EstimationSummary content={content} />}
      {analysisType === "prediction" && <PredictionSummary content={content} />}
      {analysisType === "incidence_rate" && <IncidenceRateSummary content={content} />}
      {analysisType === "characterization" && <CharacterizationSummary content={content} />}
      {analysisType === "sccs" && <SccsSummary content={content} />}
      {analysisType === "evidence_synthesis" && <EvidenceSynthesisSummary content={content} />}
      {analysisType === "pathway" && <PathwaySummary content={content} />}

      {!["estimation", "prediction", "incidence_rate", "characterization", "sccs", "evidence_synthesis", "pathway"].includes(analysisType) && (
        <GenericSummary content={content} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-type summary components
// ---------------------------------------------------------------------------

function EstimationSummary({ content }: { content: Record<string, unknown> }) {
  const hr = num(content.hazard_ratio ?? content.rr ?? content.or);
  const ciLower = num(content.ci_lower ?? content.ci95_lower);
  const ciUpper = num(content.ci_upper ?? content.ci95_upper);
  const pValue = content.p_value as number | undefined;

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <MetricRow label="Hazard Ratio" value={fmt(hr, 2)} />
      <MetricRow label="95% CI" value={`${fmt(ciLower, 2)} - ${fmt(ciUpper, 2)}`} />
      {pValue !== undefined && <MetricRow label="p-value" value={fmt(pValue, 4)} />}
      <MetricRow label="Target N" value={String(num(content.target_count ?? content.target_n))} />
      <MetricRow label="Comparator N" value={String(num(content.comparator_count ?? content.comparator_n))} />
    </div>
  );
}

function PredictionSummary({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <MetricRow label="AUC" value={fmt(content.auc, 3)} />
      <MetricRow label="AUC 95% CI" value={`${fmt(content.auc_ci_lower, 3)} - ${fmt(content.auc_ci_upper, 3)}`} />
      <MetricRow label="Brier Score" value={fmt(content.brier_score, 4)} />
      <MetricRow label="Calibration Slope" value={fmt(content.calibration_slope, 3)} />
    </div>
  );
}

function IncidenceRateSummary({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <MetricRow label="Cases" value={String(num(content.cases ?? content.outcome_count))} />
      <MetricRow label="Person-Years" value={fmt(content.person_years, 1)} />
      <MetricRow label="Incidence Rate" value={fmt(content.incidence_rate ?? content.rate, 4)} />
      <MetricRow label="Rate per 1000 PY" value={fmt(content.rate_per_1000, 2)} />
    </div>
  );
}

function CharacterizationSummary({ content }: { content: Record<string, unknown> }) {
  const featureCount = num(content.feature_count ?? content.total_features);
  const cohortCount = num(content.cohort_count);

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <MetricRow label="Features Analyzed" value={String(featureCount)} />
      <MetricRow label="Cohorts" value={String(cohortCount)} />
      <MetricRow label="Mean SMD" value={fmt(content.mean_smd, 3)} />
    </div>
  );
}

function SccsSummary({ content }: { content: Record<string, unknown> }) {
  const estimates = content.estimates as Array<Record<string, unknown>> | undefined;
  const primary = estimates?.[0];

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      {primary && (
        <>
          <MetricRow label="IRR" value={fmt(primary.irr, 2)} />
          <MetricRow label="95% CI" value={`${fmt(primary.ci_lower, 2)} - ${fmt(primary.ci_upper, 2)}`} />
        </>
      )}
      <MetricRow label="Cases" value={String(num((content.population as Record<string, unknown>)?.cases))} />
      <MetricRow label="Outcomes" value={String(num((content.population as Record<string, unknown>)?.outcomes))} />
    </div>
  );
}

function EvidenceSynthesisSummary({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <MetricRow label="Pooled Estimate" value={fmt(content.pooled_estimate ?? content.pooled_rr, 2)} />
      <MetricRow label="95% CI" value={`${fmt(content.pooled_ci_lower, 2)} - ${fmt(content.pooled_ci_upper, 2)}`} />
      <MetricRow label="I-squared" value={`${fmt(content.i_squared, 1)}%`} />
      <MetricRow label="Sources" value={String(num(content.source_count ?? content.n_sources))} />
    </div>
  );
}

function PathwaySummary({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <MetricRow label="Unique Pathways" value={String(num(content.unique_pathways))} />
      <MetricRow label="Subjects" value={String(num(content.subject_count))} />
    </div>
  );
}

function GenericSummary({ content }: { content: Record<string, unknown> }) {
  // Only scalar values render cleanly as metric tiles; skip nested
  // objects/arrays so we never print "[object Object]".
  const keys = Object.keys(content)
    .filter((key) => typeof content[key] !== "object" || content[key] === null)
    .slice(0, 6);

  if (keys.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      {keys.map((key) => (
        <MetricRow key={key} label={key.replace(/_/g, " ")} value={String(content[key] ?? "N/A")} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared metric row
// ---------------------------------------------------------------------------

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-text-primary/50 text-xs">{label}</span>
      <p className="text-text-primary font-mono text-sm">{value}</p>
    </div>
  );
}
