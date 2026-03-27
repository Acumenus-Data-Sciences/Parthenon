import type { TemplateConfig } from "./index";

export const JAMIA_STYLE_TEMPLATE: TemplateConfig = {
  id: "jamia-style",
  name: "JAMIA Style",
  description: "Journal of the American Medical Informatics Association — informatics methodology focus with reproducibility emphasis",
  usesResults: true,
  sections: [
    {
      id: "background-significance",
      title: "Background and Significance",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "objective",
      title: "Objective",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "materials-methods",
      title: "Materials and Methods",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "data-sources",
      title: "Data Sources and Study Population",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "phenotype-definitions",
      title: "Phenotype Definitions",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "statistical-analysis",
      title: "Statistical Analysis",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    // Results injected dynamically
    {
      id: "discussion",
      title: "Discussion",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "limitations",
      title: "Limitations",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "conclusion",
      title: "Conclusion",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
  ],
};
