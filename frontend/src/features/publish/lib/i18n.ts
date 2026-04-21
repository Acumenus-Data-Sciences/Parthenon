import i18n from "@/i18n/i18n";
import type { TFunction } from "i18next";
import type { TemplateConfig, TemplateSectionDef } from "../templates";

const ANALYSIS_TYPE_KEY_MAP: Record<string, string> = {
  characterizations: "characterizations",
  characterization: "characterization",
  estimations: "estimations",
  estimation: "estimation",
  predictions: "predictions",
  prediction: "prediction",
  incidence_rates: "incidence_rates",
  incidence_rate: "incidence_rate",
  sccs: "sccs",
  evidence_synthesis: "evidence_synthesis",
  pathways: "pathways",
  pathway: "pathway",
};

const RESULT_SECTION_KEY_MAP: Record<string, string> = {
  characterizations: "populationCharacteristics",
  characterization: "populationCharacteristics",
  incidence_rates: "incidenceRates",
  incidence_rate: "incidenceRates",
  estimations: "comparativeEffectiveness",
  estimation: "comparativeEffectiveness",
  pathways: "treatmentPatterns",
  pathway: "treatmentPatterns",
  sccs: "safetyAnalysis",
  predictions: "predictiveModeling",
  prediction: "predictiveModeling",
  evidence_synthesis: "evidenceSynthesis",
};

const SECTION_TYPE_KEY_MAP: Record<string, string> = {
  title: "title",
  methods: "methods",
  results: "results",
  diagram: "diagram",
  discussion: "discussion",
  diagnostics: "diagnostics",
};

export function getPublishAnalysisTypeLabel(
  t: TFunction,
  analysisType: string,
): string {
  const key = ANALYSIS_TYPE_KEY_MAP[analysisType];
  if (!key) return analysisType;
  return t(`publish.common.analysisType.${key}`);
}

export function getPublishResultSectionTitle(
  t: TFunction,
  analysisType: string,
): string {
  const key = RESULT_SECTION_KEY_MAP[analysisType];
  if (!key) {
    return analysisType
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return t(`publish.common.resultSection.${key}`);
}

export function getPublishSectionTypeLabel(
  t: TFunction,
  sectionType: string,
): string {
  const key = SECTION_TYPE_KEY_MAP[sectionType];
  if (!key) return sectionType;
  return t(`publish.common.sectionType.${key}`);
}

export function getPublishTemplateName(
  t: TFunction,
  template: Pick<TemplateConfig, "nameKey">,
): string {
  return t(template.nameKey);
}

export function getPublishTemplateDescription(
  t: TFunction,
  template: Pick<TemplateConfig, "descriptionKey">,
): string {
  return t(template.descriptionKey);
}

export function getPublishTemplateSectionTitle(
  t: TFunction,
  section: Pick<TemplateSectionDef, "titleKey">,
): string {
  return t(section.titleKey);
}

export function translatePublish(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, {
    ns: "app",
    ...options,
  });
}
