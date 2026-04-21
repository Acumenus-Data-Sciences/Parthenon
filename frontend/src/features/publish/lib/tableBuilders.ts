// ---------------------------------------------------------------------------
// Table Builders — extract TableData from result_json per analysis type
// ---------------------------------------------------------------------------

import type { TableData, SelectedExecution } from "../types/publish";
import { translatePublish } from "./i18n";

// ── Incidence Rates ─────────────────────────────────────────────────────────
// Consolidates multiple IR executions into one comparison table

function buildIncidenceRateTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];
  const headers = {
    cohort: translatePublish("publish.tables.headers.cohort"),
    outcome: translatePublish("publish.tables.headers.outcome"),
    events: translatePublish("publish.tables.headers.events"),
    personYears: translatePublish("publish.tables.headers.personYears"),
    ratePer1000Py: translatePublish("publish.tables.headers.ratePer1000Py"),
    confidence95: translatePublish("publish.tables.headers.confidence95"),
  };

  for (const exec of executions) {
    const result = exec.resultJson;
    if (!result) continue;

    // Structure: results[].{outcome_cohort_name, persons_with_outcome, person_years, incidence_rate, rate_95_ci_lower/upper}
    // Only use overall (non-strata) rows from results array
    const results = Array.isArray(result.results)
      ? (result.results as Array<Record<string, unknown>>)
      : [];

    // Filter to overall results (not strata breakdowns)
    const overallResults = results.filter(
      (r) => !r.stratum_name && !r.stratum_value
    );

    // If no non-strata results, the top-level results ARE the overall results
    const entries = overallResults.length > 0 ? overallResults : results.slice(0, 5);

    for (const r of entries) {
      // Skip strata rows (age/gender breakdowns)
      if (r.stratum_name && r.stratum_value !== undefined) continue;

      const ir = (r.incidence_rate as number) ?? (r.incidence_rate_per_1000py as number);
      const events = (r.persons_with_outcome as number) ?? (r.event_count as number) ?? 0;
      const py = (r.person_years as number) ?? (r.person_years_at_risk as number) ?? 0;
      const ciLo = r.rate_95_ci_lower as number | undefined;
      const ciHi = r.rate_95_ci_upper as number | undefined;

      rows.push({
        [headers.cohort]: exec.analysisName,
        [headers.outcome]: (r.outcome_cohort_name as string) ?? "—",
        [headers.events]: events,
        [headers.personYears]: py > 0 ? Math.round(py * 10) / 10 : 0,
        [headers.ratePer1000Py]:
          typeof ir === "number" ? Math.round(ir * 100) / 100 : 0,
        [headers.confidence95]:
          typeof ciLo === "number" && typeof ciHi === "number"
          ? `${ciLo.toFixed(1)}–${ciHi.toFixed(1)}`
          : "—",
      });
    }

    // Fallback: try outcomes[].overall structure
    if (rows.length === 0 && Array.isArray(result.outcomes)) {
      for (const outcome of result.outcomes as Array<Record<string, unknown>>) {
        const overall = outcome.overall as Record<string, unknown> | undefined;
        if (!overall) continue;

        const ir = (overall.incidence_rate_per_1000py as number) ?? (overall.incidence_rate as number);
        rows.push({
          [headers.cohort]: exec.analysisName,
          [headers.outcome]: (outcome.outcome_cohort_name as string) ?? "—",
          [headers.events]: (overall.persons_with_outcome as number) ?? 0,
          [headers.personYears]:
            typeof overall.person_years_at_risk === "number"
            ? Math.round(overall.person_years_at_risk as number * 10) / 10 : 0,
          [headers.ratePer1000Py]:
            typeof ir === "number" ? Math.round(ir * 100) / 100 : 0,
          [headers.confidence95]: "—",
        });
      }
    }
  }

  return {
    caption: translatePublish("publish.tables.captions.incidenceRatesByCohort"),
    headers: [
      headers.cohort,
      headers.outcome,
      headers.events,
      headers.personYears,
      headers.ratePer1000Py,
      headers.confidence95,
    ],
    rows,
  };
}

// ── Estimation ──────────────────────────────────────────────────────────────

function buildEstimationTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];
  const headers = {
    outcome: translatePublish("publish.tables.headers.outcome"),
    hazardRatio: translatePublish("publish.tables.headers.hazardRatioShort"),
    confidence95: translatePublish("publish.tables.headers.confidence95"),
    pValue: translatePublish("publish.tables.headers.pValue"),
    events: translatePublish("publish.tables.headers.events"),
  };

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    // Structure: estimates[].{outcome_name, hazard_ratio, ci_95_lower, ci_95_upper, p_value, target_outcomes, comparator_outcomes}
    const estimates = Array.isArray(r.estimates)
      ? (r.estimates as Array<Record<string, unknown>>)
      : [];

    for (const est of estimates) {
      const hr = (est.hazard_ratio as number) ?? (est.hr as number);
      const events = ((est.target_outcomes as number) ?? 0) + ((est.comparator_outcomes as number) ?? 0);
      rows.push({
        [headers.outcome]: (est.outcome_name as string) ?? exec.analysisName,
        [headers.hazardRatio]:
          typeof hr === "number" ? Math.round(hr * 100) / 100 : "—",
        [headers.confidence95]:
          typeof est.ci_95_lower === "number" &&
          typeof est.ci_95_upper === "number"
          ? `${(est.ci_95_lower as number).toFixed(2)}–${(est.ci_95_upper as number).toFixed(2)}`
          : "—",
        [headers.pValue]: typeof est.p_value === "number"
          ? (est.p_value as number) < 0.001 ? "<0.001" : (est.p_value as number).toFixed(4)
          : "—",
        [headers.events]: events > 0 ? events : "—",
      });
    }
  }

  return {
    caption: translatePublish(
      "publish.tables.captions.comparativeEffectivenessEstimates",
    ),
    headers: [
      headers.outcome,
      headers.hazardRatio,
      headers.confidence95,
      headers.pValue,
      headers.events,
    ],
    rows,
  };
}

// ── SCCS ────────────────────────────────────────────────────────────────────

function buildSccsTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];
  const headers = {
    exposureWindow: translatePublish("publish.tables.headers.exposureWindow"),
    irr: translatePublish("publish.tables.headers.irr"),
    confidence95: translatePublish("publish.tables.headers.confidence95"),
  };

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    // Structure: estimates[].{irr, covariate, ci_lower, ci_upper, name}
    const estimates = Array.isArray(r.estimates)
      ? (r.estimates as Array<Record<string, unknown>>)
      : [];

    for (const est of estimates) {
      rows.push({
        [headers.exposureWindow]:
          (est.covariate as string) ??
          (est.name as string) ??
          (est.window_name as string) ??
          "—",
        [headers.irr]:
          typeof est.irr === "number" ? Math.round(est.irr * 100) / 100 : "—",
        [headers.confidence95]:
          typeof est.ci_lower === "number" &&
          typeof est.ci_upper === "number"
          ? `${(est.ci_lower as number).toFixed(2)}–${(est.ci_upper as number).toFixed(2)}`
          : "—",
      });
    }
  }

  return {
    caption: translatePublish("publish.tables.captions.sccsEstimates"),
    headers: [headers.exposureWindow, headers.irr, headers.confidence95],
    rows,
  };
}

// ── Pathways ────────────────────────────────────────────────────────────────

function buildPathwaysTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];
  const headers = {
    pathway: translatePublish("publish.tables.headers.pathway"),
    patients: translatePublish("publish.tables.headers.patients"),
    percent: translatePublish("publish.tables.headers.percent"),
  };

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    // Structure: pathways[].{path: string[], count: number, percent: number}
    // Also: target_count, summary.{total_pathways, patients_with_events}
    const pathways = Array.isArray(r.pathways)
      ? (r.pathways as Array<Record<string, unknown>>)
      : [];

    const top = pathways.slice(0, 10);
    for (const p of top) {
      // path is an array of step names like ["Cohort 155"] or ["Drug A", "Drug B"]
      const pathArr = Array.isArray(p.path) ? (p.path as string[]) : [];
      const pathName = pathArr.length > 0
        ? pathArr.join(" → ")
        : (p.pathway_name as string) ?? (p.name as string) ?? "—";

      rows.push({
        [headers.pathway]: pathName,
        [headers.patients]:
          (p.count as number) ?? (p.patient_count as number) ?? 0,
        [headers.percent]: typeof p.percent === "number"
          ? Math.round(p.percent * 100) / 100
          : typeof p.percentage === "number"
            ? Math.round(p.percentage * 100) / 100
            : "—",
      });
    }

    if (top.length === 0) {
      const summary = r.summary as Record<string, unknown> | undefined;
      rows.push({
        [headers.pathway]: exec.analysisName,
        [headers.patients]:
          (summary?.patients_with_events as number) ??
          (r.target_count as number) ??
          "—",
        [headers.percent]: "—",
      });
    }
  }

  return {
    caption: translatePublish("publish.tables.captions.treatmentPathways"),
    headers: [headers.pathway, headers.patients, headers.percent],
    rows,
  };
}

// ── Characterization ────────────────────────────────────────────────────────

function buildCharacterizationTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];
  const headers = {
    cohort: translatePublish("publish.tables.headers.cohort"),
    n: translatePublish("publish.tables.headers.n"),
    percentFemale: translatePublish("publish.tables.headers.percentFemale"),
    percentMale: translatePublish("publish.tables.headers.percentMale"),
    ageGroup: translatePublish("publish.tables.headers.ageGroup"),
  };

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    // Structure: results[].{cohort_id, cohort_name, person_count, features.demographics[]}
    // demographics[].{feature_name: "Gender", category: "FEMALE"|"MALE", percent}
    const results = Array.isArray(r.results)
      ? (r.results as Array<Record<string, unknown>>)
      : [];

    const cohorts = Array.isArray(r.cohorts)
      ? (r.cohorts as Array<Record<string, unknown>>)
      : [];

    const entries = results.length > 0 ? results : cohorts;

    for (const c of entries) {
      const personCount = (c.person_count as number) ?? (c.count as number) ?? 0;
      if (personCount === 0) continue;

      const features = c.features as Record<string, Array<Record<string, unknown>>> | undefined;
      const demographics = features?.demographics ?? [];

      // Find gender entries by category field
      const femaleDemo = demographics.find(
        (d) => ((d.category as string) ?? "").toUpperCase() === "FEMALE"
          || ((d.concept_name as string) ?? "").toLowerCase().includes("female")
      );
      const maleDemo = demographics.find(
        (d) => ((d.category as string) ?? "").toUpperCase() === "MALE"
          || ((d.concept_name as string) ?? "").toLowerCase().includes("male")
      );

      // Find age group
      const ageDemo = demographics.find(
        (d) => ((d.feature_name as string) ?? "").toLowerCase() === "age group"
      );

      rows.push({
        [headers.cohort]:
          (c.cohort_name as string) ||
          `${translatePublish("publish.tables.values.cohort")} #${c.cohort_id ?? exec.analysisName}`,
        [headers.n]: personCount,
        [headers.percentFemale]:
          femaleDemo &&
          typeof femaleDemo.percent === "number" &&
          (femaleDemo.percent as number) >= 0
          ? Math.round(femaleDemo.percent as number * 10) / 10
          : "—",
        [headers.percentMale]:
          maleDemo &&
          typeof maleDemo.percent === "number" &&
          (maleDemo.percent as number) >= 0
          ? Math.round(maleDemo.percent as number * 10) / 10
          : "—",
        [headers.ageGroup]: (ageDemo?.category as string) ?? "—",
      });
    }

    if (entries.length === 0) {
      rows.push({
        [headers.cohort]: exec.analysisName,
        [headers.n]: (r.total_count as number) ?? (r.count as number) ?? "—",
        [headers.percentFemale]: "—",
        [headers.percentMale]: "—",
        [headers.ageGroup]: "—",
      });
    }
  }

  return {
    caption: translatePublish("publish.tables.captions.populationCharacteristics"),
    headers: [
      headers.cohort,
      headers.n,
      headers.percentFemale,
      headers.percentMale,
      headers.ageGroup,
    ],
    rows,
  };
}

// ── Prediction ──────────────────────────────────────────────────────────────

function buildPredictionTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];
  const headers = {
    model: translatePublish("publish.tables.headers.model"),
    auc: translatePublish("publish.tables.headers.auc"),
    brierScore: translatePublish("publish.tables.headers.brierScore"),
    auprc: translatePublish("publish.tables.headers.auprc"),
    targetN: translatePublish("publish.tables.headers.targetN"),
    outcomeN: translatePublish("publish.tables.headers.outcomeN"),
  };

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    // Structure: performance.{auc, brier_score, auprc}, summary.{target_count, outcome_count}
    const perf = (r.performance as Record<string, unknown>) ?? {};
    const summary = (r.summary as Record<string, unknown>) ?? {};

    const auc = (perf.auc as number) ?? (r.auc as number);
    const brier = (perf.brier_score as number) ?? (r.brier_score as number);
    const auprc = (perf.auprc as number) ?? (r.auprc as number);

    rows.push({
      [headers.model]: exec.analysisName,
      [headers.auc]:
        typeof auc === "number" && auc > 0
          ? Math.round(auc * 1000) / 1000
          : "—",
      [headers.brierScore]:
        typeof brier === "number" && brier > 0
          ? Math.round(brier * 1000) / 1000
          : "—",
      [headers.auprc]:
        typeof auprc === "number" && auprc > 0
          ? Math.round(auprc * 1000) / 1000
          : "—",
      [headers.targetN]:
        (summary.target_count as number) ?? (r.target_count as number) ?? "—",
      [headers.outcomeN]:
        (summary.outcome_count as number) ??
        (r.outcome_count as number) ??
        "—",
    });
  }

  return {
    caption: translatePublish("publish.tables.captions.predictionModelPerformance"),
    headers: [
      headers.model,
      headers.auc,
      headers.brierScore,
      headers.auprc,
      headers.targetN,
      headers.outcomeN,
    ],
    rows,
  };
}

// ── Evidence Synthesis ──────────────────────────────────────────────────────

function buildEvidenceSynthesisTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];
  const headers = {
    analysis: translatePublish("publish.tables.headers.analysis"),
    pooledEstimate: translatePublish("publish.tables.headers.pooledEstimate"),
    confidence95: translatePublish("publish.tables.headers.confidence95"),
    iSquared: translatePublish("publish.tables.headers.iSquaredShort"),
  };

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    const pooled = (r.pooled as Record<string, unknown>) ?? {};
    const pooledEstimate = (pooled.hr as number) ?? (r.pooled_estimate as number);
    const ciLower = (pooled.ci_lower as number) ?? (r.ci_lower as number);
    const ciUpper = (pooled.ci_upper as number) ?? (r.ci_upper as number);
    const iSquared = (r.i_squared as number)
      ?? ((r.heterogeneity as Record<string, unknown> | undefined)?.i_squared as number);

    rows.push({
      [headers.analysis]: exec.analysisName,
      [headers.pooledEstimate]: typeof pooledEstimate === "number"
        ? Math.round(pooledEstimate * 100) / 100 : "—",
      [headers.confidence95]: typeof ciLower === "number" && typeof ciUpper === "number"
        ? `${ciLower.toFixed(2)}–${ciUpper.toFixed(2)}`
        : "—",
      [headers.iSquared]: typeof iSquared === "number"
        ? `${Math.round(iSquared * 10) / 10}%` : "—",
    });
  }

  return {
    caption: translatePublish("publish.tables.captions.evidenceSynthesisPooled"),
    headers: [
      headers.analysis,
      headers.pooledEstimate,
      headers.confidence95,
      headers.iSquared,
    ],
    rows,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

const TABLE_BUILDERS: Record<string, (execs: SelectedExecution[]) => TableData> = {
  // Plural forms (from "All Analyses" tab — fetchAllAnalyses)
  characterizations: buildCharacterizationTable,
  incidence_rates: buildIncidenceRateTable,
  estimations: buildEstimationTable,
  sccs: buildSccsTable,
  pathways: buildPathwaysTable,
  predictions: buildPredictionTable,
  evidence_synthesis: buildEvidenceSynthesisTable,
  // Singular forms (from "From Studies" tab — study_analyses.analysis_type)
  characterization: buildCharacterizationTable,
  incidence_rate: buildIncidenceRateTable,
  estimation: buildEstimationTable,
  pathway: buildPathwaysTable,
  prediction: buildPredictionTable,
};

export function buildTableFromResults(
  analysisType: string,
  executions: SelectedExecution[],
): TableData | undefined {
  const builder = TABLE_BUILDERS[analysisType];
  if (!builder) return undefined;

  const withResults = executions.filter((e) => e.resultJson !== null);
  if (withResults.length === 0) return undefined;

  return builder(withResults);
}
