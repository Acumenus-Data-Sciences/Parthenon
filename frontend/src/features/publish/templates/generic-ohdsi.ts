import type { TemplateConfig } from "./index";

export const GENERIC_OHDSI_TEMPLATE: TemplateConfig = {
  id: "generic-ohdsi",
  nameKey: "publish.templates.generic-ohdsi.name",
  descriptionKey: "publish.templates.generic-ohdsi.description",
  usesResults: true,
  sections: [
    {
      id: "introduction",
      titleKey: "publish.templates.generic-ohdsi.sections.introduction",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    {
      id: "methods",
      titleKey: "publish.templates.generic-ohdsi.sections.methods",
      type: "methods",
      narrativeIncluded: true,
      tableIncluded: false,
    },
    // Results sections are injected dynamically by buildManuscriptSections
    {
      id: "discussion",
      titleKey: "publish.templates.generic-ohdsi.sections.discussion",
      type: "discussion",
      narrativeIncluded: true,
      tableIncluded: false,
    },
  ],
};
