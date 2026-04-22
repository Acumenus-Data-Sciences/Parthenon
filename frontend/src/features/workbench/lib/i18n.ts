import type { TFunction } from "i18next";
import type { ToolsetDescriptor, ToolsetStatus } from "../types";

const TOOLSET_STATUS_KEY_MAP: Record<ToolsetStatus, string> = {
  available: "available",
  coming_soon: "comingSoon",
  sdk_required: "sdkRequired",
};

const INVESTIGATION_STATUS_KEY_MAP: Record<string, string> = {
  draft: "draft",
  active: "active",
  complete: "complete",
  archived: "archived",
};

function getToolsetCopy(
  t: TFunction<"app">,
  toolset: ToolsetDescriptor,
  field: "name" | "tagline" | "description",
): string {
  return toolset.copyKey
    ? t(`workbenchLauncher.toolsetMeta.${toolset.copyKey}.${field}`)
    : toolset[field];
}

export function getWorkbenchToolsetName(
  t: TFunction<"app">,
  toolset: ToolsetDescriptor,
): string {
  return getToolsetCopy(t, toolset, "name");
}

export function getWorkbenchToolsetTagline(
  t: TFunction<"app">,
  toolset: ToolsetDescriptor,
): string {
  return getToolsetCopy(t, toolset, "tagline");
}

export function getWorkbenchToolsetDescription(
  t: TFunction<"app">,
  toolset: ToolsetDescriptor,
): string {
  return getToolsetCopy(t, toolset, "description");
}

export function getWorkbenchToolsetStatusLabel(
  t: TFunction<"app">,
  status: ToolsetStatus,
): string {
  const key = TOOLSET_STATUS_KEY_MAP[status];
  return t(`workbenchLauncher.toolsetStatus.${key}`);
}

export function getWorkbenchInvestigationStatusLabel(
  t: TFunction<"app">,
  status: string,
): string {
  const key = INVESTIGATION_STATUS_KEY_MAP[status];
  return key ? t(`workbenchLauncher.investigationStatus.${key}`) : status;
}

export function formatWorkbenchDate(locale: string | undefined, iso: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}
