import type { TFunction } from "i18next";
import type { ClinicalDomain, LabStatus } from "../types/profile";

export type ProfileDomainCopyKey =
  | "condition"
  | "drug"
  | "procedure"
  | "measurement"
  | "observation"
  | "visit";

// i18n-exempt: profile domain identifiers are internal constants.
const DOMAIN_COPY_KEY_BY_DOMAIN: Record<ClinicalDomain, ProfileDomainCopyKey> = {
  condition: "condition",
  drug: "drug",
  procedure: "procedure",
  measurement: "measurement",
  observation: "observation",
  visit: "visit",
};

export type ProfileViewMode =
  | "timeline"
  | "list"
  | "labs"
  | "imaging"
  | "visits"
  | "notes"
  | "eras"
  | "precision";

export type ProfileDomainTab = "all" | ClinicalDomain;

export function getProfileDomainCopyKey(
  domain: ClinicalDomain,
): ProfileDomainCopyKey {
  return DOMAIN_COPY_KEY_BY_DOMAIN[domain];
}

export function getProfileDomainLabel(
  t: TFunction<"app">,
  domain: ClinicalDomain,
  plural = false,
): string {
  const copyKey = getProfileDomainCopyKey(domain);
  return t(
    plural
      ? `profiles.common.domains.${copyKey}`
      : `profiles.common.domain.${copyKey}`,
  );
}

export function getProfileTabLabel(
  t: TFunction<"app">,
  tab: ProfileDomainTab,
): string {
  return tab === "all"
    ? t("profiles.page.tabs.all")
    : getProfileDomainLabel(t, tab, true);
}

export function getProfileViewLabel(
  t: TFunction<"app">,
  mode: ProfileViewMode,
): string {
  return t(`profiles.page.views.${mode}`);
}

export function getProfileGenderLabel(
  t: TFunction<"app">,
  gender: string | null | undefined,
): string {
  if (!gender) {
    return t("profiles.header.demographics.unknownGender");
  }

  const normalized = gender.trim().toLowerCase();
  if (normalized === "male" || normalized === "m") {
    return t("patientSimilarity.common.genders.male");
  }
  if (normalized === "female" || normalized === "f") {
    return t("patientSimilarity.common.genders.female");
  }

  return gender;
}

export function getLabStatusLabel(
  t: TFunction<"app">,
  status: LabStatus,
): string {
  if (status === "unknown") {
    return t("profiles.common.notAvailable");
  }

  return t(`profiles.labs.status.${status}`);
}

export function formatProfileTimeAgo(
  t: TFunction<"app">,
  epochMs: number,
): string {
  const diff = Date.now() - epochMs;
  const mins = Math.floor(diff / 60000);

  if (mins < 1) {
    return t("profiles.recent.justNow");
  }
  if (mins < 60) {
    return t("profiles.recent.minutesAgo", { count: mins });
  }

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return t("profiles.recent.hoursAgo", { count: hours });
  }

  const days = Math.floor(hours / 24);
  return t("profiles.recent.daysAgo", { count: days });
}
