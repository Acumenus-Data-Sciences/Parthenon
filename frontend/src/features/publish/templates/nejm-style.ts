import type { TemplateConfig } from "./index";

export const NEJM_STYLE_TEMPLATE: TemplateConfig = {
  id: "nejm-style",
  nameKey: "publish.templates.nejm-style.name",
  descriptionKey: "publish.templates.nejm-style.description",
  usesResults: true,
  sections: [
    {
      id: "introduction",
      titleKey: "publish.templates.nejm-style.sections.introduction",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "methods",
      titleKey: "publish.templates.nejm-style.sections.methods",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "study-design",
      titleKey: "publish.templates.nejm-style.sections.study-design",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "patients",
      titleKey: "publish.templates.nejm-style.sections.patients",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "endpoints",
      titleKey: "publish.templates.nejm-style.sections.endpoints",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "statistical-analysis",
      titleKey: "publish.templates.nejm-style.sections.statistical-analysis",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    // Results injected dynamically
    {
      id: "discussion",
      titleKey: "publish.templates.nejm-style.sections.discussion",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
  ],
};
