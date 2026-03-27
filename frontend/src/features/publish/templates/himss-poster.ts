import type { TemplateConfig } from "./index";

export const HIMSS_POSTER_TEMPLATE: TemplateConfig = {
  id: "himss-poster",
  name: "HIMSS Poster",
  description: "HIMSS conference poster — concise panels for background, methods, key findings, and impact statement",
  usesResults: true,
  sections: [
    {
      id: "background",
      title: "Background",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "problem-statement",
      title: "Problem Statement",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "objectives",
      title: "Objectives",
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
    // Results injected dynamically
    {
      id: "key-findings",
      title: "Key Findings",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "clinical-impact",
      title: "Clinical and Operational Impact",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "next-steps",
      title: "Next Steps",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
  ],
};
