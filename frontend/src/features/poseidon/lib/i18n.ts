import type { TFunction } from "i18next";

const RUN_STATUS_KEY_MAP: Record<string, string> = {
  pending: "pending",
  running: "running",
  success: "success",
  failed: "failed",
  cancelled: "cancelled",
};

const SCHEDULE_TYPE_KEY_MAP: Record<string, string> = {
  manual: "manual",
  cron: "cron",
  sensor: "sensor",
};

const RUN_TYPE_KEY_MAP: Record<string, string> = {
  full_refresh: "fullRefresh",
  vocabulary: "vocabulary",
  incremental: "incremental",
};

export function getPoseidonRunStatusLabel(t: TFunction, status: string): string {
  const key = RUN_STATUS_KEY_MAP[status];
  return key ? t(`poseidon.runStatus.${key}`) : status;
}

export function getPoseidonScheduleTypeLabel(
  t: TFunction,
  scheduleType: string,
): string {
  const key = SCHEDULE_TYPE_KEY_MAP[scheduleType];
  return key ? t(`poseidon.scheduleType.${key}`) : scheduleType;
}

export function getPoseidonRunTypeLabel(t: TFunction, runType: string): string {
  const key = RUN_TYPE_KEY_MAP[runType];
  return key ? t(`poseidon.runType.${key}`) : runType;
}

export function getPoseidonTierLabel(t: TFunction, depth: number): string {
  const key = {
    0: "staging",
    1: "intermediate",
    2: "cdm",
    3: "quality",
  }[depth as 0 | 1 | 2 | 3];

  return key
    ? t(`poseidon.lineage.tiers.${key}`)
    : t("poseidon.lineage.tiers.fallback", { index: depth });
}
