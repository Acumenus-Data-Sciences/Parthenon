import type { TemplateConfig } from "./index";

export const JAMIA_STYLE_TEMPLATE: TemplateConfig = {
  id: "jamia-style",
  nameKey: "publish.templates.jamia-style.name",
  descriptionKey: "publish.templates.jamia-style.description",
  usesResults: true,
  sections: [
    {
      id: "background-significance",
      titleKey: "publish.templates.jamia-style.sections.background-significance",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "objective",
      titleKey: "publish.templates.jamia-style.sections.objective",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "materials-methods",
      titleKey: "publish.templates.jamia-style.sections.materials-methods",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "data-sources",
      titleKey: "publish.templates.jamia-style.sections.data-sources",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "phenotype-definitions",
      titleKey: "publish.templates.jamia-style.sections.phenotype-definitions",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "statistical-analysis",
      titleKey: "publish.templates.jamia-style.sections.statistical-analysis",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    // Results injected dynamically
    {
      id: "discussion",
      titleKey: "publish.templates.jamia-style.sections.discussion",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "limitations",
      titleKey: "publish.templates.jamia-style.sections.limitations",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "conclusion",
      titleKey: "publish.templates.jamia-style.sections.conclusion",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
  ],
};
