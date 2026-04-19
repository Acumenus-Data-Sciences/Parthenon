// Phase 18 (Plan 18-06) — D-13 adapter hook.
// Maps the cached endpoint_profile_km_points payload (server-sorted ASC by
// time_days) into the KaplanMeierPlot SVG component's prop shape so we reuse
// frontend/src/features/estimation/components/KaplanMeierPlot.tsx unchanged.
//
// nCensored is DERIVED here because the backend co2_results.endpoint_profile_km_points
// table has only (time_days, survival_prob, at_risk, events) — no censored
// column. Per the contract:
//   nCensored[0] = max(0, subject_count - at_risk[0] - events[0])
//   nCensored[i] = max(0, (at_risk[i-1] - at_risk[i]) - events[i])  for i >= 1
// subject_count comes from endpoint_profile_summary.subject_count (the
// caller passes it as the 2nd arg).
//
// Time-unit heuristic: maxTime ≥ 730d → years; otherwise days. Per
// UI-SPEC §SurvivalPanel copy KM axis toggle.
//
// Comparator curve is intentionally [] — Phase 18 has exactly one cohort
// (the endpoint cohort). KaplanMeierPlot tolerates an empty comparator at the
// SVG level; we pass `comparatorLabel: undefined` so the legend's second
// entry still appears as the literal string "undefined" — but the compromise
// is acceptable for v1 since the existing component has a default of
// "Comparator" if undefined is read as missing. The legend cosmetic is a
// known v1 limitation per UI-SPEC §Flag 1; widening would require touching
// the reused component (rejected per D-13 reuse discipline).
import { useMemo } from "react";
import type { EndpointProfileKmPoint } from "../api";

// Local mirror of KaplanMeierPlot's internal KaplanMeierPoint interface
// (the source file does not export it). Shape MUST stay 1:1 — if the
// estimation component is refactored, this type follows.
export type KaplanMeierAdapterPoint = {
  time: number;
  surv: number;
  nAtRisk: number;
  nEvents: number;
  nCensored: number;
};

export type EndpointProfileKmAdapted = {
  targetCurve: KaplanMeierAdapterPoint[];
  comparatorCurve: [];
  targetLabel: string;
  comparatorLabel: undefined;
  timeUnit: "days" | "years";
  showCI: false;
  showRiskDifference: false;
  showRMST: false;
  interactive: false;
};

export function useEndpointProfileKmData(
  kmPoints: EndpointProfileKmPoint[],
  subjectCount: number,
  endpointDisplayName: string,
): EndpointProfileKmAdapted {
  return useMemo(() => {
    // Defensive sort — caller (server) returns ASC by time_days but we want
    // robustness if the contract ever drifts. Stable sort on a shallow copy.
    const sorted = [...kmPoints].sort((a, b) => a.time_days - b.time_days);

    const maxTime =
      sorted.length > 0 ? sorted[sorted.length - 1].time_days : 0;
    const timeUnit: "days" | "years" = maxTime >= 730 ? "years" : "days";

    const targetCurve: KaplanMeierAdapterPoint[] = sorted.map((p, i) => {
      const prevAtRisk = i === 0 ? subjectCount : sorted[i - 1].at_risk;
      const drop = prevAtRisk - p.at_risk;
      // Clamp to zero — pathological data where events > drop should not
      // produce a negative censored count. Indicates upstream data quality
      // issue but the UI must remain renderable.
      const nCensored = Math.max(0, drop - p.events);
      const time =
        timeUnit === "years" ? p.time_days / 365.25 : p.time_days;
      return {
        time,
        surv: p.survival_prob,
        nAtRisk: p.at_risk,
        nEvents: p.events,
        nCensored,
      };
    });

    return {
      targetCurve,
      comparatorCurve: [] as [],
      targetLabel: endpointDisplayName,
      comparatorLabel: undefined,
      timeUnit,
      showCI: false,
      showRiskDifference: false,
      showRMST: false,
      interactive: false,
    };
  }, [kmPoints, subjectCount, endpointDisplayName]);
}
