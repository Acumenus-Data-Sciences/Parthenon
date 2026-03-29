export interface ProInstrument {
  id?: number;
  abbreviation: string;
  name: string;
  domain: string;
  items: string;
  hasLoinc: boolean;
  loincCode: string | null;
  hasSnomed: boolean;
  snomedCode: string | null;
  omopCoverage: "yes" | "partial" | "no";
  license: "public" | "proprietary";
  licenseDetail: string;
  description?: string;
  itemCount?: number;
}

export type OmopCoverage = ProInstrument["omopCoverage"];
export type LicenseType = ProInstrument["license"];

export const DOMAIN_ORDER = [
  "Mental Health",
  "Substance Use",
  "Quality of Life",
  "Pain",
  "Functional Status",
  "Oncology",
  "Cognitive",
  "Geriatric",
  "Cardiovascular",
  "Respiratory",
  "Diabetes",
  "Pediatric",
  "Neurological",
  "Sleep",
  "Sexual Health",
  "Musculoskeletal",
  "SDOH",
  "Perioperative",
  "PROMIS",
  "Ophthalmology",
  "Movement Disorders",
  "Medication Adherence",
] as const;

export const DOMAIN_COLORS: Record<string, string> = {
  "Mental Health": "#E85A6B",
  "Substance Use": "#F59E0B",
  "Quality of Life": "#2DD4BF",
  "Pain": "#9B1B30",
  "Functional Status": "#60A5FA",
  "Oncology": "#C9A227",
  "Cognitive": "#A78BFA",
  "Geriatric": "#8B5CF6",
  "Cardiovascular": "#EF4444",
  "Respiratory": "#34D399",
  "Diabetes": "#F97316",
  "Pediatric": "#06B6D4",
  "Neurological": "#818CF8",
  "Sleep": "#6366F1",
  "Sexual Health": "#EC4899",
  "Musculoskeletal": "#14B8A6",
  "SDOH": "#84CC16",
  "Perioperative": "#78716C",
  "PROMIS": "#2DD4BF",
  "Ophthalmology": "#0EA5E9",
  "Movement Disorders": "#D946EF",
  "Medication Adherence": "#FB923C",
};

export const OMOP_COLORS: Record<OmopCoverage, string> = {
  yes: "#2DD4BF",
  partial: "#C9A227",
  no: "#E85A6B",
};

export const PAIN_POINTS = [
  {
    id: 1,
    title: "Vocabulary Mapping Gaps",
    description:
      "Incomplete LOINC/SNOMED coverage for survey instruments. Disease-specific tools like EPIC-26 and FACT-G have zero standard concept coverage.",
  },
  {
    id: 2,
    title: "No Pre-Built ETL Templates",
    description:
      "Every organization builds survey ETL from scratch. No reference implementations, no shared mapping files, no automated tools.",
  },
  {
    id: 3,
    title: "Domain Classification Ambiguity",
    description:
      "No standardized logic for Observation vs Measurement domain placement. Same assessment can land in different tables across sites.",
  },
  {
    id: 4,
    title: "Missing Survey Metadata",
    description:
      "CDM v5.4 has no mechanism for respondent type, administration mode, completion status, or temporal treatment relationships.",
  },
  {
    id: 5,
    title: "Composite Score Representation",
    description:
      "No standardized convention for storing item-level responses alongside composite/subscale scores. Multi-site comparisons unreliable.",
  },
  {
    id: 6,
    title: "No Dedicated Analytics",
    description:
      "No survey-specific Achilles analyses: item completion rates, score distributions, floor/ceiling effects, or longitudinal PRO tracking.",
  },
] as const;

export const PILLARS = [
  {
    id: 1,
    title: "Survey Instrument Library",
    subtitle: "100 Pre-Mapped Instruments",
    description:
      "Curated library with complete OMOP concept mappings for every question and answer choice. LOINC-based where available, PTHN_SURVEY custom concepts where not.",
    color: "#2DD4BF",
  },
  {
    id: 2,
    title: "Survey Builder",
    subtitle: "Visual Instrument Designer",
    description:
      "Drag-and-drop instrument creation with ATHENA concept search, Abby AI mapping suggestions, and REDCap/FHIR/CSV import.",
    color: "#C9A227",
  },
  {
    id: 3,
    title: "Survey Conduct Layer",
    subtitle: "v5.4 Compatible, v6.0 Ready",
    description:
      "Administration metadata: respondent type, mode, completion status, visit linkage. Forward-compatible with CDM v6.0's native survey_conduct table.",
    color: "#60A5FA",
  },
  {
    id: 4,
    title: "Survey Analytics",
    subtitle: "Achilles 900-Series",
    description:
      "Dedicated characterization: completion rates, score distributions, floor/ceiling effects, longitudinal trajectories, and 5 data quality checks.",
    color: "#A78BFA",
  },
] as const;
