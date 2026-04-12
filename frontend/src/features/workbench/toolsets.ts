import type { ToolsetDescriptor } from "./types";

export const TOOLSET_REGISTRY: ToolsetDescriptor[] = [
  {
    slug: "finngen",
    name: "FinnGen Evidence Investigation",
    tagline: "Phenotype-to-evidence research platform",
    description:
      "Unified workspace combining clinical phenotyping, HADES observational analytics, and genomic evidence (Open Targets, GWAS Catalog) into an exportable Evidence Dossier.",
    icon: "Dna",
    accent: "var(--success)",
    status: "available",
    route: "/workbench/investigation",
    badge: "Evidence Board",
  },
  {
    slug: "morpheus",
    name: "Morpheus",
    tagline: "Inpatient outcomes & ICU analytics workbench",
    description:
      "ICU-focused analytics leveraging MIMIC-IV data in OMOP CDM 5.4. ABCDEF Liberation Bundle compliance, ventilator weaning prediction, sedation monitoring, and inpatient outcome research.",
    icon: "BedDouble",
    accent: "var(--primary)",
    status: "available",
    route: "/morpheus",
    badge: "MIMIC-IV",
  },
  {
    slug: "sdk",
    name: "Build a Toolset",
    tagline: "Community SDK for third-party integrations",
    description:
      "Reference implementation and SDK documentation for building custom toolsets that plug into the Parthenon Workbench. Service descriptors, result envelopes, and artifact patterns.",
    icon: "Blocks",
    accent: "var(--accent)",
    status: "available",
    route: "/workbench/community-sdk-demo",
  },
];
