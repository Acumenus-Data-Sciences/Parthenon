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

export interface PatientProfile {
  demographics: PatientDemographics;
  observation_periods: ObservationPeriod[];
  conditions: ClinicalEvent[];
  drugs: ClinicalEvent[];
  procedures: ClinicalEvent[];
  measurements: ClinicalEvent[];
  observations: ClinicalEvent[];
  visits: ClinicalEvent[];
}

export interface CohortMember {
  subject_id: number;
  cohort_start_date: string;
  cohort_end_date: string;
  gender?: string;
  year_of_birth?: number;
}
