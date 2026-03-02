// Record counts per CDM table
export interface RecordCount {
  table: string;
  count: number;
}

// Demographics
export interface DemographicDistribution {
  concept_id: number;
  concept_name: string;
  count: number;
}

export interface AgeDistribution {
  age_decile: string;
  count: number;
}

export interface Demographics {
  gender: DemographicDistribution[];
  race: DemographicDistribution[];
  ethnicity: DemographicDistribution[];
  age: AgeDistribution[];
  yearOfBirth: { year: string; count: number }[];
}

// Observation Periods
export interface BoxPlotData {
  min: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
}

export interface ObservationPeriods {
  count: number;
  durationDistribution: BoxPlotData | null;
  startYearMonth: { year_month: string; count: number }[];
  endYearMonth: { year_month: string; count: number }[];
  periodsByPerson: { count_value: string; persons: number }[];
  ageDist: BoxPlotData | null;
}

// Domain Summary
export interface ConceptSummary {
  concept_id: number;
  concept_name: string;
  count: number;
  prevalence: number;
}

export interface DomainSummary {
  totalRecords: number;
  totalConcepts: number;
  topConcepts: ConceptSummary[];
}

// Concept Drilldown
export interface ConceptDrilldown {
  concept_id: number;
  concept_name: string;
  genderSplit: { concept_name: string; count: number }[];
  ageDistribution: BoxPlotData | null;
  temporalTrend: { year_month: string; count: number }[];
  typeDistribution: { concept_name: string; count: number }[];
}

// Temporal Trends
export interface TemporalTrendPoint {
  year_month: string;
  count: number;
}

// Available Analyses
export interface AnalysisInfo {
  analysis_id: number;
  analysis_name: string;
  category: string;
  row_count: number;
}

// Performance Report
export interface PerformanceEntry {
  analysis_id: number;
  analysis_name: string;
  elapsed_seconds: number;
}

// Distribution data
export interface DistributionEntry extends BoxPlotData {
  stratum_1: string | null;
  count: number;
}

// DQD Types
export interface DqdRun {
  run_id: string;
  source_id: number;
  total_checks: number;
  passed: number;
  failed: number;
  error_count: number;
  warning_count: number;
  created_at: string;
}

export interface DqdCategorySummary {
  category: string;
  total: number;
  passed: number;
  failed: number;
  pass_rate: number;
}

export interface DqdRunSummary {
  run_id: string;
  total_checks: number;
  passed: number;
  failed: number;
  warnings: number;
  by_category: DqdCategorySummary[];
}

export interface DqdCheckResult {
  id: number;
  check_id: string;
  category: string;
  subcategory: string;
  cdm_table: string;
  cdm_column: string | null;
  severity: "error" | "warning" | "info";
  threshold: number;
  passed: boolean;
  violated_rows: number;
  total_rows: number;
  violation_percentage: number | null;
  description: string;
  details: Record<string, unknown> | null;
  execution_time_ms: number | null;
}

export type DqdCategory = "completeness" | "conformance" | "plausibility";
export type Domain =
  | "condition"
  | "drug"
  | "procedure"
  | "measurement"
  | "observation"
  | "visit";

export const DOMAIN_LABELS: Record<Domain, string> = {
  condition: "Conditions",
  drug: "Drugs",
  procedure: "Procedures",
  measurement: "Measurements",
  observation: "Observations",
  visit: "Visits",
};

export const CATEGORY_LABELS: Record<DqdCategory, string> = {
  completeness: "Completeness",
  conformance: "Conformance",
  plausibility: "Plausibility",
};
