import type { TemplateConfig } from "./index";

export const COMPARATIVE_EFFECTIVENESS_TEMPLATE: TemplateConfig = {
  id: "comparative-effectiveness",
  nameKey: "publish.templates.comparative-effectiveness.name",
  descriptionKey: "publish.templates.comparative-effectiveness.description",
  usesResults: true,
  preferredAnalysisTypes: [
    "estimations",
    "estimation",
    "characterizations",
    "characterization",
  ],
  sections: [
    {
      id: "background",
      titleKey: "publish.templates.comparative-effectiveness.sections.background",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "study-design",
      titleKey: "publish.templates.comparative-effectiveness.sections.study-design",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "ps-matching",
      titleKey: "publish.templates.comparative-effectiveness.sections.ps-matching",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "covariates",
      titleKey: "publish.templates.comparative-effectiveness.sections.covariates",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    // Results sections are injected dynamically
    {
      id: "sensitivity-analyses",
      titleKey:
        "publish.templates.comparative-effectiveness.sections.sensitivity-analyses",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "discussion",
      titleKey: "publish.templates.comparative-effectiveness.sections.discussion",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
  ],
};
