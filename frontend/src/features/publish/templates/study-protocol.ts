import type { TemplateConfig } from "./index";

export const STUDY_PROTOCOL_TEMPLATE: TemplateConfig = {
  id: "study-protocol",
  nameKey: "publish.templates.study-protocol.name",
  descriptionKey: "publish.templates.study-protocol.description",
  usesResults: false,
  sections: [
    {
      id: "objectives",
      titleKey: "publish.templates.study-protocol.sections.objectives",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "hypotheses",
      titleKey: "publish.templates.study-protocol.sections.hypotheses",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "study-design",
      titleKey: "publish.templates.study-protocol.sections.study-design",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "data-sources",
      titleKey: "publish.templates.study-protocol.sections.data-sources",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "cohort-definitions",
      titleKey: "publish.templates.study-protocol.sections.cohort-definitions",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "analysis-plan",
      titleKey: "publish.templates.study-protocol.sections.analysis-plan",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "timeline",
      titleKey: "publish.templates.study-protocol.sections.timeline",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
  ],
};
