// ---------------------------------------------------------------------------
// Diagram Builders — transform result_json into diagram component props
// ---------------------------------------------------------------------------

import type { SelectedExecution } from "../types/publish";

/**
 * Build forest plot data from estimation results.
 * ForestPlot expects: { data: [{label, estimate, ci_lower, ci_upper}], pooled? }
 */
export function buildForestPlotData(
  executions: SelectedExecution[],
): Record<string, unknown> | undefined {
  const points: Array<{ label: string; estimate: number; ci_lower: number; ci_upper: number }> = [];

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    const estimates = Array.isArray(r.estimates)
      ? (r.estimates as Array<Record<string, unknown>>)
      : [];

    for (const est of estimates) {
      const hr = (est.hazard_ratio as number) ?? (est.hr as number);
      const ciLo = (est.ci_95_lower as number) ?? (est.ci_lower as number);
      const ciHi = (est.ci_95_upper as number) ?? (est.ci_upper as number);
      if (typeof hr !== "number") continue;

      points.push({
        label: (est.outcome_name as string) ?? exec.analysisName,
        estimate: Math.round(hr * 100) / 100,
        ci_lower: typeof ciLo === "number" ? Math.round(ciLo * 100) / 100 : hr,
        ci_upper: typeof ciHi === "number" ? Math.round(ciHi * 100) / 100 : hr,
      });
    }
  }

  if (points.length === 0) return undefined;

  return {
    data: points,
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
