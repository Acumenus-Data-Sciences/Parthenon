import type { ToolsetDescriptor } from "./types";

export const TOOLSET_REGISTRY: ToolsetDescriptor[] = [
  {
    slug: "finngen",
    name: "FinnGen",
    tagline: "Population-scale genomic analysis pipeline",
    description:
      "Four-step workflow: CDM exploration via ROMOPAPI, HADES SQL rendering, cohort operations, and CO2 downstream analysis modules. Powered by the StudyAgent service registry.",
    icon: "Dna",
    accent: "#2DD4BF",
    status: "available",
    route: "/workbench/finngen",
    badge: "StudyAgent",
    requiresStudyAgent: true,
  },
  {
    slug: "morpheus",
    name: "Morpheus",
    tagline: "Inpatient outcomes & ICU analytics workbench",
    description:
      "ICU-focused analytics leveraging MIMIC-IV data in OMOP CDM 5.4. ABCDEF Liberation Bundle compliance, ventilator weaning prediction, sedation monitoring, and inpatient outcome research.",
    icon: "BedDouble",
    accent: "#9B1B30",
    status: "coming_soon",
    route: null,
    badge: "MIMIC-IV",
  },
  {
    slug: "sdk",
    name: "Build a Toolset",
    tagline: "Community SDK for third-party integrations",
    description:
      "Reference implementation and SDK documentation for building custom toolsets that plug into the Parthenon Workbench. Service descriptors, result envelopes, and artifact patterns.",
    icon: "Blocks",
    accent: "#C9A227",
    status: "available",
    route: "/workbench/community-sdk-demo",
  },
];
