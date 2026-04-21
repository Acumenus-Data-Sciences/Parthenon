import type { TFunction } from "i18next";

const STATUS_KEY_MAP: Record<string, string> = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
};

const CATEGORY_KEY_MAP: Record<string, string> = {
  Endocrine: "endocrine",
  Cardiovascular: "cardiovascular",
  Respiratory: "respiratory",
  "Mental Health": "mentalHealth",
  Rheumatologic: "rheumatologic",
  Neurological: "neurological",
  Oncology: "oncology",
  All: "all",
  "All Categories": "all",
};

export const CARE_GAP_DISEASE_CATEGORIES = [
  "Endocrine",
  "Cardiovascular",
  "Respiratory",
  "Mental Health",
  "Rheumatologic",
  "Neurological",
  "Oncology",
] as const;

export function getCareGapStatusLabel(t: TFunction, status: string): string {
  const key = STATUS_KEY_MAP[status];
  if (!key) return status;
  return t(`careGaps.common.status.${key}`);
}

export function getCareGapCategoryLabel(t: TFunction, category: string): string {
  const key = CATEGORY_KEY_MAP[category];
  if (!key) return category;
  return t(`careGaps.common.category.${key}`);
}
