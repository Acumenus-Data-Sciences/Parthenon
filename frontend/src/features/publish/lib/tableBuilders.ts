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

    const outcomes = Array.isArray(result.outcomes)
      ? (result.outcomes as Array<Record<string, unknown>>)
      : [result];

    for (const outcome of outcomes) {
      const rates = Array.isArray(outcome.rates)
        ? (outcome.rates as Array<Record<string, unknown>>)
        : [outcome];

      for (const rate of rates) {
        rows.push({
          Cohort: (rate.cohort_name as string) ?? exec.analysisName,
          Outcome: (rate.outcome_name as string) ?? (outcome.outcome_name as string) ?? "—",
          Events: (rate.event_count as number) ?? (rate.outcomes as number) ?? 0,
          "Person-Years": typeof rate.person_years === "number"
            ? Math.round(rate.person_years * 10) / 10
            : 0,
          "Rate/1000PY": typeof rate.incidence_rate === "number"
            ? Math.round(rate.incidence_rate * 100) / 100
            : 0,
        });
      }
    }
  }

  if (rows.length === 0) {
    for (const exec of executions) {
      const r = exec.resultJson;
      if (!r) continue;
      rows.push({
        Cohort: exec.analysisName,
        Outcome: "—",
        Events: (r.event_count as number) ?? (r.outcomes as number) ?? 0,
        "Person-Years": typeof r.person_years === "number"
          ? Math.round(r.person_years * 10) / 10
          : 0,
        "Rate/1000PY": typeof r.incidence_rate === "number"
          ? Math.round(r.incidence_rate * 100) / 100
          : 0,
      });
    }
  }

  return {
    caption: "Incidence rates by cohort",
    headers: ["Cohort", "Outcome", "Events", "Person-Years", "Rate/1000PY"],
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

    const cohorts = Array.isArray(r.cohorts)
      ? (r.cohorts as Array<Record<string, unknown>>)
      : [];

    for (const c of cohorts) {
      rows.push({
        Cohort: (c.cohort_name as string) ?? exec.analysisName,
        "N": (c.count as number) ?? 0,
        "Mean Age": typeof c.mean_age === "number" ? Math.round(c.mean_age * 10) / 10 : "—",
        "% Female": typeof c.pct_female === "number" ? Math.round(c.pct_female * 10) / 10 : "—",
      });
    }

    if (cohorts.length === 0) {
      rows.push({
        Cohort: exec.analysisName,
        "N": (r.total_count as number) ?? (r.count as number) ?? "—",
        "Mean Age": "—",
        "% Female": "—",
      });
    }
  }

  return {
    caption: "Population characteristics",
    headers: ["Cohort", "N", "Mean Age", "% Female"],
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
  characterizations: buildCharacterizationTable,
  incidence_rates: buildIncidenceRateTable,
  estimations: buildEstimationTable,
  sccs: buildSccsTable,
  pathways: buildPathwaysTable,
  predictions: buildPredictionTable,
  evidence_synthesis: buildEvidenceSynthesisTable,
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
