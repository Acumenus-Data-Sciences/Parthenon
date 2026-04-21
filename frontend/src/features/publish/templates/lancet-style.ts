import type { TemplateConfig } from "./index";

export const LANCET_STYLE_TEMPLATE: TemplateConfig = {
  id: "lancet-style",
  nameKey: "publish.templates.lancet-style.name",
  descriptionKey: "publish.templates.lancet-style.description",
  usesResults: true,
  sections: [
    {
      id: "introduction",
      titleKey: "publish.templates.lancet-style.sections.introduction",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "methods",
      titleKey: "publish.templates.lancet-style.sections.methods",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "study-design-participants",
      titleKey: "publish.templates.lancet-style.sections.study-design-participants",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "procedures",
      titleKey: "publish.templates.lancet-style.sections.procedures",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "outcomes",
      titleKey: "publish.templates.lancet-style.sections.outcomes",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "statistical-analysis",
      titleKey: "publish.templates.lancet-style.sections.statistical-analysis",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "role-of-funding",
      titleKey: "publish.templates.lancet-style.sections.role-of-funding",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    // Results injected dynamically
    {
      id: "discussion",
      titleKey: "publish.templates.lancet-style.sections.discussion",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
  ],
};
