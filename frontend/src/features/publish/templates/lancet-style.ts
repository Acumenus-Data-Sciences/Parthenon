import type { TemplateConfig } from "./index";

export const LANCET_STYLE_TEMPLATE: TemplateConfig = {
  id: "lancet-style",
  name: "Lancet Style",
  description: "The Lancet — global health focus with structured methods, evidence-based interpretation, and policy implications",
  usesResults: true,
  sections: [
    {
      id: "introduction",
      title: "Introduction",
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
    {
      id: "study-design-participants",
      title: "Study Design and Participants",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "procedures",
      title: "Procedures",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "outcomes",
      title: "Outcomes",
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
    {
      id: "role-of-funding",
      title: "Role of the Funding Source",
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
  ],
};
