// ---------------------------------------------------------------------------
// Table Builders — extract TableData from result_json per analysis type
// ---------------------------------------------------------------------------

import type { TableData, SelectedExecution } from "../types/publish";

// ── Incidence Rates ─────────────────────────────────────────────────────────
// Consolidates multiple IR executions into one comparison table

function buildIncidenceRateTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

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
        Cohort: exec.analysisName,
        Outcome: (r.outcome_cohort_name as string) ?? "—",
        Events: events,
        "Person-Years": py > 0 ? Math.round(py * 10) / 10 : 0,
        "Rate/1000PY": typeof ir === "number" ? Math.round(ir * 100) / 100 : 0,
        "95% CI": typeof ciLo === "number" && typeof ciHi === "number"
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
          Cohort: exec.analysisName,
          Outcome: (outcome.outcome_cohort_name as string) ?? "—",
          Events: (overall.persons_with_outcome as number) ?? 0,
          "Person-Years": typeof overall.person_years_at_risk === "number"
            ? Math.round(overall.person_years_at_risk as number * 10) / 10 : 0,
          "Rate/1000PY": typeof ir === "number" ? Math.round(ir * 100) / 100 : 0,
          "95% CI": "—",
        });
      }
    }
  }

  return {
    caption: "Incidence rates by cohort",
    headers: ["Cohort", "Outcome", "Events", "Person-Years", "Rate/1000PY", "95% CI"],
    rows,
  };
}

// ── Estimation ──────────────────────────────────────────────────────────────

function buildEstimationTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    const estimates = Array.isArray(r.estimates)
      ? (r.estimates as Array<Record<string, unknown>>)
      : [r];

    for (const est of estimates) {
      rows.push({
        Outcome: (est.outcome_name as string) ?? exec.analysisName,
        HR: typeof est.hr === "number" ? Math.round(est.hr * 100) / 100 : "—",
        "95% CI": typeof est.ci_95_lower === "number" && typeof est.ci_95_upper === "number"
          ? `${(est.ci_95_lower as number).toFixed(2)}–${(est.ci_95_upper as number).toFixed(2)}`
          : "—",
        "p-value": typeof est.p_value === "number"
          ? (est.p_value as number) < 0.001 ? "<0.001" : (est.p_value as number).toFixed(4)
          : "—",
        Events: (est.event_count as number) ?? "—",
      });
    }
  }

  return {
    caption: "Comparative effectiveness estimates",
    headers: ["Outcome", "HR", "95% CI", "p-value", "Events"],
    rows,
  };
}

// ── SCCS ────────────────────────────────────────────────────────────────────

function buildSccsTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    const windows = Array.isArray(r.estimates)
      ? (r.estimates as Array<Record<string, unknown>>)
      : Array.isArray(r.windows)
        ? (r.windows as Array<Record<string, unknown>>)
        : [r];

    for (const w of windows) {
      rows.push({
        "Exposure Window": (w.window_name as string) ?? (w.covariate_name as string) ?? "—",
        IRR: typeof w.irr === "number" ? Math.round(w.irr * 100) / 100 : "—",
        "95% CI": typeof w.ci_95_lower === "number" && typeof w.ci_95_upper === "number"
          ? `${(w.ci_95_lower as number).toFixed(2)}–${(w.ci_95_upper as number).toFixed(2)}`
          : "—",
      });
    }
  }

  return {
    caption: "Self-controlled case series: incidence rate ratios by exposure window",
    headers: ["Exposure Window", "IRR", "95% CI"],
    rows,
  };
}

// ── Pathways ────────────────────────────────────────────────────────────────

function buildPathwaysTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    const pathways = Array.isArray(r.pathways)
      ? (r.pathways as Array<Record<string, unknown>>)
      : [];

    const top = pathways.slice(0, 10);
    for (const p of top) {
      rows.push({
        Pathway: (p.pathway_name as string) ?? (p.name as string) ?? "—",
        Patients: (p.patient_count as number) ?? 0,
        "%": typeof p.percentage === "number"
          ? Math.round(p.percentage * 100) / 100
          : "—",
      });
    }

    if (top.length === 0) {
      rows.push({
        Pathway: exec.analysisName,
        Patients: (r.patients_with_events as number) ?? (r.total_patients as number) ?? "—",
        "%": "—",
      });
    }
  }

  return {
    caption: "Treatment pathways (top 10)",
    headers: ["Pathway", "Patients", "%"],
    rows,
  };
}

// ── Characterization ────────────────────────────────────────────────────────

function buildCharacterizationTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    // Structure: results[].{cohort_id, cohort_name, person_count, features.demographics[]}
    const results = Array.isArray(r.results)
      ? (r.results as Array<Record<string, unknown>>)
      : [];

    // Fallback: cohorts[] (alternative structure)
    const cohorts = Array.isArray(r.cohorts)
      ? (r.cohorts as Array<Record<string, unknown>>)
      : [];

    const entries = results.length > 0 ? results : cohorts;

    for (const c of entries) {
      const personCount = (c.person_count as number) ?? (c.count as number) ?? 0;
      if (personCount === 0) continue; // skip empty comparator cohorts

      // Extract demographics from features if available
      const features = c.features as Record<string, Array<Record<string, unknown>>> | undefined;
      const demographics = features?.demographics ?? [];
      const femalePct = demographics.find(
        (d) => (d.concept_name as string)?.toLowerCase().includes("female")
      );

      rows.push({
        Cohort: (c.cohort_name as string) ?? `Cohort #${c.cohort_id}` ?? exec.analysisName,
        "N": personCount,
        "% Female": typeof femalePct?.percent === "number"
          ? Math.round(femalePct.percent as number * 10) / 10
          : "—",
      });
    }

    // Fallback if no structured data
    if (entries.length === 0) {
      rows.push({
        Cohort: exec.analysisName,
        "N": (r.total_count as number) ?? (r.count as number) ?? "—",
        "% Female": "—",
      });
    }
  }

  return {
    caption: "Population characteristics",
    headers: ["Cohort", "N", "% Female"],
    rows,
  };
}

// ── Prediction ──────────────────────────────────────────────────────────────

function buildPredictionTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    rows.push({
      Model: exec.analysisName,
      AUC: typeof r.auc === "number" ? Math.round(r.auc * 1000) / 1000 : "—",
      "Brier Score": typeof r.brier_score === "number" ? Math.round(r.brier_score * 1000) / 1000 : "—",
      AUPRC: typeof r.auprc === "number" ? Math.round(r.auprc * 1000) / 1000 : "—",
      "Target N": (r.target_count as number) ?? "—",
      "Outcome N": (r.outcome_count as number) ?? "—",
    });
  }

  return {
    caption: "Prediction model performance",
    headers: ["Model", "AUC", "Brier Score", "AUPRC", "Target N", "Outcome N"],
    rows,
  };
}

// ── Evidence Synthesis ──────────────────────────────────────────────────────

function buildEvidenceSynthesisTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    rows.push({
      Analysis: exec.analysisName,
      "Pooled Estimate": typeof r.pooled_estimate === "number"
        ? Math.round(r.pooled_estimate * 100) / 100 : "—",
      "95% CI": typeof r.ci_lower === "number" && typeof r.ci_upper === "number"
        ? `${(r.ci_lower as number).toFixed(2)}–${(r.ci_upper as number).toFixed(2)}`
        : "—",
      "I²": typeof r.i_squared === "number"
        ? `${Math.round(r.i_squared * 10) / 10}%` : "—",
    });
  }

  return {
    caption: "Evidence synthesis: pooled estimates",
    headers: ["Analysis", "Pooled Estimate", "95% CI", "I²"],
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
