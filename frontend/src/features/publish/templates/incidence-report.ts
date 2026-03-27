import type { TemplateConfig } from "./index";

export const INCIDENCE_REPORT_TEMPLATE: TemplateConfig = {
  id: "incidence-report",
  name: "Incidence Rate Report",
  description: "Population-based incidence analysis",
  usesResults: true,
  preferredAnalysisTypes: [
    "incidence_rates",
    "incidence_rate",
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
      id: "methods",
      title: "Methods",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    // Results sections are injected dynamically
    {
      id: "discussion",
      title: "Discussion",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
  ],
};
