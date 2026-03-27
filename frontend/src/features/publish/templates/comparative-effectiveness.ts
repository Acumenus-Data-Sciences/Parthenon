import type { TemplateConfig } from "./index";

export const COMPARATIVE_EFFECTIVENESS_TEMPLATE: TemplateConfig = {
  id: "comparative-effectiveness",
  name: "Comparative Effectiveness Report",
  description: "CLE/CER structure with propensity score analysis",
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
      title: "Background",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "study-design",
      title: "Study Design",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "ps-matching",
      title: "Propensity Score Matching",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "covariates",
      title: "Covariate Balance",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    // Results sections are injected dynamically
    {
      id: "sensitivity-analyses",
      title: "Sensitivity Analyses",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "discussion",
      title: "Discussion",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
  ],
};
