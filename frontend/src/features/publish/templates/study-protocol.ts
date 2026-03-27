import type { TemplateConfig } from "./index";

export const STUDY_PROTOCOL_TEMPLATE: TemplateConfig = {
  id: "study-protocol",
  name: "Study Protocol / SAP",
  description: "Pre-study statistical analysis plan -- no results needed",
  usesResults: false,
  sections: [
    {
      id: "objectives",
      title: "Objectives",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "hypotheses",
      title: "Hypotheses",
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
      id: "data-sources",
      title: "Data Sources",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "cohort-definitions",
      title: "Cohort Definitions",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "analysis-plan",
      title: "Analysis Plan",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "timeline",
      title: "Timeline",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
  ],
};
