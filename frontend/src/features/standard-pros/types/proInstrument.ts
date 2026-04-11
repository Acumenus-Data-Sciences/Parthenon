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
  "Mental Health": "var(--critical)",
  "Substance Use": "#F59E0B",
  "Quality of Life": "var(--success)",
  "Pain": "var(--primary)",
  "Functional Status": "var(--info)",
  "Oncology": "var(--accent)",
  "Cognitive": "var(--domain-observation)",
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
  "PROMIS": "var(--success)",
  "Ophthalmology": "#0EA5E9",
  "Movement Disorders": "#D946EF",
  "Medication Adherence": "#FB923C",
};

export const OMOP_COLORS: Record<OmopCoverage, string> = {
  yes: "var(--success)",
  partial: "var(--accent)",
  no: "var(--critical)",
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
    color: "var(--success)",
  },
  {
    id: 2,
    title: "Survey Builder",
    subtitle: "Visual Instrument Designer",
    description:
      "Drag-and-drop instrument creation with ATHENA concept search, Abby AI mapping suggestions, and REDCap/FHIR/CSV import.",
    color: "var(--accent)",
  },
  {
    id: 3,
    title: "Survey Conduct Layer",
    subtitle: "v5.4 Compatible, v6.0 Ready",
    description:
      "Administration metadata: respondent type, mode, completion status, visit linkage. Forward-compatible with CDM v6.0's native survey_conduct table.",
    color: "var(--info)",
  },
  {
    id: 4,
    title: "Survey Analytics",
    subtitle: "Achilles 900-Series",
    description:
      "Dedicated characterization: completion rates, score distributions, floor/ceiling effects, longitudinal trajectories, and 5 data quality checks.",
    color: "var(--domain-observation)",
  },
] as const;
