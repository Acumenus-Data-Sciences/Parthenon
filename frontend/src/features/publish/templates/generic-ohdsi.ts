export const GENERIC_OHDSI_TEMPLATE = {
  id: "generic-ohdsi",
  name: "Generic OHDSI Publication",
  description: "Standard IMRaD structure for observational health data studies",
  requiredSections: ["methods", "results"] as const,
  optionalSections: ["discussion"] as const,
  sectionOrder: ["methods", "results", "diagram", "discussion"] as const,
};
