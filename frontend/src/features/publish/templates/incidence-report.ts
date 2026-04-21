import type { TemplateConfig } from "./index";

export const INCIDENCE_REPORT_TEMPLATE: TemplateConfig = {
  id: "incidence-report",
  nameKey: "publish.templates.incidence-report.name",
  descriptionKey: "publish.templates.incidence-report.description",
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
      titleKey: "publish.templates.incidence-report.sections.background",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "methods",
      titleKey: "publish.templates.incidence-report.sections.methods",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    // Results sections are injected dynamically
    {
      id: "discussion",
      titleKey: "publish.templates.incidence-report.sections.discussion",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
  ],
};
