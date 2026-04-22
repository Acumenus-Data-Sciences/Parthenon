import type { TFunction } from "i18next";
import i18next from "@/i18n/i18n";
import type { GisLayer, TooltipEntry } from "../layers/types";

const SVI_THEME_KEYS = [
  "gis.layers.svi.detail.themes.socioeconomicStatus",
  "gis.layers.svi.detail.themes.householdComposition",
  "gis.layers.svi.detail.themes.minorityStatus",
  "gis.layers.svi.detail.themes.housingTransportation",
] as const;

function isAppKey(value: string): boolean {
  return (
    value.startsWith("gis.") ||
    value.startsWith("poseidon.") ||
    value.startsWith("codeExplorer.") ||
    value.startsWith("jupyter.") ||
    value.startsWith("queryAssistant.")
  );
}

function resolveAppText(value: string): string {
  return isAppKey(value) ? i18next.t(value, { ns: "app" }) : value;
}

export function localizeGisLayer(layer: GisLayer): GisLayer {
  return {
    ...layer,
    name: resolveAppText(layer.name),
    description: resolveAppText(layer.description),
    legendItems: layer.legendItems.map((item) => ({
      ...item,
      label: resolveAppText(item.label),
      categories: item.categories?.map((category) => ({
        ...category,
        label: resolveAppText(category.label),
      })),
    })),
    getTooltipData: (feature) =>
      layer.getTooltipData(feature).map((entry) => localizeTooltipEntry(entry)),
  };
}

function localizeTooltipEntry(entry: TooltipEntry): TooltipEntry {
  return {
    ...entry,
    label: resolveAppText(entry.label),
    value:
      typeof entry.value === "string" ? resolveAppText(entry.value) : entry.value,
  };
}

export function getAnalysisDrawerTitle(t: TFunction, count: number): string {
  return t("gis.analysisDrawer.title", { count });
}

export function getAnalysisLayerCountLabel(t: TFunction, count: number): string {
  return t("gis.common.analysisLayerCount", { count });
}

export function getDiseaseSearchTitle(t: TFunction, count: number): string {
  return t("gis.diseaseSelector.patientCountTitle", { count });
}

export function getRuccCategoryLabel(t: TFunction, category: string): string {
  const key = {
    metro: "gis.layers.rucc.categories.metro",
    micro: "gis.layers.rucc.categories.micro",
    rural: "gis.layers.rucc.categories.rural",
  }[category];

  return key ? t(key) : category;
}

export function getSviThemeLabel(t: TFunction, index: number): string {
  return t(SVI_THEME_KEYS[index] ?? SVI_THEME_KEYS[0]);
}
