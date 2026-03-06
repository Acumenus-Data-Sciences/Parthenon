import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  userManual: [
    {
      type: "doc",
      id: "intro",
      label: "Overview",
    },
    {
      type: "category",
      label: "Part I — Getting Started",
      collapsed: false,
      items: [
        "part1-getting-started/01-introduction",
        "part1-getting-started/02-data-sources",
      ],
    },
    {
      type: "category",
      label: "Part II — Vocabulary",
      items: [
        "part2-vocabulary/03-vocabulary-browser",
        "part2-vocabulary/04-concept-sets",
      ],
    },
    {
      type: "category",
      label: "Part III — Cohorts",
      items: [
        "part3-cohorts/05-cohort-expressions",
        "part3-cohorts/06-building-cohorts",
        "part3-cohorts/07-generating-cohorts",
        "part3-cohorts/08-cohort-management",
      ],
    },
    {
      type: "category",
      label: "Part IV — Analyses",
      items: [
        "part4-analyses/09-characterization",
        "part4-analyses/10-incidence-rates",
        "part4-analyses/11-treatment-pathways",
        "part4-analyses/12-population-level-estimation",
        "part4-analyses/13-patient-level-prediction",
        "part4-analyses/14-studies",
      ],
    },
    {
      type: "category",
      label: "Part V — Data Ingestion",
      items: [
        "part5-ingestion/15-uploading-data",
        "part5-ingestion/16-schema-mapping",
        "part5-ingestion/17-concept-mapping",
      ],
    },
    {
      type: "category",
      label: "Part VI — Data Explorer",
      items: [
        "part6-data-explorer/18-characterization-achilles",
        "part6-data-explorer/19-data-quality-dashboard",
        "part6-data-explorer/20-population-stats",
      ],
    },
    {
      type: "category",
      label: "Part VII — Patient Profiles",
      items: ["part7-patient-profiles/21-patient-timelines"],
    },
    {
      type: "category",
      label: "Part VIII — Administration",
      items: [
        "part8-administration/22-user-management",
        "part8-administration/23-roles-permissions",
        "part8-administration/24-authentication-providers",
        "part8-administration/25-system-configuration",
        "part8-administration/26-audit-log",
      ],
    },
    {
      type: "category",
      label: "Part IX — Genomics",
      items: ["part9-genomics/27-genomics-overview"],
    },
    {
      type: "category",
      label: "Part X — Imaging",
      items: ["part10-imaging/28-imaging-overview"],
    },
    {
      type: "category",
      label: "Part XI — HEOR",
      items: ["part11-heor/29-heor-overview"],
    },
    {
      type: "category",
      label: "Part XII — FHIR EHR Integration",
      items: ["part12-fhir/30-fhir-ehr-integration"],
    },
    {
      type: "category",
      label: "Migration Guide (Atlas → Parthenon)",
      items: [
        "migration/00-overview",
        "migration/01-before-you-begin",
        "migration/02-export-from-atlas",
        "migration/03-import-into-parthenon",
        "migration/04-validating-parity",
        "migration/05-cutover",
        "migration/06-feature-comparison",
      ],
    },
    {
      type: "category",
      label: "Appendices",
      items: [
        "appendices/a-keyboard-shortcuts",
        "appendices/b-omop-domains",
        "appendices/c-circe-json-schema",
        "appendices/d-api-quick-reference",
        "appendices/e-glossary",
        "appendices/f-known-limitations",
        "appendices/g-troubleshooting",
      ],
    },
  ],
};

export default sidebars;
