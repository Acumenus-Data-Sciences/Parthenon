// frontend/src/features/finngen-analyses/types.ts

// -- Display.json shapes --

export type CodeWASSignal = {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  p_value: number;
  beta: number;
  se: number;
  n_cases: number;
  n_controls: number;
};

export type CodeWASDisplay = {
  signals: CodeWASSignal[];
  thresholds: {
    bonferroni: number;
    suggestive: number;
  };
  summary: {
    total_codes_tested: number;
    significant_count: number;
  };
};

export type TimeCodeWASWindow = {
  start_day: number;
  end_day: number;
  signals: CodeWASSignal[];
};

export type TimeCodeWASDisplay = {
  windows: TimeCodeWASWindow[];
  summary: {
    window_count: number;
    total_significant: number;
  };
};

export type OverlapSet = {
  cohort_id: number;
  cohort_name: string;
  size: number;
};

export type OverlapIntersection = {
  members: number[];
  size: number;
  degree: number;
};

export type OverlapsDisplay = {
  sets: OverlapSet[];
  intersections: OverlapIntersection[];
  matrix: number[][];
  summary: {
    max_overlap_pct: number;
  };
};

export type DemographicsCohort = {
  cohort_id: number;
  cohort_name: string;
  n: number;
  age_histogram: { decile: number; male: number; female: number }[];
  gender_counts: { male: number; female: number; unknown: number };
  summary: { mean_age: number; median_age: number };
};

export type DemographicsDisplay = {
  cohorts: DemographicsCohort[];
};

// -- Union of all display types --

export type AnalysisDisplay =
  | CodeWASDisplay
  | TimeCodeWASDisplay
  | OverlapsDisplay
  | DemographicsDisplay;

// -- Settings form --

export type ModuleSettingsSchema = Record<string, unknown>;

// -- UI schema for RJSF (frontend-only, not stored in DB) --

export type ModuleUiSchema = Record<string, unknown>;

// -- Module key union for type-safe switch --

export type CO2ModuleKey =
  | "co2.codewas"
  | "co2.time_codewas"
  | "co2.overlaps"
  | "co2.demographics";
