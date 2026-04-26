// ---------------------------------------------------------------------------
// Diagram Builders — transform result_json into diagram component props
// ---------------------------------------------------------------------------

import type { SelectedExecution } from "../types/publish";

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = num(record[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function forestPointFromRecord(
  record: Record<string, unknown>,
  fallbackLabel: string,
): { label: string; estimate: number; ci_lower: number; ci_upper: number } | undefined {
  const estimate = firstNumber(record, [
    "hazard_ratio",
    "hr",
    "relative_risk",
    "rr",
    "odds_ratio",
    "or",
    "estimate",
    "effect_estimate",
  ]);
  if (estimate === undefined) return undefined;

  const ciLower =
    firstNumber(record, ["ci_95_lower", "ci_lower", "lower_ci", "lower", "lcl"]) ??
    estimate;
  const ciUpper =
    firstNumber(record, ["ci_95_upper", "ci_upper", "upper_ci", "upper", "ucl"]) ??
    estimate;

  return {
    label:
      (record.outcome_name as string | undefined) ??
      (record.site_name as string | undefined) ??
      (record.label as string | undefined) ??
      (record.name as string | undefined) ??
      fallbackLabel,
    estimate: rounded(estimate),
    ci_lower: rounded(ciLower),
    ci_upper: rounded(ciUpper),
  };
}

/**
 * Build forest plot data from estimation results.
 * ForestPlot expects: { data: [{label, estimate, ci_lower, ci_upper}], pooled? }
 */
export function buildForestPlotData(
  executions: SelectedExecution[],
): Record<string, unknown> | undefined {
  const points: Array<{ label: string; estimate: number; ci_lower: number; ci_upper: number }> = [];
  let pooled: { estimate: number; ci_lower: number; ci_upper: number } | undefined;

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    const estimates = Array.isArray(r.estimates)
      ? (r.estimates as Array<Record<string, unknown>>)
      : [];

    for (const est of estimates) {
      const point = forestPointFromRecord(est, exec.analysisName);
      if (point) points.push(point);
    }

    const perSite = Array.isArray(r.per_site)
      ? (r.per_site as Array<Record<string, unknown>>)
      : [];
    for (const site of perSite) {
      const point = forestPointFromRecord(site, exec.analysisName);
      if (point) points.push(point);
    }

    const pooledCandidate = r.pooled as Record<string, unknown> | undefined;
    const pooledPoint = pooledCandidate
      ? forestPointFromRecord(pooledCandidate, "Pooled")
      : undefined;
    const pooledHr =
      pooledPoint?.estimate ??
      firstNumber(r, ["pooled_estimate", "pooled_rr", "pooled_hr"]);
    if (pooledHr !== undefined) {
      const pooledLo =
        pooledPoint?.ci_lower ??
        firstNumber(r, ["ci_lower", "ci_95_lower", "pooled_ci_lower"]) ??
        pooledHr;
      const pooledHi =
        pooledPoint?.ci_upper ??
        firstNumber(r, ["ci_upper", "ci_95_upper", "pooled_ci_upper"]) ??
        pooledHr;
      pooled = {
        estimate: rounded(pooledHr),
        ci_lower: rounded(pooledLo),
        ci_upper: rounded(pooledHi),
      };
    }

    if (estimates.length === 0 && perSite.length === 0) {
      const point = forestPointFromRecord(r, exec.analysisName);
      if (point) points.push(point);
    }
  }

  if (points.length === 0 && !pooled) return undefined;

  return {
    data: points,
    pooled,
    xLabel: "Hazard Ratio",
  };
}

/**
 * Build Kaplan-Meier curve data from estimation results.
 * KaplanMeierCurve expects: { curves: [{label, data: [{time, survival}]}] }
 */
export function buildKaplanMeierData(
  executions: SelectedExecution[],
): Record<string, unknown> | undefined {
  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    const km = r.kaplan_meier as Record<string, unknown> | undefined;
    if (!km) continue;

    const curves: Array<{ label: string; data: Array<{ time: number; survival: number }> }> = [];

    for (const [groupName, points] of Object.entries(km)) {
      if (!Array.isArray(points)) continue;
      curves.push({
        label: groupName.charAt(0).toUpperCase() + groupName.slice(1),
        data: (points as Array<Record<string, unknown>>)
          .filter((p) => typeof p.time === "number" && typeof p.survival === "number")
          .map((p) => ({
            time: p.time as number,
            survival: p.survival as number,
          })),
      });
    }

    if (curves.length > 0 && curves.some((c) => c.data.length > 0)) {
      return {
        curves,
        xLabel: "Time (days)",
        yLabel: "Survival Probability",
      };
    }
  }

  return undefined;
}

/**
 * Build attrition diagram data from estimation results.
 * AttritionDiagram expects: { steps: [{label, count, excluded?}] }
 */
export function buildAttritionData(
  executions: SelectedExecution[],
): Record<string, unknown> | undefined {
  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    const attrition = Array.isArray(r.attrition)
      ? (r.attrition as Array<Record<string, unknown>>)
      : [];

    if (attrition.length === 0) continue;

    const steps = attrition.map((a, i) => {
      const count = (a.target as number) ?? (a.count as number) ?? 0;
      const prevCount = i > 0
        ? (attrition[i - 1].target as number) ?? (attrition[i - 1].count as number) ?? 0
        : count;
      const excluded = prevCount - count;

      return {
        label: (a.step as string) ?? (a.description as string) ?? `Step ${i + 1}`,
        count,
        excluded: excluded > 0 ? excluded : undefined,
      };
    });

    return { steps };
  }

  return undefined;
}

/**
 * Build all applicable diagram data for a group of executions.
 */
export function buildDiagramData(
  diagramType: string,
  executions: SelectedExecution[],
): Record<string, unknown> | undefined {
  switch (diagramType) {
    case "forest_plot":
      return buildForestPlotData(executions);
    case "kaplan_meier":
      return buildKaplanMeierData(executions);
    case "attrition":
      return buildAttritionData(executions);
    default:
      return undefined;
  }
}
