import type { TemporalWindow } from "../types/cohortExpression";

export interface TemporalPreset {
  key: string;
  label: string;
  description: string;
  window: TemporalWindow | null; // null = no temporal restriction
}

export const TEMPORAL_PRESETS: TemporalPreset[] = [
  {
    key: "any_time_before",
    label: "Any time before",
    description: "Event occurred at any point prior to cohort entry",
    window: {
      Start: { Days: 99999, Coeff: -1 },
      End: { Days: 0, Coeff: -1 },
    },
  },
  {
    key: "any_time_after",
    label: "Any time after",
    description: "Event occurred at any point after cohort entry",
    window: {
      Start: { Days: 0, Coeff: 1 },
      End: { Days: 99999, Coeff: 1 },
    },
  },
  {
    key: "same_day",
    label: "Same day",
    description: "Event on the same date as cohort entry",
    window: {
      Start: { Days: 0, Coeff: -1 },
      End: { Days: 0, Coeff: 1 },
    },
  },
  {
    key: "within_30",
    label: "Within 30 days",
    description: "30 days before through 30 days after",
    window: {
      Start: { Days: 30, Coeff: -1 },
      End: { Days: 30, Coeff: 1 },
    },
  },
  {
    key: "within_90",
    label: "Within 90 days",
    description: "90 days before through 90 days after",
    window: {
      Start: { Days: 90, Coeff: -1 },
      End: { Days: 90, Coeff: 1 },
    },
  },
  {
    key: "any_time",
    label: "Any time",
    description: "No temporal restriction",
    window: null,
  },
];

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
