import type { DiagramType } from "../types/publish";

export const SECTION_CONFIG: Record<
  string,
  { titleKey: string; diagramType: DiagramType | null }
> = {
  characterizations: {
    titleKey: "publish.common.resultSection.populationCharacteristics",
    diagramType: null,
  },
  incidence_rates: {
    titleKey: "publish.common.resultSection.incidenceRates",
    diagramType: null,
  },
  estimations: {
    titleKey: "publish.common.resultSection.comparativeEffectiveness",
    diagramType: "forest_plot",
  },
  pathways: {
    titleKey: "publish.common.resultSection.treatmentPatterns",
    diagramType: null,
  },
  sccs: {
    titleKey: "publish.common.resultSection.safetyAnalysis",
    diagramType: null,
  },
  predictions: {
    titleKey: "publish.common.resultSection.predictiveModeling",
    diagramType: null,
  },
  evidence_synthesis: {
    titleKey: "publish.common.resultSection.evidenceSynthesis",
    diagramType: "forest_plot",
  },
  characterization: {
    titleKey: "publish.common.resultSection.populationCharacteristics",
    diagramType: null,
  },
  incidence_rate: {
    titleKey: "publish.common.resultSection.incidenceRates",
    diagramType: null,
  },
  estimation: {
    titleKey: "publish.common.resultSection.comparativeEffectiveness",
    diagramType: "forest_plot",
  },
  pathway: {
    titleKey: "publish.common.resultSection.treatmentPatterns",
    diagramType: null,
  },
  prediction: {
    titleKey: "publish.common.resultSection.predictiveModeling",
    diagramType: null,
  },
};
