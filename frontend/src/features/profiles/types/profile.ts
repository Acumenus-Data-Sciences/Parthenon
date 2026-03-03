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
}

export type ClinicalDomain =
  | "condition"
  | "drug"
  | "procedure"
  | "measurement"
  | "observation"
  | "visit";

export interface ClinicalEvent {
  domain: ClinicalDomain;
  concept_id: number;
  concept_name: string;
  start_date: string;
  end_date: string | null;
  value?: string | number | null;
  unit?: string | null;
  type_name?: string | null;
  additional?: Record<string, unknown>;
}

export interface ObservationPeriod {
  start_date: string;
  end_date: string;
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
