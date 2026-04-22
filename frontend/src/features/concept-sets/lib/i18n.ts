import type { TFunction } from "i18next";
import { formatDate } from "@/i18n/format";

export function getConceptSetBuilderTabLabel(
  t: TFunction,
  tab: "keyword" | "semantic",
): string {
  return t(`conceptSets.builder.tabs.${tab}`);
}

export function getConceptSetDetailTabLabel(
  t: TFunction,
  tab: "info" | "hierarchy" | "relationships" | "maps-from",
): string {
  const key = tab === "maps-from" ? "mapsFrom" : tab;
  return t(`conceptSets.detailTabs.${key}`);
}

export function getConceptSetStatLabel(
  t: TFunction,
  key: "total" | "with_items" | "public",
): string {
  if (key === "with_items") return t("conceptSets.stats.withItems");
  return t(`conceptSets.stats.${key}`);
}

export function formatConceptSetDate(locale: string, value: string): string {
  return formatDate(
    value,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
    locale,
  );
}
