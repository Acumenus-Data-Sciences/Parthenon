import type { LibraryEntity } from "../types";

/**
 * Map UI-friendly analysis slugs to their backend lifecycle entity.
 * Characterizations are not part of the library lifecycle system and
 * are intentionally omitted — call sites must guard against that.
 */
export const ANALYSIS_TYPE_TO_ENTITY: Record<string, LibraryEntity | null> = {
  characterization: "characterizations",
  characterizations: "characterizations",
  "incidence-rate": "incidence-rate-analyses",
  "incidence-rates": "incidence-rate-analyses",
  pathway: "pathway-analyses",
  pathways: "pathway-analyses",
  estimation: "estimation-analyses",
  estimations: "estimation-analyses",
  prediction: "prediction-analyses",
  predictions: "prediction-analyses",
  sccs: "sccs-analyses",
  "evidence-synthesis": "evidence-synthesis-analyses",
};

export function lifecycleEntityForAnalysis(type: string): LibraryEntity | null {
  return ANALYSIS_TYPE_TO_ENTITY[type] ?? null;
}
