import type { TemplateConfig } from "./index";

export const HIMSS_POSTER_TEMPLATE: TemplateConfig = {
  id: "himss-poster",
  nameKey: "publish.templates.himss-poster.name",
  descriptionKey: "publish.templates.himss-poster.description",
  usesResults: true,
  sections: [
    {
      id: "background",
      titleKey: "publish.templates.himss-poster.sections.background",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "problem-statement",
      titleKey: "publish.templates.himss-poster.sections.problem-statement",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "objectives",
      titleKey: "publish.templates.himss-poster.sections.objectives",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "methods",
      titleKey: "publish.templates.himss-poster.sections.methods",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    // Results injected dynamically
    {
      id: "key-findings",
      titleKey: "publish.templates.himss-poster.sections.key-findings",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "clinical-impact",
      titleKey: "publish.templates.himss-poster.sections.clinical-impact",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "next-steps",
      titleKey: "publish.templates.himss-poster.sections.next-steps",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
  ],
};
