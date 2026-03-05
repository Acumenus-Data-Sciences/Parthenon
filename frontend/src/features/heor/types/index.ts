export type AnalysisType = 'cea' | 'cba' | 'cua' | 'budget_impact' | 'roi';
export type Perspective = 'payer' | 'societal' | 'provider' | 'patient';
export type TimeHorizon = '1_year' | '5_year' | '10_year' | 'lifetime';
export type ScenarioType = 'intervention' | 'comparator' | 'sensitivity';
export type ParameterType =
  | 'drug_cost' | 'admin_cost' | 'hospitalization' | 'er_visit'
  | 'qaly_weight' | 'utility_value' | 'resource_use' | 'avoided_cost' | 'program_cost';
export type ContractType = 'outcomes_based' | 'amortized' | 'warranty';

export interface HeorAnalysis {
  id: number;
  created_by: number;
  source_id: number | null;
  name: string;
  analysis_type: AnalysisType;
  description: string | null;
  perspective: Perspective;
  time_horizon: TimeHorizon;
  discount_rate: number;
  currency: string;
  target_cohort_id: number | null;
  comparator_cohort_id: number | null;
  status: 'draft' | 'running' | 'completed' | 'failed';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  scenarios?: HeorScenario[];
  parameters?: HeorCostParameter[];
}

export interface HeorScenario {
  id: number;
  analysis_id: number;
  name: string;
  scenario_type: ScenarioType;
  description: string | null;
  parameter_overrides: Record<string, number> | null;
  is_base_case: boolean;
  sort_order: number;
  result?: HeorResult;
}

export interface HeorCostParameter {
  id: number;
  analysis_id: number;
  scenario_id: number | null;
  parameter_name: string;
  parameter_type: ParameterType;
  value: number;
  unit: string | null;
  lower_bound: number | null;
  upper_bound: number | null;
  distribution: string | null;
  omop_concept_id: number | null;
  source_reference: string | null;
}

export interface TornadoEntry {
  parameter: string;
  type: string;
  base_value: number;
  low_value: number;
  high_value: number;
  low_icer: number | null;
  high_icer: number | null;
  range: number;
}

export interface HeorResult {
  id: number;
  analysis_id: number;
  scenario_id: number;
  total_cost: number | null;
  total_qalys: number | null;
  total_lys: number | null;
  incremental_cost: number | null;
  incremental_qalys: number | null;
  icer: number | null;
  net_monetary_benefit: number | null;
  willingness_to_pay_threshold: number | null;
  roi_percent: number | null;
  payback_period_months: number | null;
  budget_impact_year1: number | null;
  budget_impact_year3: number | null;
  budget_impact_year5: number | null;
  tornado_data: TornadoEntry[] | null;
  cohort_size: number | null;
  scenario?: HeorScenario;
}

export interface RebateTier {
  threshold: number;
  rebate_percent: number;
}

export interface HeorValueContract {
  id: number;
  analysis_id: number;
  created_by: number;
  contract_name: string;
  drug_name: string | null;
  contract_type: ContractType;
  outcome_metric: string;
  baseline_rate: number | null;
  rebate_tiers: RebateTier[] | null;
  list_price: number | null;
  net_price_floor: number | null;
  measurement_period_months: number;
  status: 'draft' | 'active' | 'expired';
  effective_date: string | null;
  created_at: string;
}

export interface HeorStats {
  total_analyses: number;
  completed_analyses: number;
  total_contracts: number;
  by_type: Record<string, number>;
}

export interface RebateSimulation {
  list_price: number;
  observed_rate: number;
  baseline_rate: number;
  rebate_percent: number;
  rebate_amount: number;
  net_price: number;
  applied_tier: RebateTier | null;
}
