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
  "Substance Use": "var(--warning)",
  "Quality of Life": "var(--success)",
  "Pain": "var(--primary)",
  "Functional Status": "var(--info)",
  "Oncology": "var(--accent)",
  "Cognitive": "var(--domain-observation)",
  "Geriatric": "var(--domain-observation)",
  "Cardiovascular": "#EF4444",
  "Respiratory": "var(--success)",
  "Diabetes": "var(--domain-device)",
  "Pediatric": "#06B6D4",
  "Neurological": "var(--info)",
  "Sleep": "var(--domain-observation)",
  "Sexual Health": "var(--domain-procedure)",
  "Musculoskeletal": "#14B8A6",
  "SDOH": "#84CC16",
  "Perioperative": "#78716C",
  "PROMIS": "var(--success)",
  "Ophthalmology": "#0EA5E9",
  "Movement Disorders": "#D946EF",
  "Medication Adherence": "var(--domain-device)",
};

export const OMOP_COLORS: Record<OmopCoverage, string> = {
  yes: "var(--success)",
  partial: "var(--accent)",
  no: "var(--critical)",
};
