import type { TFunction } from "i18next";

const STATUS_KEY_MAP: Record<string, string> = {
  draft: "draft",
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
};

const TIER_KEY_MAP: Record<string, string> = {
  low: "low",
  intermediate: "intermediate",
  high: "high",
  very_high: "veryHigh",
  uncomputable: "uncomputable",
  filtered: "filtered",
};

const CATEGORY_KEY_MAP: Record<string, string> = {
  Cardiovascular: "cardiovascular",
  "Comorbidity Burden": "comorbidityBurden",
  Hepatic: "hepatic",
  Pulmonary: "pulmonary",
  Respiratory: "respiratory",
  Metabolic: "metabolic",
  Endocrine: "endocrine",
  Musculoskeletal: "musculoskeletal",
};

export function getRiskScoreStatusLabel(t: TFunction, status: string): string {
  const key = STATUS_KEY_MAP[status];
  if (!key) return status;
  return t(`riskScores.common.status.${key}`);
}

export function getRiskScoreTierLabel(t: TFunction, tier: string): string {
  const key = TIER_KEY_MAP[tier];
  if (!key) {
    return tier
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return t(`riskScores.common.tier.${key}`);
}

export function getRiskScoreCategoryLabel(t: TFunction, category: string): string {
  const key = CATEGORY_KEY_MAP[category];
  if (!key) return category;
  return t(`riskScores.common.category.${key}`);
}

export function formatRiskScoreDate(
  locale: string | null | undefined,
  iso: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const normalizedLocale =
    !locale || locale === "en-XA" ? "en-US" : locale;
  return new Intl.DateTimeFormat(normalizedLocale, options).format(new Date(iso));
}

export function formatRiskScoreDuration(t: TFunction, ms: number): string {
  if (ms < 1000) {
    return t("riskScores.common.duration.milliseconds", { value: ms });
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return t("riskScores.common.duration.seconds", {
      value: seconds.toFixed(1),
    });
  }

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return t("riskScores.common.duration.minutesSeconds", {
    minutes,
    seconds: remainingSeconds,
  });
}
