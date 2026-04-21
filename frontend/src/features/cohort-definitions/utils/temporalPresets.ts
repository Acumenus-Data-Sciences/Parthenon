import type { TemporalWindow } from "../types/cohortExpression";
import i18next from "@/i18n/i18n";

function tApp(key: string): string {
  return i18next.t(key, { ns: "app" });
}

export interface TemporalPreset {
  key: string;
  label: string;
  description: string;
  window: TemporalWindow | null; // null = no temporal restriction
}

export function getTemporalPresets(): TemporalPreset[] {
  return [
    {
      key: "any_time_before",
      label: tApp("cohortDefinitions.auto.anyTimeBefore_95323b"),
      description: tApp(
        "cohortDefinitions.auto.eventOccurredAtAnyPointPriorToCohort_a7c552",
      ),
      window: {
        Start: { Days: 99999, Coeff: -1 },
        End: { Days: 0, Coeff: -1 },
      },
    },
    {
      key: "any_time_after",
      label: tApp("cohortDefinitions.auto.anyTimeAfter_259672"),
      description: tApp(
        "cohortDefinitions.auto.eventOccurredAtAnyPointAfterCohortEntry_358df7",
      ),
      window: {
        Start: { Days: 0, Coeff: 1 },
        End: { Days: 99999, Coeff: 1 },
      },
    },
    {
      key: "same_day",
      label: tApp("cohortDefinitions.auto.sameDay_d051d9"),
      description: tApp(
        "cohortDefinitions.auto.eventOnTheSameDateAsCohortEntry_3fcdd6",
      ),
      window: {
        Start: { Days: 0, Coeff: -1 },
        End: { Days: 0, Coeff: 1 },
      },
    },
    {
      key: "within_30",
      label: tApp("cohortDefinitions.auto.within30Days_c68e5c"),
      description: tApp(
        "cohortDefinitions.auto.30DaysBeforeThrough30DaysAfter_448f6c",
      ),
      window: {
        Start: { Days: 30, Coeff: -1 },
        End: { Days: 30, Coeff: 1 },
      },
    },
    {
      key: "within_90",
      label: tApp("cohortDefinitions.auto.within90Days_02c615"),
      description: tApp(
        "cohortDefinitions.auto.90DaysBeforeThrough90DaysAfter_467b93",
      ),
      window: {
        Start: { Days: 90, Coeff: -1 },
        End: { Days: 90, Coeff: 1 },
      },
    },
    {
      key: "any_time",
      label: tApp("cohortDefinitions.auto.anyTime_76226a"),
      description: tApp("cohortDefinitions.auto.noTemporalRestriction_bc0132"),
      window: null,
    },
  ];
}

export type TemporalDirection = "before" | "after";

export function directionToCoeff(direction: TemporalDirection): number {
  return direction === "before" ? -1 : 1;
}

export function coeffToDirection(coeff: number): TemporalDirection {
  return coeff < 0 ? "before" : "after";
}

export function buildCustomWindow(
  startDays: number,
  startDirection: TemporalDirection,
  endDays: number,
  endDirection: TemporalDirection,
): TemporalWindow {
  return {
    Start: { Days: startDays, Coeff: directionToCoeff(startDirection) },
    End: { Days: endDays, Coeff: directionToCoeff(endDirection) },
  };
}

export function describeWindow(window: TemporalWindow | null | undefined): string {
  if (!window) return "any time";
  const startDir = coeffToDirection(window.Start.Coeff);
  const endDir = coeffToDirection(window.End.Coeff);

  if (window.Start.Days === 0 && window.End.Days === 0) {
    return "on the same day as cohort entry";
  }
  if (window.Start.Days >= 99999 && startDir === "before") {
    return "any time before cohort entry";
  }
  if (window.End.Days >= 99999 && endDir === "after") {
    return "any time after cohort entry";
  }

  return `between ${window.Start.Days} days ${startDir} and ${window.End.Days} days ${endDir} cohort entry`;
}
