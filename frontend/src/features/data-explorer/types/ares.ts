export interface EtlMetadata {
  who?: string;
  code_version?: string;
  parameters?: Record<string, unknown>;
  duration_seconds?: number;
  started_at?: string;
}

export interface SourceRelease {
  id: number;
  source_id: number;
  release_key: string;
  release_name: string;
  release_type: "scheduled_etl" | "snapshot";
  cdm_version: string | null;
  vocabulary_version: string | null;
  etl_version: string | null;
  person_count: number;
  record_count: number;
  notes: string | null;
  etl_metadata: EtlMetadata | null;
  created_at: string;
  updated_at: string;
}

export interface ChartAnnotation {
  id: number;
  source_id: number | null;
  chart_type: string;
  chart_context: Record<string, unknown>;
  x_value: string;
  y_value: number | null;
  annotation_text: string;
  tag: 'data_event' | 'research_note' | 'action_item' | 'system' | null;
  parent_id: number | null;
  created_by: number;
  creator?: { id: number; name: string };
  source?: { id: number; source_name: string };
  replies?: ChartAnnotation[];
  created_at: string;
  updated_at: string;
}

export interface StoreReleasePayload {
  release_name: string;
  release_type: "scheduled_etl" | "snapshot";
  cdm_version?: string;
  vocabulary_version?: string;
  etl_version?: string;
  notes?: string;
}

export interface UpdateReleasePayload {
  release_name?: string;
  cdm_version?: string;
  vocabulary_version?: string;
  etl_version?: string;
  notes?: string;
}

export interface StoreAnnotationPayload {
  chart_type: string;
  chart_context: Record<string, unknown>;
  x_value: string;
  y_value?: number;
  annotation_text: string;
  tag?: string;
  parent_id?: number;
}

export interface UpdateAnnotationPayload {
  annotation_text: string;
}

export type AresSection =
  | "hub"
  | "network-overview"
  | "concept-comparison"
  | "dq-history"
  | "coverage"
  | "feasibility"
  | "diversity"
  | "releases"
  | "unmapped-codes"
  | "cost"
  | "annotations";

// DQ History types
export interface DqTrendPoint {
  release_id: number;
  release_name: string;
  created_at: string;
  pass_rate: number;
  total: number;
  passed: number;
}

export interface DqCategoryTrendPoint {
  release_id: number;
  release_name: string;
  created_at: string;
  categories: Record<string, number>;
}

export interface DqDomainTrendPoint {
  release_id: number;
  release_name: string;
  created_at: string;
  domains: Record<string, number>;
}

export interface DqDelta {
  id: number;
  source_id: number;
  current_release_id: number;
  previous_release_id: number | null;
  check_id: string;
  delta_status: "new" | "existing" | "resolved" | "stable";
  current_passed: boolean;
  previous_passed: boolean | null;
  created_at: string;
}

// Unmapped codes types
export interface UnmappedCodeSummary {
  cdm_table: string;
  cdm_field: string;
  code_count: number;
  total_records: number;
}

export interface UnmappedCode {
  id: number;
  source_id: number;
  release_id: number;
  source_code: string;
  source_vocabulary_id: string;
  cdm_table: string;
  cdm_field: string;
  record_count: number;
  impact_score: number;
  created_at: string;
}

export interface AnnotationFilters {
  tag?: string;
  search?: string;
  source_id?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    per_page: number;
    last_page: number;
  };
}

// Domain continuity types
export interface DomainContinuityPoint {
  release_id: number;
  release_name: string;
  created_at: string;
  domains: Record<string, number>;
}

// Hub KPI types
export interface AresHubKpis {
  source_count: number;
  avg_dq_score: number | null;
  total_unmapped_codes: number;
  annotation_count: number;
  latest_releases: SourceRelease[];
  sources_needing_attention: number;
}

// ── Network comparison types ─────────────────────────────────────────────

export interface ConceptSearchResult {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
}

export interface ConceptComparison {
  source_id: number;
  source_name: string;
  count: number;
  rate_per_1000: number;
  person_count: number;
  ci_lower: number;
  ci_upper: number;
}

// ── Coverage matrix types ────────────────────────────────────────────────

export interface CoverageMatrix {
  sources: Array<{ id: number; name: string }>;
  domains: string[];
  matrix: Array<Record<string, CoverageCell>>;
  domain_totals: Record<string, number>;
  source_completeness: Record<number, number>;
}

export interface CoverageCell {
  record_count: number;
  has_data: boolean;
  density_per_person: number;
}

export interface ExtendedCoverageCell extends CoverageCell {
  earliest_date: string | null;
  latest_date: string | null;
}

export interface ExtendedCoverageMatrix {
  sources: Array<{ id: number; name: string; source_type: string | null }>;
  domains: string[];
  matrix: Array<Record<string, ExtendedCoverageCell>>;
  domain_totals: Record<string, number>;
  source_completeness: Record<number, number>;
  expected: Record<string, Record<string, boolean>>;
}

// ── Diversity types ──────────────────────────────────────────────────────

export interface DiversitySource {
  source_id: number;
  source_name: string;
  person_count: number;
  gender: Record<string, number>;
  race: Record<string, number>;
  ethnicity: Record<string, number>;
  simpson_index: number;
  diversity_rating: 'low' | 'moderate' | 'high' | 'very_high';
}

// ── Feasibility types ────────────────────────────────────────────────────

export interface FeasibilityCriteria {
  required_domains: string[];
  required_concepts?: number[];
  visit_types?: number[];
  date_range?: { start: string; end: string };
  min_patients?: number;
}

export interface FeasibilityAssessment {
  id: number;
  name: string;
  criteria: FeasibilityCriteria;
  sources_assessed: number;
  sources_passed: number;
  created_by: number;
  created_at: string;
  results?: FeasibilityResult[];
}

export interface FeasibilityResult {
  id: number;
  assessment_id: number;
  source_id: number;
  source_name: string;
  domain_pass: boolean;
  concept_pass: boolean;
  visit_pass: boolean;
  date_pass: boolean;
  patient_pass: boolean;
  overall_pass: boolean;
  details: Record<string, unknown>;
  domain_score: number;
  concept_score: number;
  visit_score: number;
  date_score: number;
  patient_score: number;
  composite_score: number;
}

// ── Network overview types ───────────────────────────────────────────────

export interface NetworkOverview {
  source_count: number;
  avg_dq_score: number | null;
  total_unmapped_codes: number;
  sources_needing_attention: number;
  network_person_count: number;
  network_record_count: number;
  dq_summary: NetworkDqSource[];
}

export interface NetworkDqSource {
  source_id: number;
  source_name: string;
  pass_rate: number;
  trend: "up" | "down" | "stable" | null;
  release_name: string | null;
  sparkline: number[];
  days_since_refresh: number | null;
  domain_count: number;
  person_count: number;
}

// ── Cost types ──────────────────────────────────────────────────────────

export interface CostDomain {
  domain: string;
  total_cost: number;
  record_count: number;
  avg_cost: number;
}

export interface CostSummary {
  has_cost_data: boolean;
  domains: CostDomain[];
  total_cost: number;
  person_count: number;
  avg_observation_years: number;
  pppy: number;
}

export interface CostMonth {
  month: string;
  total_cost: number;
  record_count: number;
}

export interface CostTrends {
  has_cost_data: boolean;
  months: CostMonth[];
}

export interface CostConcept {
  concept_id: number;
  concept_name: string;
  total_cost: number;
  record_count: number;
}

export interface CostDomainDetail {
  has_cost_data: boolean;
  concepts: CostConcept[];
}

export interface NetworkCostSource {
  source_id: number;
  source_name: string;
  has_cost_data: boolean;
  total_cost: number;
  record_count: number;
}

export interface NetworkCost {
  sources: NetworkCostSource[];
}

// ── Phase C: Temporal prevalence ─────────────────────────────────────

export interface TemporalPrevalenceTrend {
  release_name: string;
  rate_per_1000: number;
}

export interface TemporalPrevalenceSource {
  source_id: number;
  source_name: string;
  trend: TemporalPrevalenceTrend[];
}

export interface TemporalPrevalenceResponse {
  sources: TemporalPrevalenceSource[];
}

export interface ConceptComparisonResponse {
  sources: ConceptComparison[];
  benchmark_rate: number | null;
}

export interface ConceptSetComparison {
  source_id: number;
  source_name: string;
  union_count: number;
  rate_per_1000: number;
  person_count: number;
}

// ── Phase B: Alerts ────────────────────────────────────────────────────

export interface AresAlert {
  severity: 'warning' | 'critical';
  source_id: number;
  source_name: string;
  type: 'dq_drop' | 'stale_data' | 'unmapped_spike';
  message: string;
  value: number;
}

// ── Phase B: Multi-concept comparison ──────────────────────────────────

export interface MultiConceptComparison {
  concepts: Array<{ concept_id: number; concept_name: string }>;
  sources: Array<{
    source_id: number;
    source_name: string;
    rates: Record<number, { count: number; rate_per_1000: number; ci_lower: number; ci_upper: number }>;
  }>;
}

// ── Phase B: Attrition funnel ──────────────────────────────────────────

export interface AttritionFunnelStep {
  concept_id: number;
  concept_name: string;
  counts: Record<number, number>;
}

// ── Phase B: DQ Heatmap ────────────────────────────────────────────────

export interface DqCategoryHeatmapCell {
  release_name: string;
  category: string;
  pass_rate: number;
}

// ── Phase B: DQ Overlay ────────────────────────────────────────────────

export interface DqOverlayPoint {
  release_name: string;
  sources: Record<number, number>;
}

// ── Phase B: Temporal coverage ─────────────────────────────────────────

export interface TemporalCoverage {
  source_id: number;
  domain: string;
  earliest: string;
  latest: string;
  expected: boolean;
}

// ── Phase B: Feasibility impact ────────────────────────────────────────

export interface CriteriaImpact {
  criterion: string;
  sources_passing: number;
  sources_total: number;
  impact: number;
}

// ── Phase B: CONSORT diagram ───────────────────────────────────────────

export interface ConsortStep {
  label: string;
  remaining: Record<number, number>;
}

// ── Phase B: Feasibility template ──────────────────────────────────────

export interface FeasibilityTemplate {
  id: number;
  name: string;
  description: string | null;
  criteria: Record<string, unknown>;
  is_public: boolean;
  created_by: number;
}

// ── Phase B: Age pyramid ───────────────────────────────────────────────

export interface AgePyramidBand {
  age_group: string;
  male: number;
  female: number;
}

// ── Phase B: DAP gap analysis ──────────────────────────────────────────

export interface DapGapItem {
  dimension: string;
  source_value: number;
  benchmark_value: number;
  gap: number;
  status: 'met' | 'gap' | 'critical';
}

// ── Phase B: Pooled demographics ───────────────────────────────────────

export interface PooledDemographics {
  gender: Record<string, number>;
  race: Record<string, number>;
  ethnicity: Record<string, number>;
  total_persons: number;
}

// ── Phase B: Release diff ──────────────────────────────────────────────

export interface ReleaseDiff {
  has_previous: boolean;
  person_delta: number;
  record_delta: number;
  domain_deltas: Record<string, number>;
  dq_score_delta: number;
  vocab_version_changed: boolean;
  unmapped_code_delta: number;
  auto_notes: string;
}

// ── Phase B: Swimlane timeline ─────────────────────────────────────────

export interface SwimLaneEntry {
  source_id: number;
  source_name: string;
  releases: Array<{ id: number; name: string; date: string; type: string }>;
}

// ── Phase B: Release calendar ──────────────────────────────────────────

export interface ReleaseCalendarEvent {
  date: string;
  source_name: string;
  release_name: string;
  type: string;
}

// ── Phase B: Unmapped pareto ───────────────────────────────────────────

export interface ParetoDataPoint {
  source_code: string;
  record_count: number;
  cumulative_pct: number;
}

// ── Phase B: Mapping progress ──────────────────────────────────────────

export interface MappingProgress {
  source_id: number;
  total_unmapped: number;
  mapped: number;
  deferred: number;
  excluded: number;
  pending: number;
}

// ── Phase B: Annotation timeline ───────────────────────────────────────

export interface AnnotationTimelineEntry {
  id: number;
  date: string;
  text: string;
  tag: string | null;
  source_name: string;
  chart_type: string;
  creator_name: string;
}

// ── Phase B: Cost distribution (box plot) ──────────────────────────────

export interface CostDistribution {
  domain: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
}

// ── Phase B: Care setting breakdown ────────────────────────────────────

export interface CareSettingCost {
  care_setting: string;
  total_cost: number;
  person_count: number;
  pppy: number;
}

// ── Phase B: Network cost compare ──────────────────────────────────────

export interface NetworkCostCompare {
  sources: Array<{
    source_id: number;
    source_name: string;
    total_cost: number;
    pppy: number;
    person_count: number;
  }>;
}

// ── Phase C/D: Standardized comparison ─────────────────────────────────

export interface StandardizedComparison {
  source_id: number;
  source_name: string;
  crude_rate: number;
  standardized_rate: number;
  ci_lower: number;
  ci_upper: number;
  person_count: number;
  warning: string | null;
}

// ── Phase C/D: Arrival forecast ────────────────────────────────────────

export interface ArrivalForecast {
  source_id: number;
  source_name: string;
  historical: Array<{ month: string; patient_count: number }>;
  projected: Array<{
    month: string;
    projected_count: number;
    lower_bound: number;
    upper_bound: number;
  }>;
  monthly_rate: number;
  months_to_target: number | null;
}

// ── Phase B: Cost type option ──────────────────────────────────────────

export interface CostTypeOption {
  concept_id: number;
  concept_name: string;
}

// ── Phase B: DQ SLA target ─────────────────────────────────────────────

export interface DqSlaTarget {
  id: number;
  source_id: number;
  category: string;
  min_pass_rate: number;
}

// ── Phase B: Accepted mapping ──────────────────────────────────────────

export interface AcceptedMapping {
  id: number;
  source_id: number;
  source_code: string;
  source_vocabulary_id: string;
  target_concept_id: number;
  target_concept_name: string | null;
  mapping_method: 'manual' | 'ai_suggestion' | 'usagi';
  confidence: number | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
}

// ── Phase B: Unmapped code review ──────────────────────────────────────

export interface UnmappedCodeReview {
  id: number;
  source_id: number;
  source_code: string;
  source_vocabulary_id: string;
  status: 'pending' | 'mapped' | 'deferred' | 'excluded';
  notes: string | null;
  reviewed_by: number | null;
}

// ── Phase C: Geographic diversity ──────────────────────────────────────

export interface GeographicDiversity {
  source_id: number;
  source_name: string;
  state_distribution: Record<string, number>;
  adi_distribution: Record<string, number>;
  geographic_reach: number;
  median_adi: number | null;
}

// ── Phase C: Mapping suggestions ───────────────────────────────────────

export interface MappingSuggestion {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  confidence_score: number;
  distance: number;
}

// ── Phase C: DQ Radar ───────────────────────────────────────────────

export interface DqRadarProfile {
  source_id: number;
  source_name: string;
  dimensions: {
    completeness: number;
    conformance_value: number;
    conformance_relational: number;
    plausibility_atemporal: number;
    plausibility_temporal: number;
  };
}

// ── Phase C: DQ SLA Compliance ──────────────────────────────────────

export interface DqSlaCompliance {
  category: string;
  target: number;
  actual: number;
  compliant: boolean;
  error_budget_remaining: number;
}

export interface DqSlaTargetInput {
  category: string;
  min_pass_rate: number;
}
