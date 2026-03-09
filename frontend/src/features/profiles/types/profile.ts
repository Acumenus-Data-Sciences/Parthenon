// ---------------------------------------------------------------------------
// Patient Profile Types
// ---------------------------------------------------------------------------

export interface PatientDemographics {
  person_id: number;
  gender: string;
  year_of_birth: number;
  month_of_birth: number | null;
  day_of_birth: number | null;
  race: string;
  ethnicity: string;
  // Location from location table (may be null if no location_id on person)
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  county?: string | null;
}

export type ClinicalDomain =
  | "condition"
  | "drug"
  | "procedure"
  | "measurement"
  | "observation"
  | "visit";

/** Normalized clinical event — all domains share these fields. */
export interface ClinicalEvent {
  domain: ClinicalDomain;
  concept_id: number;
  concept_name: string;
  start_date: string;
  end_date: string | null;
  type_name?: string | null;
  vocabulary?: string | null;
  occurrence_id?: number | null;

  // Measurement / Observation value fields
  value?: number | string | null;
  value_as_concept?: string | null;
  value_as_string?: string | null;
  unit?: string | null;

  // Measurement reference range
  range_low?: number | null;
  range_high?: number | null;

  // Drug-specific
  route?: string | null;
  quantity?: number | null;
  days_supply?: number | null;

  // Visit-specific (for event binning)
  visit_occurrence_id?: number | null;
}

export interface ObservationPeriod {
  observation_period_id?: number;
  start_date: string;
  end_date: string;
  period_type?: string | null;
}

export interface ConditionEra {
  condition_era_id: number;
  condition_concept_id: number;
  condition_name: string;
  condition_era_start_date: string;
  condition_era_end_date: string;
  condition_occurrence_count: number;
}

export interface DrugEra {
  drug_era_id: number;
  drug_concept_id: number;
  drug_name: string;
  drug_era_start_date: string;
  drug_era_end_date: string;
  drug_exposure_count: number;
  gap_days: number;
}

export interface ClinicalNote {
  note_id: number;
  person_id: number;
  note_date: string;
  note_datetime: string | null;
  note_title: string | null;
  note_text: string;
  note_source_value: string | null;
  visit_occurrence_id: number | null;
  provider_id: number | null;
  note_type: string;
  note_class: string;
  encoding: string;
  language: string;
}

export interface PatientProfile {
  demographics: PatientDemographics;
  observation_periods: ObservationPeriod[];
  conditions: ClinicalEvent[];
  drugs: ClinicalEvent[];
  procedures: ClinicalEvent[];
  measurements: ClinicalEvent[];
  observations: ClinicalEvent[];
  visits: ClinicalEvent[];
  condition_eras?: ConditionEra[];
  drug_eras?: DrugEra[];
}

export interface CohortMember {
  subject_id: number;
  cohort_start_date: string;
  cohort_end_date: string;
  gender?: string;
  year_of_birth?: number;
}
