import type { TFunction } from "i18next";

const ANALYSIS_TYPE_KEY_MAP: Record<string, string> = {
  cea: "cea",
  cba: "cba",
  cua: "cua",
  budget_impact: "budgetImpact",
  roi: "roi",
};

const STATUS_KEY_MAP: Record<string, string> = {
  draft: "draft",
  running: "running",
  completed: "completed",
  failed: "failed",
  active: "active",
  expired: "expired",
};

const PARAMETER_TYPE_KEY_MAP: Record<string, string> = {
  drug_cost: "drugCost",
  admin_cost: "adminCost",
  hospitalization: "hospitalization",
  er_visit: "erVisit",
  qaly_weight: "qalyWeight",
  utility_value: "utilityValue",
  resource_use: "resourceUse",
  avoided_cost: "avoidedCost",
  program_cost: "programCost",
};

const PERSPECTIVE_KEY_MAP: Record<string, string> = {
  payer: "payer",
  societal: "societal",
  provider: "provider",
  patient: "patient",
};

const TIME_HORIZON_KEY_MAP: Record<string, string> = {
  "1_year": "oneYear",
  "5_year": "fiveYear",
  "10_year": "tenYear",
  lifetime: "lifetime",
};

const SCENARIO_TYPE_KEY_MAP: Record<string, string> = {
  intervention: "intervention",
  comparator: "comparator",
  sensitivity: "sensitivity",
};

export function getHeorAnalysisTypeLabel(t: TFunction, type: string): string {
  const key = ANALYSIS_TYPE_KEY_MAP[type];
  if (!key) return type;
  return t(`heor.common.analysisTypes.${key}`);
}

export function getHeorStatusLabel(t: TFunction, status: string): string {
  const key = STATUS_KEY_MAP[status];
  if (!key) return status;
  return t(`heor.common.status.${key}`);
}

export function getHeorParameterTypeLabel(t: TFunction, type: string): string {
  const key = PARAMETER_TYPE_KEY_MAP[type];
  if (!key) {
    return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return t(`heor.common.parameterTypes.${key}`);
}

export function getHeorPerspectiveLabel(t: TFunction, perspective: string): string {
  const key = PERSPECTIVE_KEY_MAP[perspective];
  if (!key) return perspective;
  return t(`heor.common.perspectives.${key}`);
}

export function getHeorTimeHorizonLabel(t: TFunction, horizon: string): string {
  const key = TIME_HORIZON_KEY_MAP[horizon];
  if (!key) return horizon.replace(/_/g, " ");
  return t(`heor.common.timeHorizons.${key}`);
}

export function getHeorScenarioTypeLabel(t: TFunction, scenarioType: string): string {
  const key = SCENARIO_TYPE_KEY_MAP[scenarioType];
  if (!key) return scenarioType;
  return t(`heor.common.scenarioTypes.${key}`);
}
