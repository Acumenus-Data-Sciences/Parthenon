import type { CohortDivergence } from "../types/patientSimilarity";

export interface RadarDataPoint {
  dimension: string;
  divergence: number;
  fullMark: number;
}

export interface CohortComparisonRadarModel {
  data: RadarDataPoint[];
  unavailableDimensions: string[];
}

const DIMENSION_LABELS: Record<string, string> = {
  demographics: "Demographics",
  conditions: "Conditions",
  measurements: "Measurements",
  drugs: "Drugs",
  procedures: "Procedures",
  genomics: "Genomics",
};

export function buildCohortComparisonRadarModel(
  divergence: Record<string, CohortDivergence>,
): CohortComparisonRadarModel {
  const data: RadarDataPoint[] = [];
  const unavailableDimensions: string[] = [];

  Object.entries(divergence).forEach(([key, dimension]) => {
    const label = DIMENSION_LABELS[key] ?? key;
    if (dimension.label === "No data") {
      unavailableDimensions.push(label);
      return;
    }

    data.push({
      dimension: label,
      divergence: Math.round(dimension.score * 100),
      fullMark: 100,
    });
  });

  return {
    data,
    unavailableDimensions,
  };
}
