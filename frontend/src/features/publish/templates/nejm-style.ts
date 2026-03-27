import type { TemplateConfig } from "./index";

export const NEJM_STYLE_TEMPLATE: TemplateConfig = {
  id: "nejm-style",
  name: "NEJM Style",
  description: "New England Journal of Medicine — concise clinical impact structure with strict word economy",
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
      id: "study-design",
      title: "Study Design and Oversight",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "patients",
      title: "Patients",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "endpoints",
      title: "End Points",
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
  ],
};
